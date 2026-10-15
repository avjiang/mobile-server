/**
 * /anomaly — owner security alerts (Pro). docs/modules/ANOMALY.md.
 *
 *   GET  /anomaly/rules                    Receive Security Alert Notification OR Manage Security Alerts
 *   PUT  /anomaly/rules                    Manage Security Alerts
 *   GET  /anomaly/events                   Receive … OR Manage …   (?status=&severity=&outletId=&cursor=&limit=)
 *   GET  /anomaly/events/:id               Receive … OR Manage …
 *   PUT  /anomaly/events/:id/acknowledge   Receive … OR Manage …
 *   GET  /anomaly/summary                  Receive … OR Manage …
 *
 * Every route is Pro-only (402 otherwise). Events are filtered to the caller's
 * outlets (resolveAllowedOutletIds); events with no outlet are visible to all.
 */
import express, { NextFunction, Response } from 'express';
import validator from 'validator';
import { AuthRequest } from '../middleware/auth-request';
import { requirePlan } from '../middleware/require-plan.middleware';
import { requireAnyPermission, requirePermission } from '../middleware/require-permission.middleware';
import { PERMISSION } from '../permission/permission-names';
import { sendResponse } from '../api-helpers/network';
import { RequestValidateError } from '../api-helpers/error';
import { resolveAllowedOutletIds } from '../api-helpers/outlet-access';
import { getTenantPrisma } from '../db';
import * as queries from './anomaly.queries';

const router = express.Router();

const canRead = requireAnyPermission([PERMISSION.RECEIVE_SECURITY_ALERT_NOTIFICATION, PERMISSION.MANAGE_SECURITY_ALERTS]);
const canManage = requirePermission(PERMISSION.MANAGE_SECURITY_ALERTS);

const optionalInt = (value: unknown, name: string): number | undefined => {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string' || !validator.isInt(value, { min: 1 })) throw new RequestValidateError(`${name} must be a positive number`);
    return parseInt(value, 10);
};

const idParam = (req: AuthRequest): number => {
    const id = optionalInt(req.params.id, 'id');
    if (id === undefined) throw new RequestValidateError('ID format incorrect');
    return id;
};

/** Wrap an async handler so a thrown error reaches the error middleware. */
const handle = (fn: (req: AuthRequest) => Promise<unknown>) =>
    (req: AuthRequest, res: Response, next: NextFunction) => {
        Promise.resolve()
            .then(() => {
                if (!req.user) throw new RequestValidateError('User not authenticated');
                return fn(req);
            })
            .then((data) => sendResponse(res, data))
            .catch(next);
    };

router.get('/rules', requirePlan('Pro'), canRead, handle(async (req) => {
    const user = req.user!;
    return queries.listRules(getTenantPrisma(user.databaseName), user.databaseName, user.planType);
}));

router.put('/rules', requirePlan('Pro'), canManage, handle(async (req) => {
    const user = req.user!;
    const prisma = getTenantPrisma(user.databaseName);
    await queries.saveRules(prisma, user.databaseName, (req.body as any)?.rules, user.userId);
    return queries.listRules(prisma, user.databaseName, user.planType);
}));

router.get('/events', requirePlan('Pro'), canRead, handle(async (req) => {
    const user = req.user!;
    const q = req.query as Record<string, unknown>;
    return queries.listEvents(getTenantPrisma(user.databaseName), await resolveAllowedOutletIds(user), {
        status: typeof q.status === 'string' && q.status ? q.status.toUpperCase() : undefined,
        severity: typeof q.severity === 'string' && q.severity ? q.severity.toUpperCase() : undefined,
        outletId: optionalInt(q.outletId, 'outletId'),
        cursor: optionalInt(q.cursor, 'cursor'),
        limit: optionalInt(q.limit, 'limit'),
    });
}));

router.get('/events/:id', requirePlan('Pro'), canRead, handle(async (req) => {
    const user = req.user!;
    return queries.getEvent(getTenantPrisma(user.databaseName), await resolveAllowedOutletIds(user), idParam(req));
}));

router.put('/events/:id/acknowledge', requirePlan('Pro'), canRead, handle(async (req) => {
    const user = req.user!;
    return queries.acknowledgeEvent(
        getTenantPrisma(user.databaseName), await resolveAllowedOutletIds(user), idParam(req),
        { userId: user.userId, username: user.username },
    );
}));

router.get('/summary', requirePlan('Pro'), canRead, handle(async (req) => {
    const user = req.user!;
    return queries.summary(getTenantPrisma(user.databaseName), await resolveAllowedOutletIds(user));
}));

export = router;
