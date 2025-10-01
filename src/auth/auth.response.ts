export interface TokenResponseBody {
    token: string,
    tokenExpiryDate: string,
    refreshToken: string,
    tenantId: number,
    userId: number,
    notificationTopics?: string[],
    planName?: string | null
}

export interface ValidateTokenResponseBody {
    verified: boolean,
    tenantUserId: number,
    userId: number,
    username: string
}