export const ADD_ON_IDS = {
    EXTRA_USER: 1,
    /** Retired 2026-09-29 — push devices are unlimited on Pro (FCM has no per-device cost). Never billed. */
    EXTRA_DEVICE: 2,
    EXTRA_WAREHOUSE: 3,
    ADVANCED_LOYALTY: 4,
} as const;

/**
 * Advanced Loyalty is bundled into the plan (see auth.service
 * `getTenantSubscriptionInfo`) for every **Laundry** plan and for **F&B Pro**,
 * so it must never be billed as a paid add-on there — even if a stray
 * tenant_add_on record exists (e.g. a Retail→Laundry conversion). F&B Basic
 * buys it like Retail does (docs/future/FNB_FEATURES.md §4).
 */
export const isPlanBundledAddOn = (
    addOnId: number,
    planType?: string | null,
    planName?: string | null,
): boolean =>
    addOnId === ADD_ON_IDS.ADVANCED_LOYALTY &&
    (planType === 'Laundry' || (planType === 'F&B' && planName === 'Pro'));

/**
 * Add-ons that are no longer sold. Tenants who bought one before it was
 * retired may still carry a tenant_add_on row; it is kept (harmless) but must
 * never reach a bill.
 */
export const isRetiredAddOn = (addOnId: number): boolean =>
    addOnId === ADD_ON_IDS.EXTRA_DEVICE;

/** True when this add-on must be left out of every cost/billing breakdown. */
export const isNonBillableAddOn = (
    addOnId: number,
    planType?: string | null,
    planName?: string | null,
): boolean =>
    isRetiredAddOn(addOnId) || isPlanBundledAddOn(addOnId, planType, planName);
