export interface TokenResponseBody {
    token: string,
    refreshToken: string
}

export interface ValidateTokenResponseBody {
    verified: boolean,
    userId: number,
    username: string
}