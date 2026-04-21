export interface RewardRuleResponse {
    id: number;
    name: string;
    triggerType: string;
    spendThreshold: number;
    isRepeatable: boolean;
    discountType: string;
    discountPercentage: number | null;
    discountAmount: number | null;
    expiryDays: number;
    minPurchaseAmount: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface VoucherResponse {
    id: number;
    rewardRuleId: number | null;
    customerId: number;
    loyaltyAccountId: number | null;
    discountType: string;
    discountPercentage: number | null;
    discountAmount: number | null;
    minPurchaseAmount: number | null;
    status: string;
    milestoneSpendSnapshot: number | null;
    label: string;
    expiresAt: string;
    redeemedAt: string | null;
    redeemedInSalesId: number | null;
    createdAt: string;
}
