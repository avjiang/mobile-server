import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth-request';
import { liveNotifications, syncTopic } from './live-notifications';

/**
 * Multi-terminal sync: after a successful write, tell every terminal of the outlet
 * (or of the tenant, for master data) which modules changed, over the live socket.
 * The terminals then delta-pull those modules — the signal never carries data, so
 * a lost one costs only speed (the app pulls on reconnect and on its timer).
 * Plan: docs/future/MULTI_TERMINAL_SYNC.md (FE repo).
 *
 * One middleware instead of a call in every service: it keys on the route, runs
 * after the response is sent (never inside a transaction), and only on 2xx.
 */

/** Module names on the wire; the app maps each to its `SyncModule`. */
export type SyncSignalModule =
    | 'sales' | 'stock' | 'item' | 'categories' | 'customers' | 'suppliers'
    | 'settings' | 'users' | 'roles' | 'warehouses';

interface RouteRule {
    modules: SyncSignalModule[];
    /** `outlet`: only that outlet's terminals; `tenant`: every terminal of the tenant. */
    scope: 'outlet' | 'tenant';
}

/** First path segment → what a write there changes. Routes not listed signal nothing. */
const RULES: Record<string, RouteRule> = {
    sales: { modules: ['sales', 'stock'], scope: 'outlet' },
    stock: { modules: ['stock'], scope: 'outlet' },
    stockReceipt: { modules: ['stock'], scope: 'outlet' },
    invoice: { modules: ['stock'], scope: 'outlet' },
    deliveryOrder: { modules: ['stock'], scope: 'outlet' },
    purchaseReturn: { modules: ['stock'], scope: 'outlet' },
    warehouses: { modules: ['stock', 'warehouses'], scope: 'tenant' },
    item: { modules: ['item', 'stock'], scope: 'tenant' },
    category: { modules: ['categories'], scope: 'tenant' },
    customer: { modules: ['customers'], scope: 'tenant' },
    supplier: { modules: ['suppliers'], scope: 'tenant' },
    settings: { modules: ['settings'], scope: 'tenant' },
    user: { modules: ['users'], scope: 'tenant' },
    role: { modules: ['roles', 'users'], scope: 'tenant' },
};

/** Writes that change nothing another terminal reads (quotes, upload URLs, own password). */
const IGNORED: RegExp[] = [
    /^POST \/sales\/calculate\/?$/,
    /^POST \/sales\/(photo|receipt)\/upload-url\/?$/,
    /^POST \/user\/[^/]+\/change-password\/?$/,
];

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** What a request signals, or null. Exported for tests. */
export function signalFor(method: string, path: string): RouteRule | null {
    if (!WRITE_METHODS.has(method)) return null;
    const line = `${method} ${path}`;
    if (IGNORED.some((re) => re.test(line))) return null;
    const segment = path.split('/')[1] ?? '';
    return RULES[segment] ?? null;
}

type Signal = (topic: string, data: Record<string, unknown>) => number;

export function syncSignals(signal: Signal = (t, d) => liveNotifications.signal(t, d)) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const rule = signalFor(req.method, req.path);
        if (rule) {
            res.on('finish', () => {
                const user = req.user;
                if (!user?.tenantId || res.statusCode < 200 || res.statusCode >= 300) return;
                const outletId = rule.scope === 'outlet' ? req.outletId : undefined;
                try {
                    signal(syncTopic(user.tenantId, outletId), { modules: rule.modules, outletId: outletId ?? null });
                } catch (error) {
                    console.error('[sync-signals] signal failed:', error);
                }
            });
        }
        next();
    };
}
