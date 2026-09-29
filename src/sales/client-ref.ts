/**
 * Permanent dedupe of offline-replayed checkouts and payments.
 *
 * The Flutter outbox replays a queued write with the same X-Idempotency-Key as
 * its original attempt. `idempotency-middleware.ts` answers such a replay from
 * `idempotency_record`, but that table is purged after 24h. A till that stays
 * offline longer would then record the sale twice, if its original attempt did
 * reach us and only the response was lost.
 *
 * So the key is also stored on the row it created (`sales.CLIENT_REF`,
 * `payment.CLIENT_REF`), forever, behind a unique index. A replay of any age
 * finds that row and gets the existing sale back with `alreadyRecorded: true`
 * instead of a second insert. The unique index also settles two concurrent
 * replays: the loser's insert fails with P2002 and it returns the winner's row.
 *
 * See docs/DATABASE.md (FE) § Replay window and docs/modules/SALES.md.
 */

import { Prisma } from "../../prisma/client/generated/client";

/** Header telling the app this server dedupes sale replays by CLIENT_REF. */
export const CLIENT_REF_CAPABILITY_HEADER = "X-Sales-Client-Ref";

const MAX_KEY_LENGTH = 64; // Same bound as idempotency-middleware.

/** The request's idempotency key, or null when absent/invalid. */
export function readClientRef(header: unknown): string | null {
    if (typeof header !== "string") return null;
    const key = header.trim();
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) return null;
    return key;
}

/** CLIENT_REF of the n-th payment written by one addPayment call. */
export function paymentClientRef(key: string, index: number): string {
    return `${key}:${index}`;
}

/** True when [error] is a unique-index violation on a CLIENT_REF column. */
export function isClientRefConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== "P2002") return false;
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    const names = Array.isArray(target) ? target : [target];
    return names.some(
        (t) => typeof t === "string" && /client_?ref/i.test(t),
    );
}

/** Minimal Prisma surface the lookups need (injectable for tests). */
export interface ClientRefDb {
    sales: {
        findUnique(args: {
            where: { clientRef: string };
            select: { id: true };
        }): Promise<{ id: number } | null>;
    };
    payment: {
        findUnique(args: {
            where: { clientRef: string };
            select: { salesId: true };
        }): Promise<{ salesId: number } | null>;
    };
}

/** Id of the sale a checkout with this key already created, if any. */
export async function findSaleIdByClientRef(
    db: ClientRefDb,
    key: string,
): Promise<number | null> {
    const row = await db.sales.findUnique({
        where: { clientRef: key },
        select: { id: true },
    });
    return row?.id ?? null;
}

/**
 * Id of the sale an addPayment with this key already paid into, if any. Only
 * the first payment's ref is checked: one call's payments commit together.
 */
export async function findPaidSaleIdByClientRef(
    db: ClientRefDb,
    key: string,
): Promise<number | null> {
    const row = await db.payment.findUnique({
        where: { clientRef: paymentClientRef(key, 0) },
        select: { salesId: true },
    });
    return row?.salesId ?? null;
}

/** The response body for a replay: the existing sale, flagged. */
export function markAlreadyRecorded<T extends object>(
    sale: T,
): T & { alreadyRecorded: true } {
    return { ...sale, alreadyRecorded: true };
}
