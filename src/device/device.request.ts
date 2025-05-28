export interface RegisterDeviceRequest {
    clientDeviceId: string;
    tenantId: number;
    deviceName: string;
    deviceType?: string;
    appVersion?: string;
}
