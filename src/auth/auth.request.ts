export interface AuthenticateRequestBody {
    username: string,
    password: string,
    // Lite one-device rule (auth/lite-session.ts). Older apps send none of these.
    clientDeviceId?: string,
    deviceName?: string,
    /** The user confirmed "continue here and sign the other device out". */
    takeover?: boolean
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