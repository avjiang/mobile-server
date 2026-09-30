import Pushy from 'pushy';
import PlanCheckService from './plan-check.service';
import FcmService from './fcm.service';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Push notification sender. The module keeps its historical "Pushy" name, but
 * delivery now goes through two transports:
 *
 * - **FCM** (`fcm.service.ts`) — every app build since the FCM move.
 * - **Pushy** (legacy) — installs that haven't updated yet. Skipped when
 *   `PUSHY_SECRET_API_KEY` is unset; remove this path once no active
 *   `pushy_device` row has `PROVIDER = 'pushy'`.
 *
 * Topic sends go to both (a device only listens on one of them, so nobody gets
 * a duplicate). Device sends pick the transport from each device's provider.
 */

const PUSHY_API_KEY = process.env.PUSHY_SECRET_API_KEY;

export const PUSH_PROVIDER_FCM = 'fcm';
export const PUSH_PROVIDER_PUSHY = 'pushy';

interface NotificationData {
    title: string;
    message: string;
    data?: any;
}

interface PushyResponse {
    success: boolean;
    id?: string;
    info?: any;
    error?: string;
    data?: any;
}

export interface PushTarget {
    deviceToken: string;
    provider: string;
}

export interface DeviceSendResponse extends PushyResponse {
    /** FCM tokens that will never deliver again — deactivate those devices. */
    deadTokens?: string[];
}

class PushyService {
    private static instance: PushyService;
    private pushy: any = null;
    private pushyInitAttempted = false;

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    public static getInstance(): PushyService {
        if (!PushyService.instance) {
            PushyService.instance = new PushyService();
        }
        return PushyService.instance;
    }

    /** The legacy Pushy client, or null when no Pushy key is configured. */
    private getPushy(): any {
        if (this.pushyInitAttempted) return this.pushy;
        this.pushyInitAttempted = true;

        if (!PUSHY_API_KEY) {
            console.warn('Legacy Pushy sending disabled: PUSHY_SECRET_API_KEY is not set');
            return null;
        }
        try {
            this.pushy = new Pushy(PUSHY_API_KEY);
            console.log('Legacy Pushy client initialized');
        } catch (error) {
            console.error('Failed to initialize legacy Pushy client:', error);
            this.pushy = null;
        }
        return this.pushy;
    }

    /** The flat payload the app parses: title + message + feature fields. */
    private buildPayload(notificationData: NotificationData): Record<string, any> {
        return {
            title: notificationData.title,
            message: notificationData.message,
            ...notificationData.data
        };
    }

    private pushyOptions(notificationData: NotificationData) {
        return {
            notification: {
                title: notificationData.title,
                body: notificationData.message,
                badge: 1,
                sound: 'default'
            }
        };
    }

    public async sendToTopic(
        topic: string,
        notificationData: NotificationData,
        tenantId: number
    ): Promise<PushyResponse> {
        try {
            // Check if tenant has Pro plan (with 1-hour cache)
            const isProPlan = await PlanCheckService.isProPlan(tenantId);

            if (!isProPlan) {
                console.log(`Skipping notification for tenant ${tenantId} - not on Pro plan`);
                return {
                    success: true,
                    id: 'skipped',
                    info: 'Notification skipped - not on Pro plan'
                };
            }

            const payload = this.buildPayload(notificationData);
            const sends: Promise<string>[] = [];

            if (FcmService.isConfigured()) {
                sends.push(FcmService.sendToTopic(topic, notificationData.title, notificationData.message, payload));
            }

            const pushy = this.getPushy();
            if (pushy) {
                // Pushy requires the /topics/ prefix for topic-based notifications
                sends.push(
                    pushy
                        .sendPushNotification(payload, `/topics/${topic}`, this.pushyOptions(notificationData))
                        .then((response: any) => response.id)
                );
            }

            if (sends.length === 0) {
                return { success: false, error: 'No push transport is configured' };
            }

            const results = await Promise.allSettled(sends);
            const ids = results
                .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
                .map(r => r.value);
            results
                .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
                .forEach(r => this.logSendError(`topic "${topic}"`, tenantId, notificationData, r.reason));

            return ids.length > 0
                ? { success: true, id: ids.join(','), info: `Sent via ${ids.length} transport(s)` }
                : { success: false, error: 'Failed to send notification' };
        } catch (error: any) {
            this.logSendError(`topic "${topic}"`, tenantId, notificationData, error);
            return {
                success: false,
                error: error.error || error.message || 'Failed to send notification'
            };
        }
    }

