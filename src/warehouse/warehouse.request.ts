// Warehouse request types
export interface CreateWarehouseRequest {
    warehouseName: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    contactPhone?: string;
    contactEmail?: string;
}

export interface UpdateWarehouseRequest {
    id: number;
    warehouseName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    contactPhone?: string;
    contactEmail?: string;
}

export interface SyncWarehouseRequest {
    lastSyncTimestamp?: string;
    skip?: number;
    take?: number;
}

export interface MigrateOutletStockRequest {
    sourceOutletId: number;
    targetWarehouseId: number;
    deleteSourceAfterMigration?: boolean;
    migrationReason?: string;
}
