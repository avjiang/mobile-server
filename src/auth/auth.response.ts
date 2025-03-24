export interface TokenResponseBody {
    token: string,
    refreshToken: string,
    tenantId: number,
    userId: number,
}

export interface ValidateTokenResponseBody {
    verified: boolean,
    tenantUserId: number,
    userId: number,
    username: string
}