import { Invoice, StockBalance } from "@prisma/client"

interface InvoiceItemInput {
    id?: number; // Add id for updates
    itemId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    remark?: string;
}

export interface InvoiceInput {
    id?: number; // Optional for creation, required for updates
    invoiceNumber: string;
    purchaseOrderId?: number;
    deliveryOrderId?: number;
    supplierId?: number;
    outletId: number;
    subtotalAmount: number;
    taxAmount: number;
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