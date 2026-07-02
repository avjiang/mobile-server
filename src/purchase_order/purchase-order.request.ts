import { PurchaseOrder, StockBalance } from "../../prisma/client/generated/client"
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface PurchaseOrderItemInput {
    id?: number; // Add id for updates
    itemId: number;
    itemVariantId?: number | null;
    variantSku?: string | null;
    variantName?: string | null;
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
    quotationId?: number; // Optional field
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
    // Terminal attribution — the terminal that created/edited this PO
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number;
    // PO down payment (supplier advance). downPaymentPercentage = draw rate (snapshot from supplier, editable).
    // initialDownPayment = optional first DP payment captured on the PO creation form.
    downPaymentPercentage?: number;
    initialDownPayment?: DownPaymentInput;
    purchaseOrderItems?: PurchaseOrderItemInput[]; // Add items here
}

// Body of POST /purchaseOrder/:id/downPayment, and the optional initial DP captured at PO creation.
export interface DownPaymentInput {
    paymentDate: Date;
    paymentMethod?: string;
    amount: number;
    transferFeeAmount?: number;
    reference?: string;
    remark?: string;
    performedBy?: string;
    siteId?: number;
    // Optional draw rate to set on the PO alongside this payment — used when adding the
    // first down payment to a PO that was created without a rate (so future invoices draw).
    downPaymentPercentage?: number;
}

export interface CreatePurchaseOrderRequestBody {
    purchaseOrders: PurchaseOrderInput[];
}