/**
 * What a detector returns. Detectors are pure (context in → finding or null
 * out); the engine (../anomaly.service.ts) records the finding and decides the
 * push from `notify`.
 */
import { Decimal } from 'decimal.js';
import { Severity } from '../registry';

export type DocumentType = 'SALES' | 'STOCK_ADJUSTMENT' | 'SESSION' | 'DELIVERY_ORDER';

export interface AnomalyActor {
    userId: number;
    username: string;
}

export interface Finding {
    ruleId: string;
    severity: Severity;
    /** Same key = same event: a repeat updates the row instead of adding one. */
    dedupKey: string;
    userId: number | null;
    username: string | null;
    outletId: number | null;
    siteId: number | null;
    documentType: DocumentType;
    documentIds: number[];
    amount: Decimal | null;
    count: number;
    /**
     * Rule params + observed values. Also the template values for the push and
     * the app's copy (user and outlet are added at render time).
     */
    detail: Record<string, unknown>;
    /** Send a push for this finding now (first crossing, or the escalation). */
    notify: boolean;
    /** A repeat that got worse: re-opens an acknowledged event. */
    escalation: boolean;
    /**
     * A repeat ADDS to the event (documentIds merged, count + this finding's
     * count) instead of replacing it, and never pushes again (AFTER_HOURS: one push a
     * day per person, later actions just add to it).
     */
    accumulate?: boolean;
}

/** The number shown as "#…" for a sale: laundry's friendly number, else the id. */
export function saleLabel(sale: { id: number; friendlyNumber?: string | null }): string {
    return sale.friendlyNumber && sale.friendlyNumber.trim() ? sale.friendlyNumber : String(sale.id);
}
