export interface StockReceiptInput {
    id: number;
    itemId?: number;
    outletId?: number;
    quantity?: number;
    cost?: number;
    receiptDate?: Date;
    version?: number;
}
