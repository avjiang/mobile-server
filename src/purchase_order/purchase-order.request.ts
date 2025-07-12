import { PurchaseOrder, StockBalance } from "@prisma/client"

interface PurchaseOrderItemInput {
    id?: number; // Add id for updates
    itemId: number;
    quantity: number;
    unitPrice: number;
    taxAmount?: number;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount: number;
    subtotal: number;
    remark?: string;
}

export interface PurchaseOrderInput {
    id?: number; // Optional for creation, required for updates
    purchaseOrderNumber: string;
    outletId: number;
    supplierId: number;
    sessionId?: number; // Optional for backwards compatibility
    purchaseOrderDate?: Date;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount?: number;
    serviceChargeAmount?: number;
    taxAmount?: number;
    roundingAmount?: number;
    subtotalAmount: number;
    totalAmount: number;
    status?: string;
    remark?: string;
    currency?: string;
    performedBy?: string;
    purchaseOrderItems?: PurchaseOrderItemInput[]; // Add items here
}

export interface CreatePurchaseOrderRequestBody {
    purchaseOrders: PurchaseOrderInput[];
}