    public async sendToDevices(
        devices: PushTarget[],
        notificationData: NotificationData,
        tenantId: number
    ): Promise<DeviceSendResponse> {
        if (!devices || devices.length === 0) {
            return {
                success: false,
                error: 'No device tokens provided'
            };
        }

        try {
            // Check if tenant has Pro plan (with 1-hour cache)
            const isProPlan = await PlanCheckService.isProPlan(tenantId);

            if (!isProPlan) {
                return {
                    success: true,
                    id: 'skipped',
                    info: 'Notification skipped - not on Pro plan'
                };
            }

            const payload = this.buildPayload(notificationData);
            const fcmTokens = devices.filter(d => d.provider === PUSH_PROVIDER_FCM).map(d => d.deviceToken);
            const pushyTokens = devices.filter(d => d.provider !== PUSH_PROVIDER_FCM).map(d => d.deviceToken);

            let sent = 0;
            const deadTokens: string[] = [];

            if (fcmTokens.length > 0 && FcmService.isConfigured()) {
                try {
                    const result = await FcmService.sendToTokens(
                        fcmTokens, notificationData.title, notificationData.message, payload);
                    sent += result.successCount;
                    deadTokens.push(...result.deadTokens);
                } catch (error) {
                    this.logSendError(`${fcmTokens.length} FCM device(s)`, tenantId, notificationData, error);
                }
            }

            const pushy = this.getPushy();
            if (pushyTokens.length > 0 && pushy) {
                try {
                    await pushy.sendPushNotification(payload, pushyTokens, this.pushyOptions(notificationData));
                    sent += pushyTokens.length;
                } catch (error) {
                    this.logSendError(`${pushyTokens.length} Pushy device(s)`, tenantId, notificationData, error);
                }
            }

            return sent > 0
                ? { success: true, info: `Sent to ${sent} device(s)`, deadTokens }
                : { success: false, error: 'Failed to send notification', deadTokens };
        } catch (error: any) {
            this.logSendError(`${devices.length} device(s)`, tenantId, notificationData, error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
            };
        }
    }

    /**
     * Stops a device receiving topic notifications (admin removal, or a device
     * that moved from Pushy to FCM). FCM can't list a token's topics, so
     * [fcmTopics] must hold every topic the device could be subscribed to.
     */
    public async unsubscribeDevice(device: PushTarget, fcmTopics: string[]): Promise<PushyResponse> {
        if (device.provider === PUSH_PROVIDER_FCM) {
            if (!FcmService.isConfigured()) {
                return { success: false, error: 'FCM is not configured' };
            }
            try {
                const unsubscribedTopics = await FcmService.unsubscribeFromTopics(device.deviceToken, fcmTopics);
                return { success: true, data: { unsubscribedTopics } };
            } catch (error: any) {
                return { success: false, error: error.message || 'Failed to unsubscribe from topics' };
            }
        }
        return this.unsubscribeDeviceFromAllTopics(device.deviceToken);
    }

    public async getDeviceTopics(deviceToken: string): Promise<string[]> {
        const pushy = this.getPushy();
        if (!pushy) return [];

        try {
            const deviceInfo = await pushy.getDeviceInfo(deviceToken);
            return deviceInfo.topics || [];
        } catch (error: any) {
            console.error(`Failed to get device topics ${deviceToken}:`, error);
            return [];
        }
    }

    /** Legacy Pushy: asks Pushy for the device's topics and leaves each one. */
    public async unsubscribeDeviceFromAllTopics(deviceToken: string): Promise<PushyResponse> {
        if (!deviceToken) {
            return {
                success: false,
                error: 'Device token is required'
            };
        }

        const pushy = this.getPushy();
        if (!pushy) {
            return { success: false, error: 'Legacy Pushy is not configured' };
        }

        try {
            // Get current subscribed topics from Pushy API
            const topics = await this.getDeviceTopics(deviceToken);

            if (topics.length === 0) {
                console.log(`Device ${deviceToken} has no topic subscriptions`);
                return {
                    success: true,
                    info: 'No topics to unsubscribe from'
                };
            }

            console.log(`Unsubscribing device from ${topics.length} topic(s): ${topics.join(', ')}`);

            // Unsubscribe device from each topic via Pushy API
            for (const topic of topics) {
                try {
                    await pushy.unsubscribe(deviceToken, topic);
                    console.log(`Successfully unsubscribed device from topic: ${topic}`);
                } catch (topicError: any) {
                    console.error(`Failed to unsubscribe from topic ${topic}:`, topicError.message);
                    // Continue with other topics even if one fails
                }
            }

            return {
                success: true,
                info: `Unsubscribed from ${topics.length} topic(s)`,
                data: { unsubscribedTopics: topics }
            };
        } catch (error: any) {
            console.error('Failed to unsubscribe device from topics:', error);
            return {
                success: false,
                error: error.message || 'Failed to unsubscribe from topics'
            };
        }
    }

    private logSendError(target: string, tenantId: number, notificationData: NotificationData, error: any) {
        console.error(`❌ Failed to send push notification to ${target}`);
        console.error(`   Tenant ID: ${tenantId}, Notification: ${notificationData.title}`);
        console.error(`   Error Code:`, error?.code);
        console.error(`   Error Message:`, error?.error || error?.message || error);
    }
}

export default PushyService.getInstance();
