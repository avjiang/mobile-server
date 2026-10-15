import crypto from 'crypto';
import type { NextFunction, Response } from 'express';
import { BaseError, ErrorCode } from '../api-helpers/error';
import type { AuthRequest } from '../middleware/auth-request';
import { isLitePlan } from '../middleware/require-plan.middleware';
import { liveNotifications } from '../live/live-notifications';
const { getGlobalPrisma } = require('../db');

/**
 * Lite one-device rule: a Retail Lite login is active on ONE device at a time,
 * last login wins. Owner decision 2026-10-15 (Lite only; Basic/Pro unlimited).
 *
 *  - Login on device B while device A holds the session → 409 LITE_DEVICE_IN_USE
 *    with A's name / online / last-seen, unless the client sends `takeover: true`.
 *  - A takeover writes a new SESSION_ID, revokes the user's other refresh tokens and
 *    closes A's live socket with `session_replaced` (close 4409) — A shows "signed in
 *    elsewhere" within a second if it is online, or on its next request otherwise.
 *  - Every request with a Lite token carrying an old `sid` gets 401 SESSION_REPLACED
 *    (the access token lives a day, so revoking refresh tokens alone isn't enough).
 *  - Tokens without `sid` (issued before this rule) pass until they expire; their
 *    next refresh claims the session.
 * The 2-day offline limit is enforced in the app (it can't be checked offline).
 */

