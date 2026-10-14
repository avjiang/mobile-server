import { Invoice, StockBalance } from "../../prisma/client/generated/client"

interface InvoiceItemInput {
    id?: number; // Add id for updates
    itemId: number;
    itemVariantId?: number | null;
    variantSku?: string | null;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    taxAmount?: number;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount: number;
    subtotal: number;
    remark?: string;
}

export interface InvoiceInput {
    id?: number;
    // Server-assigned on create ({INV}-OUT{outletId}-{yyyyMMdd}-{seq}) and immutable;
    // any client-sent value is ignored on create and update.
    invoiceNumber?: string;
    taxInvoiceNumber?: string;
    // The supplier's invoice number. Optional free text; on update a missing key
    // keeps the stored value, null/"" clears it.
    supplierReference?: string | null;
    purchaseOrderId?: number;
    supplierId?: number;
    sessionId?: number; // Optional for backwards compatibility
    deliveryOrderIds?: number[]; // Changed from deliveryOrderId to deliveryOrderIds array
    outletId: number;
    subtotalAmount: number;
    taxAmount: number;
    discountType?: string; // e.g., 'percentage' or 'fixed'
    discountAmount: number;
    totalAmount: number;
    currency?: string;
    isTaxInclusive?: boolean;
    status: string;
    invoiceDate?: Date;
    paymentDate?: Date;
    dueDate?: Date;
    remark?: string;
    performedBy?: string;
    // Terminal attribution — the terminal that created/edited this invoice
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number;
    // PO down payment is computed + stamped server-side at create time (downPaymentApplied =
    // min(PO.downPaymentPercentage% × totalAmount, PO balance)). Not a client input — present here
    // only so the field is recognized on read/round-trip.
    downPaymentApplied?: number;
    invoiceItems?: InvoiceItemInput[]; // Add items here
}

export interface CreateInvoiceRequestBody {
    invoices: InvoiceInput[];
    // Client's UTC offset in minutes, used for the yyyyMMdd part of the assigned
    // numbers. Optional; defaults to 420 (WIB).
    utcOffsetMinutes?: number;
}