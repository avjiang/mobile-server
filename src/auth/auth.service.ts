import { jwt_token_secret } from "../../config.json"
import jwt, { MyJwtPayload } from "jsonwebtoken"
import { PrismaClient, TenantUser, RefreshToken, Tenant, TenantSubscription, SubscriptionPlan, Prisma } from "../../prisma/global-client/generated/global";
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AuthenticateRequestBody, RefreshTokenRequestBody, TokenRequestBody } from "./auth.request"
import { TokenResponseBody } from "./auth.response"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { UserInfo } from "../middleware/authorize-middleware"
import { User } from "../../prisma/client/generated/client"
const { getGlobalPrisma, getTenantPrisma } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let authenticate = async (req: AuthenticateRequestBody, ipAddress: string) => {
    try {
        // Find user based on username
        const tenantUser = await prisma.tenantUser.findFirst({
            where: {
                username: req.username,
            },
            include: {
                tenant: true,
            }
        })
        // Check if user not found or password mismatched, throw error
        if (!tenantUser || !tenantUser.password || !bcrypt.compareSync(req.password, tenantUser.password)) {
            throw new RequestValidateError('Username or password is incorrect')
        }
        try {
            let customerUser;
            if (tenantUser.username === "avjiang") {
                // Bypass tenant DB lookup for avjiang, create a mock user object
                customerUser = {
                    id: 0,
                    username: "avjiang",
                    // add other required fields as needed
                } as User;
            } else {
                const tenantPrisma = getTenantPrisma(tenantUser?.tenant?.databaseName || '');
                customerUser = await tenantPrisma.user.findFirst({
                    where: {
                        username: tenantUser.username
                    }
                })
                await tenantPrisma.$disconnect();

                // Check if user not found in tenant database
                if (!customerUser) {
                    throw new RequestValidateError('User not found in tenant database')
                }
            }

            // Authentication successful so generate jwt & refresh tokens
            const jwtToken = await generateJwtToken(tenantUser, customerUser, tenantUser?.tenant?.databaseName || '')
            const decodedToken = jwt.decode(jwtToken) as { exp?: number, user?: UserInfo };
            const tokenExpiryDate = decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : null;
            const refreshToken = await generateRefreshToken(tenantUser, ipAddress)
            const response: TokenResponseBody = {
                token: jwtToken,
                tokenExpiryDate: tokenExpiryDate ?? "",
                refreshToken: refreshToken.token,
                globalTenantId: tenantUser?.tenantId || 0,
                globalTenantUserId: tenantUser?.id || 0,
                userId: customerUser?.id || 0,
                notificationTopics: decodedToken.user?.notificationTopics,
                planName: decodedToken.user?.planName
            }
            return response
        } catch (error) {
            throw error
        }

    }
    catch (error) {
        throw error
    }
}

let validateToken = async (req: TokenRequestBody) => {
    try {
        const verified: MyJwtPayload = jwt.verify(req.token, jwt_token_secret) as MyJwtPayload
        const userInfo: UserInfo = verified.user
        return userInfo
    }
    catch (error) {
        throw error
    }
}

let refreshToken = async (req: RefreshTokenRequestBody, ipAddress: string) => {
    try {
        const refreshToken = await getRefreshToken(req.refreshToken)
        const tenantUser = await getById(refreshToken.tenantUserId)

        // Replace current refresh token with a new one
        const newRefreshToken = await generateRefreshToken(tenantUser, ipAddress)
        await revokeToken(req)

        let customerUser;
        if (tenantUser.username === "avjiang") {
            // Bypass tenant DB lookup for avjiang, create a mock user object
            customerUser = {
                id: 0,
                username: "avjiang",
                // add other required fields as needed
            } as User;
        } else {
            const tenantPrisma = getTenantPrisma(tenantUser?.tenant?.databaseName || '');
            customerUser = await tenantPrisma.user.findFirst({
                where: {
                    username: tenantUser.username
                }
            })
            await tenantPrisma.$disconnect();
        }

        // Generate new jwt
        const jwtToken = await generateJwtToken(tenantUser, customerUser, tenantUser.tenant?.databaseName ?? '')
        const decodedToken = jwt.decode(jwtToken) as { exp?: number, user?: UserInfo };
        const tokenExpiryDate = decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : null;
        const response: TokenResponseBody = {
            token: jwtToken,
            tokenExpiryDate: tokenExpiryDate ?? "",
            refreshToken: newRefreshToken.token,
            globalTenantId: tenantUser?.tenantId || 0,
            globalTenantUserId: tenantUser?.id || 0,
            userId: customerUser?.id || 0,
            notificationTopics: decodedToken.user?.notificationTopics,
            planName: decodedToken.user?.planName
        }
        return response
    }
    catch (error) {
        throw error
    }
}

