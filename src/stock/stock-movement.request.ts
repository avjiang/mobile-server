import { StockMovement } from "@prisma/tenant-prisma"

export interface CreateStockChecksRequestBody {
    stockChecks: StockMovement[]
}

export interface UpdateStockChecksRequestBody {
    stockChecks: StockMovement[]
}