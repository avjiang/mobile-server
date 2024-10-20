export interface OpenSessionRequest {
    outletId: number,
    businessDate: Date,
    openingDateTime: Date,
    openingAmount: number,
    openByUserID: number
}

export interface CloseSessionRequest {
    id: number,
    closingDateTime: Date,
    totalSalesCount: number,
    closeByUserID: number
}