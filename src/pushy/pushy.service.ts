import PlanCheckService from './plan-check.service';
import FcmService from './fcm.service';

/**
 * Push notification sender. The module keeps its historical "Pushy" name
 * (class, routes, `pushy_device` table), but delivery is Firebase Cloud
 * Messaging only (`fcm.service.ts`). The legacy Pushy transport was removed in
 * SPRINT_008: nobody relied on push yet, so prod started clean instead of
 * running both transports side by side.
 */

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
}

export interface DeviceSendResponse extends PushyResponse {
    /** FCM tokens that will never deliver again — deactivate those devices. */
    deadTokens?: string[];
}

class PushyService {
    private static instance: PushyService;

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    public static getInstance(): PushyService {
        if (!PushyService.instance) {
            PushyService.instance = new PushyService();
        }
        return PushyService.instance;
    }

    /** The flat payload the app parses: title + message + feature fields. */
    private buildPayload(notificationData: NotificationData): Record<string, any> {
        return {
            title: notificationData.title,
            message: notificationData.message,
            ...notificationData.data
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

            if (!FcmService.isConfigured()) {
                return { success: false, error: 'No push transport is configured' };
            }

            const id = await FcmService.sendToTopic(
                topic, notificationData.title, notificationData.message, this.buildPayload(notificationData));
            return { success: true, id };
        } catch (error: any) {
            this.logSendError(`topic "${topic}"`, tenantId, notificationData, error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
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

            if (!FcmService.isConfigured()) {
                return { success: false, error: 'No push transport is configured' };
            }

            const result = await FcmService.sendToTokens(
                devices.map(d => d.deviceToken),
                notificationData.title,
                notificationData.message,
                this.buildPayload(notificationData)
            );

            return result.successCount > 0
                ? { success: true, info: `Sent to ${result.successCount} device(s)`, deadTokens: result.deadTokens }
                : { success: false, error: 'Failed to send notification', deadTokens: result.deadTokens };
        } catch (error: any) {
            this.logSendError(`${devices.length} device(s)`, tenantId, notificationData, error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
            };
        }
    }

    /**
     * Stops a device receiving topic notifications (admin removal). FCM can't
     * list a token's topics, so [fcmTopics] must hold every topic the device
     * could be subscribed to.
     */
    public async unsubscribeDevice(device: PushTarget, fcmTopics: string[]): Promise<PushyResponse> {
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

    private logSendError(target: string, tenantId: number, notificationData: NotificationData, error: any) {
        console.error(`❌ Failed to send push notification to ${target}`);
        console.error(`   Tenant ID: ${tenantId}, Notification: ${notificationData.title}`);
        console.error(`   Error Code:`, error?.code);
        console.error(`   Error Message:`, error?.error || error?.message || error);
    }
}

export default PushyService.getInstance();
