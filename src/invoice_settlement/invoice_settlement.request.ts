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
    // Terminal attribution — the terminal that created/edited this settlement
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number;
    totalRebateAmount?: number;
    rebateReason?: string;
    totalInvoiceCount?: number;
    totalInvoiceAmount?: number;
    // Partial-payment support: amount being paid NOW (down payment). Defaults to
    // settlementAmount (full payment). Must be > 0 and <= settlementAmount.
    paidAmount?: number;
    // Bank/transfer fee for the initial payment (bookkeeping only — not applied
    // against the invoice balance).
    transferFeeAmount?: number;
    invoiceIds: number[]; // Array of invoice IDs to settle
    invoiceTaxNumbers: number[]; // Array of tax invoice numbers corresponding to invoiceIds (same order)
}

// Body of POST /invoiceSettlement/:id/payment — a subsequent payment against a
// partially-paid settlement.
export interface AddSettlementPaymentInput {
    paymentDate: Date;
    paymentMethod?: string;
    amount: number;
    transferFeeAmount?: number;
    reference?: string;
    remark?: string;
    performedBy?: string;
    siteId?: number;
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