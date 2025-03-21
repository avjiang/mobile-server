export interface TokenResponseBody {
    token: string,
    refreshToken: string
}

export interface ValidateTokenResponseBody {
    verified: boolean,
    tenantUserId: number,
    userId: number,
    username: string
}