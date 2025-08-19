import { Invoice, StockBalance } from "@tenant-prisma"

interface InvoiceItemInput {
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

export interface InvoiceInput {
    id?: number;
    invoiceNumber: string;
    taxInvoiceNumber?: string;
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
    status: string;
    invoiceDate?: Date;
    paymentDate?: Date;
    dueDate?: Date;
    remark?: string;
    performedBy?: string;
    invoiceItems?: InvoiceItemInput[]; // Add items here
}

export interface CreateInvoiceRequestBody {
    invoices: InvoiceInput[];
}