let revokeToken = async (req: RefreshTokenRequestBody) => {
    try {
        const refreshToken = await getRefreshToken(req.refreshToken)

        //revoke token
        const revokedRefreshToken = await prisma.refreshToken.update({
            where: {
                id: refreshToken.id
            },
            data: {
                revoked: new Date(),
                deleted: true
            }
        })
        return revokedRefreshToken
    }
    catch (error) {
        throw error
    }
}

let getRefreshTokens = async (userId: number) => {
    try {
        // Return refresh tokens for user
        const refreshTokens = await prisma.refreshToken.findMany({
            where: {
                tenantUserId: userId
            }
        })
        return refreshTokens
    }
    catch (error) {
        throw error
    }
}

// Helper function
let getRefreshToken = async (token: string) => {
    const refreshToken = await prisma.refreshToken.findFirst({
        where: {
            token: token
        }
    })
    if (!refreshToken || !isTokenActive(refreshToken)) {
        throw new RequestValidateError('Invalid refresh token')
    }
    return refreshToken;
}

let randomTokenString = () => {
    return crypto.randomBytes(40).toString('hex');
}

let getTenantPlanName = async (tenantId: number): Promise<string | null> => {
    try {
        const globalPrisma = getGlobalPrisma();

        // Get all outlets for this tenant with their active subscriptions
        const tenantOutlets = await globalPrisma.tenantOutlet.findMany({
            where: {
                tenantId: tenantId,
                isActive: true
            },
            include: {
                subscriptions: {
                    where: {
                        status: {
                            in: ['Active', 'active', 'trial']
                        }
                    },
                    include: {
                        subscriptionPlan: true
                    }
                }
            }
        });

        // If no outlets found, return null
        if (!tenantOutlets || tenantOutlets.length === 0) {
            return null;
        }

        // Find the first active subscription across all outlets
        // Prioritize higher tier plans (Pro over Basic)
        let bestPlan: string | null = null;

        for (const outlet of tenantOutlets) {
            for (const subscription of outlet.subscriptions) {
                const planName = subscription.subscriptionPlan?.planName;
                if (planName) {
                    // If we find a Pro plan, return it immediately
                    if (planName === 'Pro') {
                        return 'Pro';
                    }
                    // Otherwise, keep the first plan we find
                    if (!bestPlan) {
                        bestPlan = planName;
                    }
                }
            }
        }
        return bestPlan;
    } catch (error) {
        console.error('Error getting tenant plan name:', error);
        return null;
    }
}

