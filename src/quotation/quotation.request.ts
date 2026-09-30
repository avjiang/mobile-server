import { Quotation, StockBalance } from "../../prisma/client/generated/client"
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface QuotationItemInput {
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
    leadTime?: number; // Lead time in days
    isAccepted?: boolean; // Whether this item was accepted
}

export interface QuotationInput {
    id?: number; // Optional for creation, required for updates
    // Server-assigned on create ({QT}-OUT{outletId}-{yyyyMMdd}-{seq}) and immutable;
    // any client-sent value is ignored on create and update.
    quotationNumber?: string;
    outletId: number;
    supplierId: number;
    sessionId?: number; // Optional for backwards compatibility
    quotationDate?: Date;
    validUntilDate?: Date;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount?: PrismaDecimal;
    serviceChargeAmount?: PrismaDecimal;
    taxAmount?: PrismaDecimal;
    roundingAmount?: PrismaDecimal;
    isTaxInclusive?: boolean;
    subtotalAmount?: PrismaDecimal;
    totalAmount?: PrismaDecimal;
    status?: string;
    remark?: string;
    currency?: string;
    performedBy?: string;
    // Terminal attribution — the terminal that created/edited this quotation
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number;
    convertedToPOAt?: Date; // When converted to Purchase Order
    convertedPOId?: number; // Reference to created Purchase Order
    quotationItems?: QuotationItemInput[]; // Add items here
}

export interface CreateQuotationRequestBody {
    quotations: QuotationInput[];
    // Client's UTC offset in minutes for the yyyyMMdd part of the assigned numbers.
    // Optional; defaults to 420 (WIB).
    utcOffsetMinutes?: number;
}