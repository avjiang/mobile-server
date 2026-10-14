import { ErrorCode, RequestValidateError } from "../api-helpers/error";

/**
 * The supplier's own number for a delivery order (their surat jalan) or an
 * invoice (their invoice). Free text, optional, not unique — our document
 * number stays server-assigned; this only records what is printed on the
 * supplier's paper.
 */
export const SUPPLIER_REFERENCE_MAX_LENGTH = 100;

/**
 * Normalises a client-sent supplier reference.
 *
 * - `undefined` (key not sent) stays `undefined`, so Prisma leaves the stored
 *   value alone. This is what keeps an app that predates the field (or an
 *   outbox entry queued before the upgrade) from wiping a reference on update.
 * - `null`, `""` or whitespace → `null` (clear it).
 * - anything else is trimmed; longer than the column → SUPPLIER_REFERENCE_TOO_LONG.
 */
export function normaliseSupplierReference(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    if (trimmed === '') return null;
    if (trimmed.length > SUPPLIER_REFERENCE_MAX_LENGTH) {
        throw new RequestValidateError(
            `Supplier reference must be at most ${SUPPLIER_REFERENCE_MAX_LENGTH} characters`,
            ErrorCode.SupplierReferenceTooLong,
            { max: String(SUPPLIER_REFERENCE_MAX_LENGTH) }
        );
    }
    return trimmed;
}
