import { Sales, SalesItem } from "@prisma/client"
import { CalculateSalesObject } from "./sales.model"

export interface SalesResponseBody {
    sales: Sales & { items: SalesItem[] }
}

export interface CalculateSalesResponseBody {
    sales: CalculateSalesObject
}

export interface SalesAnalyticResponseBody {
    salesCount: number,
    totalProfit: number,
    totalRevenue: number
}