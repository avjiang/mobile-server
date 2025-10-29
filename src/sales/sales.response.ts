import { Sales, SalesItem } from "../../prisma/client/generated/client"
import { Expose, Type } from "class-transformer"
import { Decimal } from 'decimal.js';
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

export interface SalesResponseBody {
    sales: Sales & { items: SalesItem[] }
}

export class SalesAnalyticResponseBody {
    @Expose() salesCount: Decimal = new Decimal(0);
    @Expose() totalProfit: Decimal = new Decimal(0);
    @Expose() totalRevenue: Decimal = new Decimal(0);
}

export class DeliveryListItemResponse {
    @Expose() id: number = 0;
    @Expose() businessDate: Date = new Date();
    @Expose() customerName: string = "";
    @Expose() phoneNumber: string = "";
    @Expose() shipStreet: string = "";
    @Expose() shipCity: string = "";
    @Expose() shipState: string = "";
    @Expose() shipPostalCode: string = "";
    @Expose() shipCountry: string = "";
    @Expose() totalAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() paidAmount: PrismaDecimal = new PrismaDecimal(0);
    @Expose() status: string = "";
    @Expose() remark: string = "";
    @Expose() createdAt: Date = new Date();
    @Expose()
    @Type(() => SalesItemSummary)
    salesItems: SalesItemSummary[] = [];
}

export class SalesItemSummary {
    @Expose() itemName: string = "";
    @Expose() itemCode: string = "";
    @Expose() quantity: PrismaDecimal = new PrismaDecimal(0);
    @Expose() price: PrismaDecimal = new PrismaDecimal(0);
    @Expose() subtotalAmount: PrismaDecimal = new PrismaDecimal(0);
}

export class ConfirmDeliveryBatchResponse {
    @Expose() successCount: number = 0;
    @Expose() deliveredSalesIds: number[] = [];
    @Expose() deliveredAt: Date = new Date();
}