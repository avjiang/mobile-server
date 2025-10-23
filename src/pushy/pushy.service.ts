import Pushy from 'pushy';

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
        notificationData: NotificationData
    ): Promise<PushyResponse> {
        await this.initialize();

        try {
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
        notificationData: NotificationData
    ): Promise<PushyResponse> {
        await this.initialize();

        if (!deviceTokens || deviceTokens.length === 0) {
            return {
                success: false,
                error: 'No device tokens provided'
            };
        }

        try {
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

    // public async subscribeToTopics(
    //     deviceToken: string,
    //     topics: string[]
    // ): Promise<PushyResponse> {
    //     await this.initialize();

    //     if (!topics || topics.length === 0) {
    //         return {
    //             success: false,
    //             error: 'No topics provided'
    //         };
    //     }

    //     try {
    //         const subscribePromises = topics.map(topic =>
    //             this.pushy.subscribe(topic, deviceToken)
    //         );

    //         await Promise.all(subscribePromises);

    //         return {
    //             success: true,
    //             info: `Subscribed to ${topics.length} topics`
    //         };
    //     } catch (error: any) {
    //         console.error('Failed to subscribe to topics:', error);
    //         return {
    //             success: false,
    //             error: error.message || 'Failed to subscribe to topics'
    //         };
    //     }
    // }

    // public async unsubscribeFromTopics(
    //     deviceToken: string,
    //     topics: string[]
    // ): Promise<PushyResponse> {
    //     await this.initialize();

    //     if (!topics || topics.length === 0) {
    //         return {
    //             success: false,
    //             error: 'No topics provided'
    //         };
    //     }

    //     try {
    //         const unsubscribePromises = topics.map(topic =>
    //             this.pushy.unsubscribe(topic, deviceToken)
    //         );

    //         await Promise.all(unsubscribePromises);

    //         return {
    //             success: true,
    //             info: `Unsubscribed from ${topics.length} topics`
    //         };
    //     } catch (error: any) {
    //         console.error('Failed to unsubscribe from topics:', error);
    //         return {
    //             success: false,
    //             error: error.message || 'Failed to unsubscribe from topics'
    //         };
    //     }
    // }

    // public async getDeviceInfo(deviceToken: string): Promise<any> {
    //     await this.initialize();

    //     try {
    //         const info = await this.pushy.getDeviceInfo(deviceToken);
    //         return {
    //             success: true,
    //             data: info
    //         };
    //     } catch (error: any) {
    //         console.error('Failed to get device info:', error);
    //         return {
    //             success: false,
    //             error: error.message || 'Failed to get device info'
    //         };
    //     }
    // }

    // public async getDeviceSubscriptions(deviceToken: string): Promise<any> {
    //     await this.initialize();

    //     try {
    //         const subscriptions = await this.pushy.getDeviceSubscriptions(deviceToken);
    //         return {
    //             success: true,
    //             data: subscriptions
    //         };
    //     } catch (error: any) {
    //         console.error('Failed to get device subscriptions:', error);
    //         return {
    //             success: false,
    //             error: error.message || 'Failed to get device subscriptions'
    //         };
    //     }
    // }
}

export default PushyService.getInstance();
