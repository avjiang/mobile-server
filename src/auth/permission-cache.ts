// Live permission resolution with a short-lived in-process cache.
//
// Why this exists: a user's effective permissions are stamped into the JWT at
// login (1-day TTL). Granting/revoking a permission therefore did NOT take
// effect on the server until the user's token was reissued — up to a full day,
// or a manual re-login. The Flutter client already resolves permissions live
// from synced data, so the app would SHOW a freshly granted action while the
// backend kept rejecting it (403). This module closes that gap on the server:
// `requirePermission` and the in-sale "Override Stock Source" check resolve
// permissions live from the DB (cached for `TTL_MS`) instead of trusting the
// token. The JWT-stamped permissions remain as a fallback if a live resolve
// fails — so a transient DB hiccup degrades to today's behavior, never a lockout.
//
// Single instance (Azure B1 Basic, one worker) → this in-process cache is
// authoritative and `invalidatePermissions` is fully effective. If the app is
// ever scaled out, each instance keeps its own cache and falls back to TTL
// expiry for cross-instance propagation.

const { getGlobalPrisma, getTenantPrisma } = require('../db');

// Cache time-to-live. A permission change made through the app (role.service)
// invalidates immediately; out-of-process writes (manual SQL, admin scripts)
// propagate within this window.
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
    permissions: string[];
    expiresAt: number;
}

// Keyed by `${databaseName}:${userId}` so invalidation can flush a whole tenant.
const cache = new Map<string, CacheEntry>();

const keyFor = (db: string, userId: number) => `${db}:${userId}`;

/**
 * Resolve a user's effective permission names live from the tenant DB.
 * Super-admin (role id 1) and the avjiang god-account resolve to `['*']`.
 *
 * THROWS on DB failure (unlike the cached wrapper's callers, which catch and
 * fall back to the JWT). This lets the difference between "user genuinely has
 * no permissions" (`[]`) and "couldn't reach the DB" (throw) be observed.
 */
export async function resolvePermissions(db: string, userId: number, username: string): Promise<string[]> {
    if (username === 'avjiang') return ['*'];

    const tenantPrisma = getTenantPrisma(db);
    const userWithRoles = await tenantPrisma.user.findUnique({
        where: { id: userId },
        select: {
            roles: {
                where: { deleted: false },
                select: {
                    id: true,
                    permission: {
                        where: { deleted: false },
                        select: { permissionId: true },
                    },
                },
            },
        },
    });
    if (!userWithRoles) return [];

    // Super-admin role id is 1 — wildcard match, no global lookup needed.
    if (userWithRoles.roles.some((r: any) => r.id === 1)) return ['*'];

    const permissionIds = new Set<number>();
    userWithRoles.roles.forEach((role: any) => {
        role.permission.forEach((rp: any) => permissionIds.add(rp.permissionId));
    });
    if (permissionIds.size === 0) return [];

    const globalPrisma = getGlobalPrisma();
    const permissions = await globalPrisma.permission.findMany({
        where: { id: { in: Array.from(permissionIds) }, deleted: false },
        select: { name: true },
    });
    return permissions.map((p: any) => p.name);
}

type Resolver = (db: string, userId: number, username: string) => Promise<string[]>;

/**
 * Cached live-resolve. Returns the user's effective permissions, serving from
 * the in-process cache when fresh and resolving from the DB on a miss/expiry.
 * Propagates DB errors so the caller can fall back to the JWT-stamped list.
 *
 * `resolver` is injectable purely so unit tests can drive cache behavior without
 * a database; production always uses the default DB-backed resolver.
 */
export async function getEffectivePermissions(
    db: string,
    userId: number,
    username: string,
    resolver: Resolver = resolvePermissions,
): Promise<string[]> {
    const key = keyFor(db, userId);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
        return hit.permissions;
    }
    const permissions = await resolver(db, userId, username);
    cache.set(key, { permissions, expiresAt: now + TTL_MS });
    return permissions;
}

/**
 * Drop cached permissions for an entire tenant. Call after any role/permission
 * mutation (role.service create/update/assign/remove) so the next request
 * re-resolves from the DB instead of serving a stale grant for up to `TTL_MS`.
 * A role-permission change can affect any user holding that role, so flushing
 * the whole tenant is both correct and cheap.
 */
export function invalidatePermissions(db: string): void {
    const prefix = `${db}:`;
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/** Test/maintenance helper — drop the entire cache. */
export function clearPermissionCache(): void {
    cache.clear();
}
