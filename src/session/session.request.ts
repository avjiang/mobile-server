export interface OpenSessionRequest {
    outletId: number,
    businessDate: Date,
    openingDateTime: Date,
    openingAmount: number,
    openByUserID: number,
    // Terminal attribution — the terminal that opened this session
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number
}

export interface CloseSessionRequest {
    id: number,
    closingDateTime: Date,
    totalSalesCount: number,
    closeByUserID: number,
    // Terminal attribution — the terminal that closed this session
    // (RegisteredDevice.siteId). Optional; nullable on the column.
    siteId?: number
}