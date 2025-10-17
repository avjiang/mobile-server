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
    key: string;
    value: string;
    outletId?: number;
    userId?: number;
}

export interface SettingsResponse {
    settings: SettingWithDefinition[];
    definitions: SettingDefinition[];
    total: number;
    serverTimestamp: string;
}

export interface SettingWithDefinition extends Setting {
    definition?: SettingDefinition;
}
