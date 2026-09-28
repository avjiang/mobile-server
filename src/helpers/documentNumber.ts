import { RequestValidateError } from "../api-helpers/error";

/**
 * Server-assigned procurement document numbers.
 *
 * Format: `{PREFIX}-OUT{outletId}-{yyyyMMdd}-{seq}` where seq is zero-padded to 4
 * digits and simply grows past 9999. One counter per (outlet, prefix, local date)
 * lives in the tenant table `document_sequence`.
 *
 * Race safety: `nextDocumentNumber` bumps the counter row with a single UPDATE
 * inside the document's interactive transaction. The UPDATE takes the row's
 * X-lock, which is held until that transaction commits or rolls back, so two
 * concurrent creates for the same key are serialized and can never read the same
 * value; a rolled-back create also rolls back its increment (no gaps from failures).
 *
 * The counter row must exist for that UPDATE to take a plain row lock. Creating it
 * lazily inside the transaction would mean an UPDATE-miss (gap lock) followed by an
 * INSERT, which InnoDB deadlocks on when two first-of-the-day creates race. So the
 * services call `ensureDocumentSequences` BEFORE opening their transaction: an
 * autocommit `INSERT IGNORE` that commits at once and holds nothing. The
 * in-transaction insert remains only as a fallback.
 */

export const DOCUMENT_PREFIX = {
    invoice: 'INV',
    purchaseOrder: 'PO',
    quotation: 'QT',
    deliveryOrder: 'DO',
    purchaseReturn: 'RTN',
    invoiceSettlement: 'SET',
} as const;

export type DocumentPrefix = typeof DOCUMENT_PREFIX[keyof typeof DOCUMENT_PREFIX];

/** Where each prefix's numbers are stored — used to seed a fresh counter past any
 *  number already issued for the same day (e.g. by the old client-side generator). */
const NUMBER_COLUMN: Record<DocumentPrefix, { table: string; column: string }> = {
    INV: { table: 'invoice', column: 'INVOICE_NUMBER' },
    PO: { table: 'purchase_order', column: 'PURCHASE_ORDER_NUMBER' },
    QT: { table: 'quotation', column: 'QUOTATION_NUMBER' },
    DO: { table: 'delivery_order', column: 'TRACKING_NUMBER' },
    RTN: { table: 'purchase_return', column: 'RETURN_NUMBER' },
    SET: { table: 'invoice_settlement', column: 'SETTLEMENT_NUMBER' },
};

/** WIB (UTC+7) — the default business timezone when the client sends none. */
export const DEFAULT_UTC_OFFSET_MINUTES = 420;

/**
 * Parse the optional top-level `utcOffsetMinutes` request-body field.
 * Absent/null → WIB. Present but not an integer in [-720, 840] → 400.
 */
export function parseUtcOffsetMinutes(raw: unknown): number {
    if (raw === undefined || raw === null || raw === '') return DEFAULT_UTC_OFFSET_MINUTES;
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < -720 || n > 840) {
        throw new RequestValidateError('utcOffsetMinutes must be an integer between -720 and 840');
    }
    return n;
}

