export interface TokenResponseBody {
    token: string,
    tokenExpiryDate: string,
    refreshToken: string,
    globalTenantId: number,
    globalTenantUserId: number,
    userId: number,
    notificationTopics?: string[],
    planName?: string | null,
    planType?: string | null,
    databaseName?: string | null,
    globalOutletId?: number | null,
    loyaltyTier?: 'none' | 'basic' | 'advanced'
}

export interface ValidateTokenResponseBody {
    verified: boolean,
    tenantUserId: number,
    userId: number,
    username: string,
    planType?: string | null
}