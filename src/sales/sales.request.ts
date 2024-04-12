import { Payment, Sales, SalesItem } from "@prisma/client"
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

export interface CompleteSalesRquestBody {
    salesId: number,
    payments: Payment[]
}

export interface CompleteNewSalesRquestBody {
    sales: CreateSalesRequestBody,
    payments: Payment[]
}