/** The business date `yyyyMMdd` for `now` shifted by the client's UTC offset. */
export function localDocumentDate(utcOffsetMinutes: number, now: Date = new Date()): string {
    const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

export function formatDocumentNumber(prefix: DocumentPrefix, outletId: number, localDate: string, seq: number): string {
    return `${prefix}-OUT${outletId}-${localDate}-${String(seq).padStart(4, '0')}`;
}

function assertKey(outletId: number, prefix: DocumentPrefix, localDate: string) {
    if (!Number.isInteger(outletId) || outletId <= 0) {
        throw new RequestValidateError('A valid outletId is required to number the document');
    }
    if (!NUMBER_COLUMN[prefix]) throw new Error(`Unknown document prefix ${prefix}`);
    if (!/^\d{8}$/.test(localDate)) throw new Error(`Invalid document date ${localDate}`);
}

/** Highest sequence already present in the document table for this key (0 if none).
 *  Includes soft-deleted rows: the number columns are UNIQUE regardless of IS_DELETED. */
async function highestIssuedSeq(db: any, outletId: number, prefix: DocumentPrefix, localDate: string): Promise<number> {
    const { table, column } = NUMBER_COLUMN[prefix];
    const pattern = `${prefix}-OUT${outletId}-${localDate}-%`;
    const rows: Array<{ maxSeq: unknown }> = await db.$queryRawUnsafe(
        `SELECT MAX(CAST(SUBSTRING_INDEX(\`${column}\`, '-', -1) AS UNSIGNED)) AS maxSeq
           FROM \`${table}\` WHERE \`${column}\` LIKE ?`,
        pattern,
    );
    const v = rows?.[0]?.maxSeq;
    return v === null || v === undefined ? 0 : Number(v);
}

/**
 * Make sure the counter rows exist, OUTSIDE any transaction (pass the base tenant
 * client). Idempotent; a fresh row starts at the highest number already issued for
 * that key so server numbering never collides with older client-made numbers.
 */
export async function ensureDocumentSequences(
    prisma: any,
    prefix: DocumentPrefix,
    outletIds: number[],
    localDate: string,
): Promise<void> {
    for (const outletId of [...new Set(outletIds)]) {
        assertKey(outletId, prefix, localDate);
        const existing: unknown[] = await prisma.$queryRawUnsafe(
            'SELECT 1 FROM `document_sequence` WHERE `OUTLET_ID` = ? AND `PREFIX` = ? AND `SEQ_DATE` = ?',
            outletId, prefix, localDate,
        );
        if (existing.length > 0) continue;
        const start = await highestIssuedSeq(prisma, outletId, prefix, localDate);
        await prisma.$executeRawUnsafe(
            'INSERT IGNORE INTO `document_sequence` (`OUTLET_ID`, `PREFIX`, `SEQ_DATE`, `LAST_VALUE`, `UPDATED_AT`) VALUES (?, ?, ?, ?, NOW(3))',
            outletId, prefix, localDate, start,
        );
    }
}

/**
 * Allocate the next document number. MUST be called with an interactive-transaction
 * client (`tx`) — the row lock taken here is what makes it race-safe, and it is held
 * until the caller's transaction ends.
 */
export async function nextDocumentNumber(
    tx: any,
    outletId: number,
    prefix: DocumentPrefix,
    localDate: string,
): Promise<string> {
    assertKey(outletId, prefix, localDate);

    const updated: number = await tx.$executeRawUnsafe(
        'UPDATE `document_sequence` SET `LAST_VALUE` = `LAST_VALUE` + 1, `UPDATED_AT` = NOW(3) WHERE `OUTLET_ID` = ? AND `PREFIX` = ? AND `SEQ_DATE` = ?',
        outletId, prefix, localDate,
    );
    if (updated === 0) {
        // Fallback when ensureDocumentSequences was not run first (e.g. midnight
        // rolled over between the two calls). Correct, just deadlock-prone under a
        // race — MySQL then aborts one transaction rather than issuing a duplicate.
        const start = await highestIssuedSeq(tx, outletId, prefix, localDate);
        await tx.$executeRawUnsafe(
            'INSERT INTO `document_sequence` (`OUTLET_ID`, `PREFIX`, `SEQ_DATE`, `LAST_VALUE`, `UPDATED_AT`) VALUES (?, ?, ?, ?, NOW(3)) ' +
            'ON DUPLICATE KEY UPDATE `LAST_VALUE` = `LAST_VALUE` + 1, `UPDATED_AT` = NOW(3)',
            outletId, prefix, localDate, start + 1,
        );
    }

    // Our own uncommitted write is visible to us; the row is X-locked by this tx.
    const rows: Array<{ LAST_VALUE: unknown }> = await tx.$queryRawUnsafe(
        'SELECT `LAST_VALUE` FROM `document_sequence` WHERE `OUTLET_ID` = ? AND `PREFIX` = ? AND `SEQ_DATE` = ?',
        outletId, prefix, localDate,
    );
    const seq = Number(rows[0]?.LAST_VALUE);
    if (!Number.isInteger(seq) || seq <= 0) {
        throw new Error(`document_sequence read failed for ${prefix}/${outletId}/${localDate}`);
    }
    return formatDocumentNumber(prefix, outletId, localDate, seq);
}
