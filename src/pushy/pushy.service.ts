import Pushy from 'pushy';
import PlanCheckService from './plan-check.service';
import dotenv from 'dotenv';

dotenv.config();

const PUSHY_API_KEY = process.env.PUSHY_SECRET_API_KEY;

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

class PushyService {
    private static instance: PushyService;
    private pushy: any;
    private isInitialized: boolean = false;

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    public static getInstance(): PushyService {
        if (!PushyService.instance) {
            PushyService.instance = new PushyService();
        }
        return PushyService.instance;
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (!PUSHY_API_KEY) {
            throw new Error('PUSHY_SECRET_API_KEY environment variable is not set');
        }

        try {
            this.pushy = new Pushy(PUSHY_API_KEY);
            this.isInitialized = true;
            console.log('PushyService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize PushyService:', error);
            throw new Error('Failed to initialize push notification service');
        }
    }

    public async sendToTopic(
        topic: string,
        notificationData: NotificationData,
        tenantId: number
    ): Promise<PushyResponse> {
        await this.initialize();

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

            const data = {
                title: notificationData.title,
                message: notificationData.message,
                ...notificationData.data
            };

            const options = {
                notification: {
                    title: notificationData.title,
                    body: notificationData.message,
                    badge: 1,
                    sound: 'default'
                }
            };

            // Pushy SDK requires /topics/ prefix for topic-based notifications
            const topicPath = `/topics/${topic}`;

            const response = await this.pushy.sendPushNotification(
                data,
                topicPath,
                options
            );

            return {
                success: true,
                id: response.id,
                info: response.info
            };
        } catch (error: any) {
            console.error(`❌ Failed to send push notification`);
            console.error(`   Topic (backend): "${topic}"`);
            console.error(`   Topic (Pushy API): "/topics/${topic}"`);
            console.error(`   Tenant ID: ${tenantId}`);
            console.error(`   Notification: ${notificationData.title}`);
            console.error(`   Error Code:`, error.code);
            console.error(`   Error Message:`, error.error || error.message || error);

            // Special handling for NO_RECIPIENTS error
            // if (error.code === 'NO_RECIPIENTS') {
            //     console.error(`   ⚠️  NO SUBSCRIBERS FOUND FOR TOPIC: "${topic}"`);
            //     console.error(`   💡 Possible causes:`);
            //     console.error(`      1. Topic name mismatch (devices should subscribe to "${topic}" WITHOUT /topics/ prefix)`);
            //     console.error(`      2. No devices have subscribed to this topic yet`);
            //     console.error(`      3. All devices unsubscribed from this topic`);
            //     console.error(`      4. Devices subscribed to different Pushy app`);
            // }

            return {
                success: false,
                error: error.error || error.message || 'Failed to send notification'
            };
        }
    }

    public async sendToDevices(
        deviceTokens: string[],
        notificationData: NotificationData,
        tenantId: number
    ): Promise<PushyResponse> {
        await this.initialize();

        if (!deviceTokens || deviceTokens.length === 0) {
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

            const data = {
                title: notificationData.title,
                message: notificationData.message,
                ...notificationData.data
            };

            const options = {
                notification: {
                    title: notificationData.title,
                    body: notificationData.message,
                    badge: 1,
                    sound: 'default'
                }
            };

            const response = await this.pushy.sendPushNotification(
                data,
                deviceTokens,
                options
            );

            return {
                success: true,
                id: response.id,
                info: response.info
            };
        } catch (error: any) {
            console.error(`❌ Failed to send push notification to ${deviceTokens.length} device(s)`);
            console.error(`   Tenant ID: ${tenantId}, Notification: ${notificationData.title}`);
            console.error(`   Device Tokens: ${deviceTokens.slice(0, 3).join(', ')}${deviceTokens.length > 3 ? '...' : ''}`);
            console.error(`   Error:`, error.message || error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
            };
        }
    }

    public async getDeviceTopics(deviceToken: string): Promise<string[]> {
        await this.initialize();

        try {
            const deviceInfo = await this.pushy.getDeviceInfo(deviceToken);
            return deviceInfo.topics || [];
        } catch (error: any) {
            console.error(`Failed to get device topics ${deviceToken}:`, error);
            return [];
        }
    }

    public async unsubscribeDeviceFromAllTopics(deviceToken: string): Promise<PushyResponse> {
        await this.initialize();

        if (!deviceToken) {
            return {
                success: false,
                error: 'Device token is required'
            };
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
                    await this.pushy.unsubscribe(deviceToken, topic);
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

    public async debugTopicSubscriptions(tenantId: number): Promise<any> {
        await this.initialize();

        try {
            const { getGlobalPrisma } = require('../db');
            const globalPrisma = getGlobalPrisma();

            // Get all active devices for this tenant
            const devices = await globalPrisma.pushyDevice.findMany({
                where: {
                    tenantUser: {
                        tenantId
                    },
                    isActive: true
                },
                include: {
                    tenantUser: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            console.log(`\n📊 DEBUG: Topic Subscriptions for Tenant ${tenantId}`);
            console.log(`Found ${devices.length} active device(s)\n`);

            const subscriptionData = [];

            for (const device of devices) {
                try {
                    const topics = await this.getDeviceTopics(device.deviceToken);
                    const deviceInfo = {
                        username: device.tenantUser.username,
                        platform: device.platform,
                        deviceName: device.deviceName || 'Unknown',
                        deviceToken: device.deviceToken.substring(0, 20) + '...',
                        subscribedTopics: topics,
                        topicCount: topics.length
                    };

                    subscriptionData.push(deviceInfo);

                    console.log(`👤 User: ${device.tenantUser.username} (${device.platform})`);
                    console.log(`   Device: ${device.deviceName || 'Unknown'}`);
                    console.log(`   Topics (${topics.length}):`);
                    if (topics.length > 0) {
                        topics.forEach(topic => console.log(`      ✅ ${topic}`));
                    } else {
                        console.log(`      ⚠️  No topic subscriptions`);
                    }
                    console.log('');
                } catch (error: any) {
                    console.error(`   ❌ Failed to get topics for ${device.tenantUser.username}:`, error.message);
                }
            }

            return {
                success: true,
                tenantId,
                totalDevices: devices.length,
                devices: subscriptionData
            };
        } catch (error: any) {
            console.error('Failed to debug topic subscriptions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default PushyService.getInstance();
