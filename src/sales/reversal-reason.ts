/**
 * Why a sale was voided / returned / refunded (anomaly alerts, Phase 0).
 *
 * The app sends `{ reasonCode, reasonNote }` with the PUT. A missing reason is
 * ACCEPTED (stored as null): APKs before the reason sheet send none, and a void
 * must never fail on an old phone. The app makes the reason required.
 */
import { RequestValidateError } from '../api-helpers/error';

export const REVERSAL_REASON_CODES = ['WRONG_INPUT', 'CUSTOMER_CANCELLED', 'WRONG_PRICE', 'DAMAGED', 'OTHER'] as const;
export type ReversalReasonCode = (typeof REVERSAL_REASON_CODES)[number];
export const REVERSAL_NOTE_MAX = 255;

export interface ReversalReason {
    code: ReversalReasonCode;
    note: string | null;
}

/** Parse the request body's reason. Null when none was sent; throws on a malformed one. */
export function parseReversalReason(body: unknown): ReversalReason | null {
    const b = (body ?? {}) as { reasonCode?: unknown; reasonNote?: unknown };
    const rawCode = typeof b.reasonCode === 'string' ? b.reasonCode.trim().toUpperCase() : '';
    const rawNote = typeof b.reasonNote === 'string' ? b.reasonNote.trim() : '';
    if (!rawCode) {
        if (rawNote) throw new RequestValidateError('reasonCode is required with a reasonNote');
        return null;
    }
    if (!(REVERSAL_REASON_CODES as readonly string[]).includes(rawCode)) {
        throw new RequestValidateError(`Unknown reasonCode ${rawCode}`);
    }
    if (rawNote.length > REVERSAL_NOTE_MAX) {
        throw new RequestValidateError(`reasonNote is longer than ${REVERSAL_NOTE_MAX} characters`);
    }
    if (rawCode === 'OTHER' && !rawNote) {
        throw new RequestValidateError('reasonNote is required when reasonCode is OTHER');
    }
    return { code: rawCode as ReversalReasonCode, note: rawNote || null };
}

/** The columns claimSalesReversal writes with the status. */
export interface ReversalAudit {
    userId: number;
    username: string;
    reason: ReversalReason | null;
    at: Date;
}

export function reversalAuditData(audit: ReversalAudit) {
    return {
        reversedByUserId: audit.userId,
        reversedBy: audit.username,
        reversedAt: audit.at,
        reversalReasonCode: audit.reason?.code ?? null,
        reversalReasonNote: audit.reason?.note ?? null,
    };
}
