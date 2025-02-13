import { Sales, SalesItem } from "@prisma/client"
import { Expose } from "class-transformer"

export interface SalesResponseBody {
    sales: Sales & { items: SalesItem[] }
}

export class SalesAnalyticResponseBody {
    @Expose() salesCount: number = 0
    @Expose() totalProfit: number = 0
    @Expose() totalRevenue: number = 0
}