import { Setting } from "../../prisma/client/generated/client";
import { SettingDefinition } from "../../prisma/global-client/generated/global";

export interface SyncSettingsRequest {
    lastSyncTimestamp?: string;
    outletId?: number;
    userId?: number;
    skip?: number;
    take?: number;
}

export interface UpdateSettingRequest {
    id?: number; // Optional - will create if not provided
    settingDefinitionId?: number; // Required when creating new setting
    value: string;
    outletId?: number;
    userId?: number;
    tenantId?: number;
}

export interface BatchUpdateSettingsRequest {
    settings: UpdateSettingRequest[];
}
