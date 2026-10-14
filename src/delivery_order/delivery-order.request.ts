import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface DeliveryOrderItemInput {
    id?: number; // Add id for updates
    itemId: number;
    itemVariantId?: number | null;
    variantSku?: string | null;
    variantName?: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice?: PrismaDecimal;
    deliveryFee?: PrismaDecimal;
    remark?: string;
}

export interface DeliveryOrderInput {
    id?: number; // Optional for creation, required for updates
    outletId: number;
    customerId?: number;
    purchaseOrderId?: number;
    supplierId?: number;
    sessionId?: number; // Optional for backwards compatibility
    deliveryDate?: Date;
    deliveryStreet?: string;
    deliveryCity?: string;
    deliveryState?: string;
    deliveryPostalCode?: string;
    deliveryCountry?: string;
    // The DO number. Server-assigned on create ({DO}-OUT{outletId}-{yyyyMMdd}-{seq})
    // and immutable; any client-sent value is ignored on create and update.
    trackingNumber?: string;
    // The supplier's delivery-note number. Optional free text; on update a missing
    // key keeps the stored value, null/"" clears it.
    supplierReference?: string | null;
    status?: string;
    remark?: string;
    performedBy?: string;
    // Terminal attribution — the terminal that received/edited this delivery
    // order (RegisteredDevice.siteId). Stamped on the resulting stock movements.
    siteId?: number;
    // Goods-receipt destination (Pro warehouse feature). 'OUTLET' (default) receives
    // into outletId; 'WAREHOUSE' receives into warehouseId instead.
    destinationLocationType?: string;
    warehouseId?: number;
    deliveryOrderItems?: DeliveryOrderItemInput[]; // Add items here
}

export interface CreateDeliveryOrderRequestBody {
    deliveryOrders: DeliveryOrderInput[];
    // Client's UTC offset in minutes for the yyyyMMdd part of the assigned numbers.
    // Optional; defaults to 420 (WIB).
    utcOffsetMinutes?: number;
}