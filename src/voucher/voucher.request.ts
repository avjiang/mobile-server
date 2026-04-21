export interface CreateRewardRuleRequest {
    name: string;
    spendThreshold: number;
    isRepeatable?: boolean;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountPercentage?: number;
    discountAmount?: number;
    expiryDays: number;
    minPurchaseAmount?: number;
}

export interface UpdateRewardRuleRequest {
    name?: string;
    spendThreshold?: number;
    isRepeatable?: boolean;
    discountType?: 'PERCENTAGE' | 'FIXED';
    discountPercentage?: number;
    discountAmount?: number;
    expiryDays?: number;
    minPurchaseAmount?: number;
    isActive?: boolean;
}

export interface ManualIssueVoucherRequest {
    customerId: number;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountPercentage?: number;
    discountAmount?: number;
    expiryDays: number;
    minPurchaseAmount?: number;
    label: string;
}
