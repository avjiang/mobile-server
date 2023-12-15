import { Sales, SalesItem } from "@prisma/client"
import { CalculateSalesObject, CreateSalesRequestBody, DiscountBy, DiscountType } from "./sales.model"

export interface SalesRequestBody {
    sales: Sales & { items: SalesItem[] }
}

export interface SalesCreationRequestBody {
    sales: CreateSalesRequestBody
}

export interface CalculateSalesRequestBody {
    sales: CalculateSalesObject
}