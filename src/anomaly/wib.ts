/** WIB (UTC+7, no DST) day helpers — anomaly counts run per shop day, not per server (UTC) day. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** yyyy-mm-dd of `at` in WIB. */
export function wibDay(at: Date): string {
    return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant WIB midnight began on the day containing `at`. */
export function startOfWibDay(at: Date): Date {
    return new Date(Date.parse(`${wibDay(at)}T00:00:00.000Z`) - WIB_OFFSET_MS);
}
