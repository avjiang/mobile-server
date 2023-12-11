export interface AuthenticateRequestBody {
    username: string,
    password: string
}

export interface TokenRequestBody {
    token: string
}

export interface RefreshTokenRequestBody {
    refreshToken: string
}

export interface ChangePasswordRequestBody {
    userId: number,
    currentPassword: string,
    newPassword: string
}