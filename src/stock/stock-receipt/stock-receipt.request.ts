export interface StockReceiptInput {
    id: number;
    itemId?: number;
    itemVariantId?: number | null;  // For variant items
    outletId?: number;
    quantity?: number;
    cost?: number;
    receiptDate?: Date;
    version?: number;
}

export interface StockReceiptsRequestBody {
    stockReceipts: StockReceiptInput[]
}
