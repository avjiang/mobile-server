export interface LoyaltyProgramResponse {
    id: number;
    name: string;
    pointsPerCurrency: number;
    currencyPerPoint: number;
    pointsExpiryDays: number | null;
    minRedeemPoints: number;
    isActive: boolean;
    tiers?: LoyaltyTierResponse[];
}

export interface LoyaltyTierResponse {
    id: number;
    name: string;
    minSpend: number;
    discountPercentage: number;
    pointsMultiplier: number;
    sortOrder: number;
}

export interface LoyaltyAccountResponse {
    id: number;
    customerId: number;
    customerName: string;
    loyaltyProgramId: number;
    currentPoints: number;
    totalEarned: number;
    totalRedeemed: number;
    totalSpend: number;
    loyaltyTier: LoyaltyTierResponse | null;
    isManualTier: boolean;
    joinedAt: string;
}

export interface LoyaltyTransactionResponse {
    id: number;
    type: string;
    points: number;
    balanceAfter: number;
    salesId: number | null;
    description: string | null;
    performedBy: string | null;
    createdAt: string;
}

export interface PointsOperationResponse {
    success: boolean;
    message: string;
    account: {
        currentPoints: number;
        totalEarned: number;
        totalRedeemed: number;
    };
    transaction: LoyaltyTransactionResponse;
}

export interface TransactionHistoryResponse {
    transactions: LoyaltyTransactionResponse[];
    total: number;
    cursor: number | null;
}
