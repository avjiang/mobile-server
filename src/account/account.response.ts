export interface OutletDetailsResponse {
    outletId: number;
    outletName: string;
    isActive: boolean;
    serverTime: string;
    subscription: {
        planName: string;
        basePlanCost: number;
        isCustomPrice: boolean;
        standardPlanPrice: number;
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
    addOns: Array<{
        id: number;
        name: string;
        addOnType: string;
        pricePerUnit: number;
        maxQuantity: number | null;
        scope: string;
        description: string | null;
        currentQuantity: number;
    }>;
    totalMonthlyCost: number;
}