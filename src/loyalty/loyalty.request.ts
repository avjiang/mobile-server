export interface CreateProgramRequest {
    name: string;
    pointsPerCurrency: number;
    currencyPerPoint: number;
    pointsExpiryDays?: number;
    minRedeemPoints?: number;
}

export interface UpdateProgramRequest {
    name?: string;
    pointsPerCurrency?: number;
    currencyPerPoint?: number;
    pointsExpiryDays?: number | null;
    minRedeemPoints?: number;
    isActive?: boolean;
}

export interface EnrollCustomerRequest {
    customerId: number;
    loyaltyProgramId: number;
}

export interface EarnPointsRequest {
    points: number;
    salesId?: number;
    description?: string;
}

export interface RedeemPointsRequest {
    points: number;
    salesId?: number;
    description?: string;
}

export interface AdjustPointsRequest {
    points: number; // positive = add, negative = remove
    description: string;
}

// Phase 4: Tier management
export interface CreateTierRequest {
    loyaltyProgramId: number;
    name: string;
    minSpend: number;
    discountPercentage?: number;
    pointsMultiplier?: number;
    sortOrder?: number;
}

export interface UpdateTierRequest {
    name?: string;
    minSpend?: number;
    discountPercentage?: number;
    pointsMultiplier?: number;
    sortOrder?: number;
}

export interface ManualTierAssignRequest {
    loyaltyTierId: number | null; // null = remove manual tier
    isManualTier: boolean;
}
