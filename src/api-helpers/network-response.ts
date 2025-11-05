import { BaseError, ResponseError, VersionMismatchError } from './error'

export default class NetworkResponse<T> {
    success: boolean;
    data?: T;
    error?: ResponseError;
    total?: number;
    serverTimestamp?: string;
    notificationTopics?: string[];

    constructor(success: boolean, dataOrError: T | ResponseError) {
        this.success = success;

        if (!success && dataOrError instanceof ResponseError) {
            this.error = dataOrError;
        } else if (success) {
            const dataWithExtras = dataOrError as T & { data?: any; items?: any; total?: number; serverTimestamp?: string; notificationTopics?: string[] };

            if (!dataWithExtras || (typeof dataWithExtras !== 'object' && !Array.isArray(dataWithExtras))) {
                this.data = dataWithExtras as T;
            } else if ('data' in dataWithExtras && dataWithExtras.data !== undefined) {
                this.data = dataWithExtras.data as T;
                if (typeof dataWithExtras.total === 'number') {
                    this.total = dataWithExtras.total;
                }
                if (typeof dataWithExtras.serverTimestamp === 'string') {
                    this.serverTimestamp = dataWithExtras.serverTimestamp;
                }
                if (Array.isArray(dataWithExtras.notificationTopics)) {
                    this.notificationTopics = dataWithExtras.notificationTopics;
                }
            } else if (dataWithExtras.items && Array.isArray(dataWithExtras.items)) {
                this.data = dataWithExtras.items as T;
                if (typeof dataWithExtras.total === 'number') {
                    this.total = dataWithExtras.total;
                }
                if (typeof dataWithExtras.serverTimestamp === 'string') {
                    this.serverTimestamp = dataWithExtras.serverTimestamp;
                }
                if (Array.isArray(dataWithExtras.notificationTopics)) {
                    this.notificationTopics = dataWithExtras.notificationTopics;
                }
            } else if (Array.isArray(dataWithExtras)) {
                this.data = dataWithExtras as T;
            } else if (dataWithExtras && typeof dataWithExtras === 'object') {
                const { total, serverTimestamp, notificationTopics, ...cleanedData } = dataWithExtras;
                if (typeof total === 'number') {
                    this.total = total;
                }
                if (typeof serverTimestamp === 'string') {
                    this.serverTimestamp = serverTimestamp;
                }
                if (Array.isArray(notificationTopics)) {
                    this.notificationTopics = notificationTopics;
                }
                this.data = cleanedData as T;
            }
        }
    }
}