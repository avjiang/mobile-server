import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth-request";
import { getTenantPrisma } from "../db";
import { Prisma, PrismaClient } from "../../prisma/client/generated/client";

/** Subset of `PrismaClient` the middleware actually uses. Narrower surface
 *  makes test fakes trivial to construct. */
export interface IdempotencyDb {
    idempotencyRecord: {
        findUnique: PrismaClient["idempotencyRecord"]["findUnique"];
        create: PrismaClient["idempotencyRecord"]["create"];
    };
}

export interface IdempotencyDeps {
    /** Returns the per-tenant DB client for a given tenant database name.
     *  Defaults to the real `getTenantPrisma`; tests pass a fake. */
    prismaFactory: (databaseName: string) => IdempotencyDb;
}

/**
 * Idempotency middleware — dedupes retries of write requests.
 *
 * The Flutter client (`lib/data/API.dart`) sends a UUID v4 per logical
 * write operation as the `X-Idempotency-Key` HTTP header. Every retry of
 * the same operation sends the same key. This middleware catches
 * duplicates and returns the original response without re-executing the
 * route handler.
 *
 * Classic failure mode this protects against:
 *   1. Client POSTs `/sales/create`.
 *   2. Server accepts and writes the sale.
 *   3. Response times out on the way back to the client.
 *   4. Client's outbox retries the same request with the same key.
 *   5. Without this middleware: duplicate sale. With: original response is
 *      replayed, no duplicate.
 *
 * Scope:
 *   - Runs on POST / PUT only. GET is naturally idempotent; DELETE on a
 *     specific id is also naturally idempotent and not worth the complexity.
 *   - Reads the key from the `X-Idempotency-Key` HTTP header. Requests
 *     without a key pass through unchanged (external API callers,
 *     non-Flutter integrations).
 *   - Only 2xx and 4xx responses are stored. 5xx (server error) is treated
 *     as transient so the client's retry gets a fresh attempt.
 *   - Per-tenant: records live in the tenant's own DB, scoped by endpoint
 *     + key. Identical keys across tenants don't collide.
 *
 * Failure modes:
 *   - DB unreachable during lookup → log + pass through (let the request
 *     proceed; at worst we duplicate once).
 *   - Concurrent insert on the same key → unique-constraint violation; we
 *     ignore it and treat the response as successfully stored.
 */
export function createIdempotencyMiddleware(
    deps: IdempotencyDeps = { prismaFactory: getTenantPrisma }
) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (req.method !== "POST" && req.method !== "PUT") {
            return next();
        }
        if (!req.user) {
            // Auth middleware will reject — don't shadow the auth error.
            return next();
        }

        const key = req.header("x-idempotency-key") as unknown;
        if (typeof key !== "string" || key.length === 0 || key.length > 64) {
            return next();
        }

        const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
        const db = deps.prismaFactory(req.user.databaseName);
        const userId = req.user.userId;

        // 1. Look up existing record.
        try {
            const existing = await db.idempotencyRecord.findUnique({
                where: { endpoint_key: { endpoint, key } },
            });
            if (existing) {
                // Replay the stored response exactly as it was sent
                // originally.
                res.status(existing.responseStatus)
                    .type("application/json")
                    .send(existing.responseBody);
                return;
            }
        } catch (err) {
            // DB hiccup — log and pass through. The write may duplicate in
            // this rare case, but that's strictly better than blocking the
            // request.
            console.error(
                "[idempotency] lookup failed; passing through",
                err
            );
            return next();
        }

        // 2. Intercept res.json so we can store whatever the route returns.
        //    sendResponse / sendErrorResponse both ultimately call res.json.
        const originalJson = res.json.bind(res);
        res.json = function (body: any): Response {
            const status = res.statusCode;
            // Only persist deterministic outcomes. 5xx is transient;
            // replaying a stored 5xx would defeat retry.
            if (status < 500) {
                const serialized =
                    typeof body === "string" ? body : JSON.stringify(body);
                // Fire-and-forget. The response must not block on
                // persistence.
                db.idempotencyRecord
                    .create({
                        data: {
                            endpoint,
                            key,
                            userId,
                            responseStatus: status,
                            responseBody: serialized,
                        },
                    })
                    .catch((insertErr: unknown) => {
                        // Concurrent request with the same key reached the
                        // insert first — safe to ignore. Anything else,
                        // log.
                        if (
                            insertErr instanceof
                                Prisma.PrismaClientKnownRequestError &&
                            insertErr.code === "P2002"
                        ) {
                            return;
                        }
                        console.error(
                            "[idempotency] failed to persist record",
                            insertErr
                        );
                    });
            }
            return originalJson(body);
        } as Response["json"];

        next();
    };
}

// Default export keeps the existing `app.use(idempotencyMiddleware)` wiring
// in `index.ts` working unchanged.
export default createIdempotencyMiddleware();
