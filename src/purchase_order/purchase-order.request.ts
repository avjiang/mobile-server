import { PurchaseOrder, StockBalance } from "../../prisma/client/generated/client"
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface PurchaseOrderItemInput {
    id?: number; // Add id for updates
    itemId: number;
    quantity: PrismaDecimal;
    unitPrice: PrismaDecimal;
    taxAmount?: PrismaDecimal;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount: PrismaDecimal;
    subtotal: PrismaDecimal;
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
    discountAmount?: PrismaDecimal;
    serviceChargeAmount?: PrismaDecimal;
    taxAmount?: PrismaDecimal;
    roundingAmount?: PrismaDecimal;
    isTaxInclusive?: boolean;
    subtotalAmount: PrismaDecimal;
    totalAmount: PrismaDecimal;
    status?: string;
    remark?: string;
    currency?: string;
    performedBy?: string;
    purchaseOrderItems?: PurchaseOrderItemInput[]; // Add items here
}

export interface CreatePurchaseOrderRequestBody {
    purchaseOrders: PurchaseOrderInput[];
}