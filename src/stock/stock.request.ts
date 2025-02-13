import { Stock } from "@prisma/client"

export interface CreateStocksRequestBody {
    stocks: Stock[]
}

export interface UpdateStocksRequestBody {
    stocks: Stock[]
}

export interface StockAdjustmentRequestBody {
    stockAdjustments: StockAdjustment[]
}

export interface StockAdjustment {
    itemId: number,
    adjustQuantity: number,
    outletId: number,
    reason: string,
    remark: string
}