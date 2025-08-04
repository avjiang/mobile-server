import { StockMovement } from "prisma/client"

export interface CreateStockChecksRequestBody {
    stockChecks: StockMovement[]
}

export interface UpdateStockChecksRequestBody {
    stockChecks: StockMovement[]
}