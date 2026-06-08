import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface PurchaseReturnItemInput {
    id?: number;
    itemId: number;
    itemVariantId?: number | null;
    variantSku?: string | null;
    variantName?: string | null;
    quantity: PrismaDecimal | number;
    unitPrice: PrismaDecimal | number;
    returnReason: string; // DEFECT, SPOILT, BROKEN, WRONG_ITEM, OTHER
    remark?: string;
}

export interface PurchaseReturnInput {
    id?: number;
    returnNumber: string;
    invoiceId: number;
    outletId: number;
    supplierId: number;
    returnDate: Date | string;
    status?: string; // COMPLETED, CANCELLED
    totalReturnAmount?: PrismaDecimal | number;
    remark?: string;
    performedBy?: string;
    // Terminal attribution — the terminal that created/updated this purchase
    // return (RegisteredDevice.siteId). Stamped on the resulting stock movements.
    siteId?: number;
    purchaseReturnItems?: PurchaseReturnItemInput[];
}

export interface CreatePurchaseReturnRequestBody {
    purchaseReturns: PurchaseReturnInput[];
}

export interface CancelPurchaseReturnInput {
    cancelReason?: string;
    performedBy?: string;
    // Terminal attribution — the terminal that cancelled this return.
    siteId?: number;
    cancelledAt?: Date | string;
}

export interface PurchaseReturnSyncRequest {
    outletId?: string;
    skip?: number;
    take?: number;
    lastSyncTimestamp?: string;
    startDate?: string;
    endDate?: string;
}
