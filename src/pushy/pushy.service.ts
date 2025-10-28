import Pushy from 'pushy';
import PlanCheckService from './plan-check.service';

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

            const response = await this.pushy.sendPushNotification(
                data,
                [topic],
                options
            );

            return {
                success: true,
                id: response.id,
                info: response.info
            };
        } catch (error: any) {
            console.error('Failed to send push notification to topic:', error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
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
            console.error('Failed to send push notification to devices:', error);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
            };
        }
    }
}

export default PushyService.getInstance();
