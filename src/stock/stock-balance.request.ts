import { StockBalance } from "../../prisma/client"

export interface CreateStocksRequestBody {
    stocks: StockBalance[]
}

export interface UpdateStocksRequestBody {
    stocks: StockBalance[]
}

export interface StockAdjustmentRequestBody {
    stockAdjustments: StockAdjustment[]
}

export interface StockAdjustment {
    itemId: number,
    adjustQuantity?: number,
    overrideQuantity?: number,
    cost: number,
    outletId: number,
    reason: string,
    remark: string,
    version: number,
    performedBy?: string,
}