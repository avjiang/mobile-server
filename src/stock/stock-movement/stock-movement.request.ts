import { StockMovement } from "../../../prisma/client/generated/client"

export interface CreateStockChecksRequestBody {
    stockChecks: StockMovement[]
}

export interface UpdateStockChecksRequestBody {
    stockChecks: StockMovement[]
}