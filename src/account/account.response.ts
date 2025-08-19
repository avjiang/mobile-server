export interface OutletDetailsResponse {
    outletId: number;
    outletName: string;
    isActive: boolean;
    subscription: {
        planName: string;
        basePlanCost: number;
        addOns: Array<{
            name: string;
            quantity: number;
            pricePerUnit: number;
            totalCost: number;
        }>;
        discounts: Array<{
            name: string;
            type: string;
            value: number;
            amount: number;
        }>;
        totalCost: number;
        totalCostBeforeDiscount: number;
        totalDiscount: number;
        status: string;
        subscriptionValidUntil: string;
    } | null;
}