let getNotificationTopics = async (tenantId: number, userId: number, db: string) => {
    try {
        // Generate notification topics regardless of plan
        // Frontend will control whether to use them based on plan from JWT

        const tenantPrisma = getTenantPrisma(db);
        const globalPrisma = getGlobalPrisma();

        // Get user with roles
        const user = await tenantPrisma.user.findUnique({
            where: {
                id: userId
            },
            include: {
                roles: true
            }
        });

        if (!user) {
            await tenantPrisma.$disconnect();
            return [];
        }

        // Get all role IDs for this user
        const roleIds = user.roles.map((role: any) => role.id);

        // Get role permissions from tenant DB
        const rolePermissions = await tenantPrisma.rolePermission.findMany({
            where: {
                roleId: {
                    in: roleIds
                },
                deleted: false
            }
        });

        await tenantPrisma.$disconnect();

        // Get permission IDs
        const permissionIds = rolePermissions.map((rp: any) => rp.permissionId);

        // Get actual permissions from global DB
        const permissions = await globalPrisma.permission.findMany({
            where: {
                id: {
                    in: permissionIds
                },
                deleted: false,
                // Filter for notification permissions
                name: {
                    startsWith: 'Receive '
                },
                category: 'Notifications'
            }
        });

        // Extract notification permission names
        const notificationPermissions = new Set<string>();
        permissions.forEach((permission: any) => {
            notificationPermissions.add(permission.name);
        });

        // Generate topics
        const topics: string[] = [];

        // Add tenant-wide topic (for system-level notifications)
        topics.push(`tenant_${tenantId}`);

        // Add permission-based topics at tenant level
        // These are used for tenant-wide notifications (e.g., financial, system alerts)
        notificationPermissions.forEach(permission => {
            // Convert permission name to topic: "Receive Sales Notification" -> "sales"
            const shortPermission = permission
                .replace('Receive ', '')
                .replace(' Notification', '')
                .replace(' Alert', '')
                .toLowerCase();

            // Add tenant-level permission topic
            topics.push(`tenant_${tenantId}_${shortPermission}`);

            // Note: Outlet-specific topics like `tenant_${tenantId}_outlet_${outletId}_${shortPermission}`
            // will be subscribed dynamically when the user is working in a specific outlet context
            // This is handled by the client app based on the current outlet selection
        });

        // Add user-specific topic for direct messages
        topics.push(`tenant_${tenantId}_user_${userId}`);

        return topics;
    } catch (error) {
        console.error('Error getting notification topics:', error);
        return [];
    }
}

let generateJwtToken = async (tenantUser: TenantUser, user: User, db: string) => {
    // Get notification topics for the user (skip for avjiang)
    let notificationTopics: string[] = [];
    let planName: string | null = null;

    if (tenantUser.username !== "avjiang") {
        planName = await getTenantPlanName(tenantUser.tenantId);

        if (planName === "Pro") {
            notificationTopics = await getNotificationTopics(tenantUser.tenantId, user.id, db);
        }
    }

    // Create a jwt token containing the user info that expires in 1 day
    const userInfo: UserInfo = {
        tenantUserId: tenantUser.id,
        userId: user.id,
        username: tenantUser.username,
        databaseName: db,
        tenantId: tenantUser.tenantId,
        role: tenantUser.username === "avjiang" ? "admin" : "user",
        notificationTopics,
        planName
    }
    return jwt.sign({ user: userInfo }, jwt_token_secret, { expiresIn: '1d' });
}

let generateRefreshToken = async (user: TenantUser, ipAddress: string) => {
    //create a refresh token that expires in 1 day
    try {
        var tokenExpiredDate = new Date()
        tokenExpiredDate.setDate(tokenExpiredDate.getDate() + 1)

        const refreshTokenObject = await prisma.refreshToken.create({
            data: {
                tenantUserId: user.id,
                token: randomTokenString(),
                expired: tokenExpiredDate,
                createdByIP: ipAddress
            }
        })
        return refreshTokenObject
    }
    catch (e) {
        throw e
    }
}

function isTokenActive(refreshToken: RefreshToken) {
    if (!refreshToken.expired) {
        return false
    }
    const isExpired = new Date() >= refreshToken.expired
    return !refreshToken.revoked && !isExpired
}

let getById = async (id: number) => {
    try {
        const user = await prisma.tenantUser.findUnique({
            where: {
                id: id
            },
            include: {
                tenant: true,
            }
        })
        if (!user) {
            throw new NotFoundError("User")
        }
        return user
    }
    catch (error) {
        throw error
    }
}

export = { authenticate, validateToken, revokeToken, refreshToken, getRefreshTokens }