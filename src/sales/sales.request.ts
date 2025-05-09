import { Payment, Sales, SalesItem } from "@prisma/client"
import { Expose, Type } from 'class-transformer';

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

export interface SalesRequestBody {
    sales: Sales & { items: SalesItem[] }
}

export class CreateSalesRequest {
    @Expose() id: number = 0;
    // @Expose() created: Date | undefined;
    @Expose() outletId: number = 0;
    @Expose() businessDate: Date = new Date();
    @Expose() salesType: string = "";
    @Expose() customerId?: number;
    @Expose() billStreet: string | undefined;
    @Expose() billCity: string | undefined;
    @Expose() billState: string | undefined;
    @Expose() billPostalCode: string | undefined;
    @Expose() billCountry: string | undefined;
    @Expose() shipStreet: string | undefined;
    @Expose() shipCity: string | undefined;
    @Expose() shipState: string | undefined;
    @Expose() shipPostalCode: string | undefined;
    @Expose() shipCountry: string | undefined;
    @Expose() totalItemDiscountAmount: number | undefined;
    @Expose() discountPercentage: number | undefined;
    @Expose() discountAmount: number | undefined;
    @Expose() profitAmount: number = 0;
    @Expose() serviceChargeAmount: number | undefined;
    @Expose() taxAmount: number | undefined;
    @Expose() roundingAmount: number | undefined;
    @Expose() subtotalAmount: number = 0;
    @Expose() totalAmount: number = 0;
    @Expose() paidAmount: number | undefined;
    @Expose() changeAmount: number | undefined;
    @Expose() status: string = "";
    @Expose() remark: string | undefined;
    @Expose() declarationSessionId: number = 0;
    @Expose() eodId: number = 0;
    @Expose() salesQuotationId: number | undefined;
    @Expose() performedBy: number = 0;
    @Expose() deleted: boolean | undefined;
    @Expose()
    @Type(() => CreateSalesItemRequest)
    salesItems: CreateSalesItemRequest[] = [];
}

export class SalesCreationRequest {
    @Expose()
    @Type(() => CreateSalesRequest)
    sales: CreateSalesRequest = new CreateSalesRequest();
}

export class CreateSalesItemRequest {
    @Expose() id: number = 0;
    // @Expose() created: Date | undefined;
    @Expose() salesId: number = 0;
    @Expose() itemId: number = 0;
    @Expose() itemCode: string = "";
    @Expose() itemName: string = "";
    @Expose() itemBrand: string = "";
    @Expose() quantity: number = 0;
    @Expose() cost: number = 0;
    @Expose() price: number = 0;
    @Expose() profit: number = 0;
    @Expose() discountPercentage: number | undefined;
    @Expose() discountAmount: number | undefined;
    @Expose() serviceChargeAmount: number | undefined;
    @Expose() taxAmount: number | undefined;
    @Expose() subtotalAmount: number = 0;
    @Expose() remark: string | undefined;
    @Expose() deleted: boolean | undefined;
}

export class CalculateSalesObject {
    @Expose() discountBy: DiscountBy = DiscountBy.None
    @Expose() discountPercentage: number = 0
    @Expose() discountAmount: number = 0
    @Expose() totalItemDiscountAmount: number = 0
    @Expose() serviceChargeAmount: number = 0
    @Expose() taxAmount: number = 0
    @Expose() roundingAmount: number = 0
    @Expose() subtotalAmount: number = 0
    @Expose() totalAmount: number = 0
    @Type(() => CalculateSalesItemObject)
    @Expose() salesItems: CalculateSalesItemObject[] = []
}

export class CalculateSalesItemObject {
    @Expose() itemId: number = 0
    @Expose() price: number = 0
    @Expose() quantity: number = 0
    @Expose() discountType: DiscountType = DiscountType.None
    @Expose() discountBy: DiscountBy = DiscountBy.None
    @Expose() discountPercentage: number = 0
    @Expose() discountAmount: number = 0
    @Expose() subtotalAmount: number = 0
}

export class CalculateSalesDto {
    @Expose()
    @Type(() => CalculateSalesObject)
    sales: CalculateSalesObject = new CalculateSalesObject();
}

export class CompleteSalesRequest {
    @Expose()
    salesId: number = 0;
    @Expose()
    payments: Payment[] = [];
}

export class CompleteNewSalesRequest {
    @Expose()
    @Type(() => CreateSalesRequest)
    sales: CreateSalesRequest = new CreateSalesRequest();
    @Expose()
    payments: Payment[] = [];
}

