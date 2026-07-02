/** Request shapes for warehouse stock operations (receive / adjust / clear). */

export interface WarehouseStockReceiveItem {
    itemId: number;
    itemVariantId?: number | null;
    quantity: number; // must be > 0
    cost?: number; // defaults to item.cost when omitted
    remark?: string;
}

export interface WarehouseStockReceiveBody {
    warehouseId: number;
    items: WarehouseStockReceiveItem[];
    reason?: string;
    performedBy?: string | null;
}

export interface WarehouseStockAdjustment {
    warehouseId: number;
    itemId: number;
    itemVariantId?: number | null;
    adjustQuantity?: number; // delta (+/-)
    overrideQuantity?: number; // absolute level
    cost?: number; // for inbound layers; defaults to item.cost
    reason?: string;
    remark?: string;
    performedBy?: string | null;
}

export interface WarehouseStockAdjustmentRequestBody {
    adjustments: WarehouseStockAdjustment[];
}

export interface WarehouseStockClearance {
    warehouseId: number;
    itemId: number;
    itemVariantId?: number | null;
    reason?: string;
    remark?: string;
    performedBy?: string | null;
}
