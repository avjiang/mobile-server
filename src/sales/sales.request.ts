import { Payment, Sales, SalesItem } from "prisma/client";
import { Decimal as PrismaDecimal } from "prisma/client/runtime/library";
import { Expose, Type } from "class-transformer";
import Decimal from "decimal.js";

export enum DiscountBy {
    None = 0,
    Percentage = 1,
    Amount = 2,
}

export enum DiscountType {
    None = 0,
    Promotion = 1,
    Manual = 2,
}

export interface SalesRequestBody {
    sales: Sales & { items: SalesItem[] };
}

export class CreateSalesRequest {
    @Expose() id: number = 0;
    @Expose() outletId: number = 0;
    @Expose() businessDate: Date = new Date();
    @Expose() salesType: string = "";
    @Expose() customerId?: number;
    @Expose() customerName: string | undefined;
    @Expose() phoneNumber?: string;
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
    @Expose() totalItemDiscountAmount: PrismaDecimal | undefined;
    @Expose() discountPercentage: PrismaDecimal | undefined;
    @Expose() discountAmount: PrismaDecimal | undefined;
    @Expose() profitAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() serviceChargeAmount: PrismaDecimal | undefined;
    @Expose() taxAmount: PrismaDecimal | undefined;
    @Expose() roundingAmount: PrismaDecimal | undefined;
    @Expose() subtotalAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() totalAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() paidAmount: PrismaDecimal | undefined;
    @Expose() changeAmount: PrismaDecimal | undefined;
    @Expose() status: string = "";
    @Expose() remark: string | undefined;
    @Expose() sessionId: number = 0;
    @Expose() eodId: number = 0;
    @Expose() salesQuotationId: number | undefined;
    @Expose() performedBy: string = "";
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
    @Expose() salesId: number = 0;
    @Expose() itemId: number = 0;
    @Expose() itemCode: string = "";
    @Expose() itemName: string = "";
    @Expose() itemBrand: string = "";
    @Expose() itemModel: string = "";
    @Expose() quantity: PrismaDecimal = new PrismaDecimal(0);
    @Expose() cost: PrismaDecimal = new PrismaDecimal(0);
    @Expose() price: PrismaDecimal = new PrismaDecimal(0);
    @Expose() priceBeforeTax: PrismaDecimal = new PrismaDecimal(0);
    @Expose() profit: PrismaDecimal = new PrismaDecimal(0);
    @Expose() discountPercentage: PrismaDecimal | undefined;
    @Expose() discountAmount: PrismaDecimal | undefined;
    @Expose() serviceChargeAmount: PrismaDecimal | undefined;
    @Expose() taxAmount: PrismaDecimal | undefined;
    @Expose() subtotalAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() remark: string | undefined;
    @Expose() deleted: boolean | undefined;
}

export class CalculateSalesObject {
    @Expose() discountBy: DiscountBy = DiscountBy.None;
    @Expose() discountPercentage: Decimal = new Decimal(0);
    @Expose() discountAmount: Decimal = new Decimal(0);
    @Expose() totalItemDiscountAmount: Decimal = new Decimal(0);
    @Expose() serviceChargeAmount: Decimal = new Decimal(0);
    @Expose() taxAmount: Decimal = new Decimal(0);
    @Expose() roundingAmount: Decimal = new Decimal(0);
    @Expose() subtotalAmount: Decimal = new Decimal(0);
    @Expose() totalAmount: Decimal = new Decimal(0);
    @Type(() => CalculateSalesItemObject)
    @Expose() salesItems: CalculateSalesItemObject[] = [];
}

export class CalculateSalesItemObject {
    @Expose() itemId: number = 0;
    @Expose() price: Decimal = new Decimal(0);
    @Expose() quantity: Decimal = new Decimal(0);
    @Expose() discountType: DiscountType = DiscountType.None;
    @Expose() discountBy: DiscountBy = DiscountBy.None;
    @Expose() discountPercentage: Decimal = new Decimal(0);
    @Expose() discountAmount: Decimal = new Decimal(0);
    @Expose() subtotalAmount: Decimal = new Decimal(0);
}

export class CalculateSalesDto {
    @Expose()
    @Type(() => CalculateSalesObject)
    sales: CalculateSalesObject = new CalculateSalesObject();
}

export class CompleteSalesRequest {
    @Expose() salesId: number = 0;
    @Expose() payments: Payment[] = [];
}

export class CompleteNewSalesRequest {
    @Expose()
    @Type(() => CreateSalesRequest)
    sales: CreateSalesRequest = new CreateSalesRequest();
    @Expose() payments: Payment[] = [];
}