/** A session not seen for this long no longer blocks a login elsewhere (= refresh-token life). */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-read from the DB after this long, so a second backend process would converge. */
const CACHE_TTL_MS = 60 * 1000;
/** LAST_SEEN_AT is written at most this often per user. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export interface ActiveSession {
    tenantUserId: number;
    sessionId: string;
    clientDeviceId: string | null;
    deviceName: string | null;
    startedAt: Date;
    lastSeenAt: Date | null;
}

export class DeviceInUseError extends BaseError {
    constructor(params: Record<string, string>) {
        super(409, 'This Lite account is active on another device');
        this.name = 'DeviceInUseError';
        this.errorCode = ErrorCode.LiteDeviceInUse;
        this.params = params;
    }
}

export class SessionReplacedError extends BaseError {
    constructor(params: Record<string, string>) {
        super(401, 'This account was signed in on another device');
        this.name = 'SessionReplacedError';
        this.errorCode = ErrorCode.SessionReplaced;
        this.params = params;
    }
}

interface Store {
    find(tenantUserId: number): Promise<ActiveSession | null>;
    save(session: ActiveSession): Promise<void>;
    touch(tenantUserId: number, at: Date): Promise<void>;
    revokeOtherRefreshTokens(tenantUserId: number, keepSessionId: string): Promise<void>;
}

const prismaStore: Store = {
    async find(tenantUserId) {
        return getGlobalPrisma().tenantUserSession.findUnique({ where: { tenantUserId } });
    },
    async save(s) {
        const data = { sessionId: s.sessionId, clientDeviceId: s.clientDeviceId, deviceName: s.deviceName, startedAt: s.startedAt, lastSeenAt: s.lastSeenAt };
        await getGlobalPrisma().tenantUserSession.upsert({ where: { tenantUserId: s.tenantUserId }, create: { tenantUserId: s.tenantUserId, ...data }, update: data });
    },
    async touch(tenantUserId, at) {
        await getGlobalPrisma().tenantUserSession.updateMany({ where: { tenantUserId }, data: { lastSeenAt: at } });
    },
    async revokeOtherRefreshTokens(tenantUserId, keepSessionId) {
        await getGlobalPrisma().refreshToken.updateMany({
            where: { tenantUserId, revoked: null, OR: [{ sessionId: null }, { sessionId: { not: keepSessionId } }] },
            data: { revoked: new Date(), deleted: true },
        });
    },
};

export interface DeviceInfo {
    clientDeviceId?: string | null;
    deviceName?: string | null;
}

export class LiteSessions {
    private readonly cache = new Map<number, { session: ActiveSession | null; at: number }>();
    private readonly touched = new Map<number, number>();

    constructor(
        private readonly store: Store = prismaStore,
        private readonly isOnline: (tenantUserId: number, sessionId: string) => boolean =
            (id, sid) => liveNotifications.hasSession(id, sid),
        private readonly endSockets: (tenantUserId: number, keepSessionId: string, params: Record<string, string>) => void =
            (id, keep, params) => liveNotifications.endSessions(id, keep, params),
        private readonly now: () => number = Date.now,
    ) {}

    async current(tenantUserId: number): Promise<ActiveSession | null> {
        const hit = this.cache.get(tenantUserId);
        if (hit && this.now() - hit.at < CACHE_TTL_MS) return hit.session;
        const session = await this.store.find(tenantUserId);
        this.cache.set(tenantUserId, { session, at: this.now() });
        return session;
    }

    /** What the "in use on another device" prompt and the "replaced" screen show. */
    describe(session: ActiveSession): Record<string, string> {
        return {
            deviceName: session.deviceName ?? '',
            online: this.isOnline(session.tenantUserId, session.sessionId) ? 'true' : 'false',
            lastSeenAt: (session.lastSeenAt ?? session.startedAt).toISOString(),
            startedAt: session.startedAt.toISOString(),
        };
    }

    /**
     * Starts a session for a Lite login on [device]. Throws [DeviceInUseError] when
     * another device holds a live session and [takeover] isn't set. A client that
     * sends no device id (an app from before this rule) takes over silently.
     */
    async start(tenantUserId: number, device: DeviceInfo, takeover: boolean): Promise<string> {
        const existing = await this.current(tenantUserId);
        const clientDeviceId = device.clientDeviceId?.trim() || null;
        if (existing && !takeover && clientDeviceId && existing.clientDeviceId && existing.clientDeviceId !== clientDeviceId) {
            const seen = (existing.lastSeenAt ?? existing.startedAt).getTime();
            if (this.now() - seen < STALE_AFTER_MS) throw new DeviceInUseError(this.describe(existing));
        }
        const now = new Date(this.now());
        const session: ActiveSession = {
            tenantUserId,
            sessionId: crypto.randomBytes(16).toString('hex'),
            clientDeviceId,
            deviceName: device.deviceName?.trim().slice(0, 120) || null,
            startedAt: now,
            lastSeenAt: now,
        };
        await this.store.save(session);
        await this.store.revokeOtherRefreshTokens(tenantUserId, session.sessionId);
        this.cache.set(tenantUserId, { session, at: this.now() });
        this.touched.set(tenantUserId, this.now());
        // The device that just signed in is online by definition — its socket
        // simply hasn't connected yet, so describe() would say "offline".
        this.endSockets(tenantUserId, session.sessionId, { ...this.describe(session), online: 'true' });
        return session.sessionId;
    }

    /** Throws [SessionReplacedError] when [sessionId] is no longer this user's session. */
    async assertCurrent(tenantUserId: number, sessionId: string): Promise<void> {
        const session = await this.current(tenantUserId);
        if (!session || session.sessionId === sessionId) {
            if (session) this.touch(tenantUserId);
            return;
        }
        throw new SessionReplacedError(this.describe(session));
    }

    private touch(tenantUserId: number): void {
        const last = this.touched.get(tenantUserId) ?? 0;
        if (this.now() - last < TOUCH_EVERY_MS) return;
        this.touched.set(tenantUserId, this.now());
        const at = new Date(this.now());
        const hit = this.cache.get(tenantUserId);
        if (hit?.session) hit.session.lastSeenAt = at;
        this.store.touch(tenantUserId, at).catch((e) => console.error('[lite-session] touch failed:', e));
    }

    /** Tests only. */
    reset(): void {
        this.cache.clear();
        this.touched.clear();
    }
}

export const liteSessions = new LiteSessions();

/**
 * After auth: a Lite token whose session was replaced gets 401 SESSION_REPLACED.
 * Non-Lite tokens and tokens without `sid` pass untouched.
 */
export const liteSessionGuard = (sessions: LiteSessions = liteSessions) =>
    async (req: AuthRequest, _res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user?.sid || !isLitePlan(user.planName)) return next();
        try {
            await sessions.assertCurrent(user.tenantUserId, user.sid);
            next();
        } catch (error) {
            next(error);
        }
    };
