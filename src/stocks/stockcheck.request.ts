import { StockCheck } from "@prisma/client"

export interface CreateStockChecksRequestBody {
    stockChecks: StockCheck[]
}

export interface UpdateStockChecksRequestBody {
    stockChecks: StockCheck[]
}