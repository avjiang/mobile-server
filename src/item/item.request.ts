import { ItemDto } from "./item.response"
import { Expose, Transform, Type } from "class-transformer";

export class CreateItemsRequestBody {
    @Type(() => ItemDto)
    @Expose()
    items: ItemDto[] = []
}

export interface SyncRequest {
    outletId?: string;
    lastSyncTimestamp?: string; // ISO timestamp (e.g., "2025-05-06T12:00:00Z")
    lastVersion?: number; // Optional: Use version instead of timestamp
    skip?: number; // For pagination
    take?: number; // For pagination
}