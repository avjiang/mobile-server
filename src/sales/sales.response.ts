import { Sales, SalesItem } from "prisma/client"
import { Expose } from "class-transformer"
import { Decimal } from 'decimal.js';

export interface SalesResponseBody {
    sales: Sales & { items: SalesItem[] }
}

export class SalesAnalyticResponseBody {
    @Expose() salesCount: Decimal = new Decimal(0);
    @Expose() totalProfit: Decimal = new Decimal(0);
    @Expose() totalRevenue: Decimal = new Decimal(0);
}