export enum DiscountBy {
    None = 0,
    Percentage = 1,
    Amount = 2
}

export enum DiscountType {
    None = 0,
    Promotion = 1,
    Manual = 2,
}

export interface CalculateSalesObject {
    discountBy: DiscountBy,
    discountPercentage: number,
    discountAmount: number,
    totalItemDiscountAmount: number,
    serviceChargeAmount: number,
    taxAmount: number,
    roundingAmount: number,
    subtotalAmount: number,
    totalAmount: number,
    items: CalculateSalesItemObject[]
}

export interface CalculateSalesItemObject {
    itemId: number,
    price: number,
    quantity: number,
    discountType: DiscountType,
    discountBy: DiscountBy,
    discountPercentage: number,
    discountAmount: number,
    subtotalAmount: number
}

export interface CreateSalesRequestBody {
    id: number
    created: Date
    outletId: number
    businessDate: Date
    salesType: string | null
    customerId: number
    billStreet: string | null
    billCity: string | null
    billState: string | null
    billPostalCode: string | null
    billCountry: string | null
    shipStreet: string | null
    shipCity: string | null
    shipState: string | null
    shipPostalCode: string | null
    shipCountry: string | null
    totalItemDiscountAmount: number
    discountPercentage: number
    discountAmount: number
    profitAmount: number
    serviceChargeAmount: number
    taxAmount: number
    roundingAmount: number
    subtotalAmount: number
    totalAmount: number
    paidAmount: number
    changeAmount: number
    status: string
    remark: string | null
    declarationSessionId: number
    eodId: number
    salesQuotationId: number
    performedBy: number
    deleted: boolean
    items: CreateSalesItemRequestBody[]
}

export interface CreateSalesItemRequestBody {
    id: number
    created: Date
    salesId: number
    itemId: number
    itemCode: string
    itemName: string
    quantity: number
    cost: number
    price: number
    profit: number
    discountPercentage: number
    discountAmount: number
    serviceChargeAmount: number
    taxAmount: number
    subtotalAmount: number
    remark: string | null
    deleted: boolean
}