export interface InvoiceSettlementInput {
    id?: number;
    // Server-assigned on create ({SET}-OUT{outletId}-{yyyyMMdd}-{seq}, outlet = the
    // outlet of the settlement's lowest-id invoice) and immutable; any client-sent
    // value is ignored on create and update.
    settlementNumber?: string;
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
    // settlementAmount (full payment). Must be > 0 and <= settlementAmount — except a
    // settlement fully offset by rebate / PO down payment (settlementAmount 0), which
    // settles with paidAmount 0 and no payment ledger row.
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
    // Client's UTC offset in minutes for the yyyyMMdd part of the assigned numbers.
    // Optional; defaults to 420 (WIB).
    utcOffsetMinutes?: number;
}

export interface SettlementSyncRequest {
    skip?: number;
    take?: number;
    lastSyncTimestamp?: string;
    startDate?: string;
    endDate?: string;
}