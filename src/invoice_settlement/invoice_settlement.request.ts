export interface InvoiceSettlementInput {
    id?: number;
    settlementNumber: string;
    settlementDate: Date;
    settlementType: string; // e.g., "PARTIAL", "FULL", "BULK"
    paymentMethod?: string; // e.g., "CASH", "BANK_TRANSFER", "CHEQUE"
    settlementAmount: number;
    currency: string;
    exchangeRate?: number;
    reference?: string;
    remark?: string;
    status?: string; // e.g., "COMPLETED", "PENDING", "CANCELLED"
    performedBy?: string;
    totalRebateAmount?: number;
    rebateReason?: string;
    totalInvoiceCount?: number;
    totalInvoiceAmount?: number;
    invoiceIds: number[]; // Array of invoice IDs to settle
    invoiceTaxNumbers: number[]; // Array of tax invoice numbers corresponding to invoiceIds (same order)
}

export interface CreateInvoiceSettlementRequestBody {
    settlements: InvoiceSettlementInput[];
}

export interface SettlementSyncRequest {
    skip?: number;
    take?: number;
    lastSyncTimestamp?: string;
    startDate?: string;
    endDate?: string;
}