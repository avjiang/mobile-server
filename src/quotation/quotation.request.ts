import { Quotation, StockBalance } from "../../prisma/client/generated/client"
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

interface QuotationItemInput {
    id?: number; // Add id for updates
    itemId: number;
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
    quotationNumber: string;
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
    convertedToPOAt?: Date; // When converted to Purchase Order
    convertedPOId?: number; // Reference to created Purchase Order
    quotationItems?: QuotationItemInput[]; // Add items here
}

export interface CreateQuotationRequestBody {
    quotations: QuotationInput[];
}