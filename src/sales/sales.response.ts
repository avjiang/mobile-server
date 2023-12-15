import { Sales, SalesItem } from "@prisma/client"
import { CalculateSalesObject } from "./sales.model"

export interface SalesResponseBody {
    sales: Sales & { items: SalesItem[] }
}

export interface CalculateSalesResponseBody {
    sales: CalculateSalesObject
}