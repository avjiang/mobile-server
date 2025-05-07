import { BaseError, ResponseError } from './error'

export default class NetworkResponse<T> {
    success: boolean;
    data?: T;
    error?: ResponseError;
    total?: number;
    serverTimestamp?: string;

    constructor(success: boolean, dataOrError: T | ResponseError) {
        this.success = success;
        if (dataOrError instanceof ResponseError) {
            this.error = dataOrError as ResponseError;
        } else {
            const dataWithExtras = dataOrError as T & { data?: any; items?: any; total?: number; serverTimestamp?: string };

            // Handle primitive values (number, string, boolean, etc.)
            if (!dataWithExtras || (typeof dataWithExtras !== 'object' && !Array.isArray(dataWithExtras))) {
                this.data = dataWithExtras as T;
            }
            // Check if dataWithExtras has a data property
            else if ('data' in dataWithExtras && dataWithExtras.data !== undefined) {
                this.data = dataWithExtras.data as T;
                if (typeof dataWithExtras.total === 'number') {
                    this.total = dataWithExtras.total;
                }
                if (typeof dataWithExtras.serverTimestamp === 'string') {
                    this.serverTimestamp = dataWithExtras.serverTimestamp;
                }
            }
            // Check if dataWithExtras has an items property
            else if (dataWithExtras.items && Array.isArray(dataWithExtras.items)) {
                this.data = dataWithExtras.items as T;
                if (typeof dataWithExtras.total === 'number') {
                    this.total = dataWithExtras.total;
                }
                if (typeof dataWithExtras.serverTimestamp === 'string') {
                    this.serverTimestamp = dataWithExtras.serverTimestamp;
                }
            }
            // Check if dataWithExtras is an array
            else if (Array.isArray(dataWithExtras)) {
                this.data = dataWithExtras as T;
            }
            // Handle other objects
            else if (dataWithExtras && typeof dataWithExtras === 'object') {
                const { total, serverTimestamp, ...cleanedData } = dataWithExtras;
                if (typeof total === 'number') {
                    this.total = total;
                }
                if (typeof serverTimestamp === 'string') {
                    this.serverTimestamp = serverTimestamp;
                }
                this.data = cleanedData as T;
            }
        }
    }
}