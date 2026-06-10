export const ADD_ON_IDS = {
    EXTRA_USER: 1,
    EXTRA_DEVICE: 2,
    EXTRA_WAREHOUSE: 3,
    ADVANCED_LOYALTY: 4,
} as const;

/**
 * Advanced Loyalty is bundled into the Laundry Pro plan (see
 * auth.service `getTenantSubscriptionInfo`), so it must never be billed as a
 * paid add-on for Laundry tenants. Use this to drop it from any cost/billing
 * breakdown when the tenant's plan type is Laundry — even if a stray
 * tenant_add_on record exists (e.g. a Retail→Laundry conversion).
 */
export const isLaundryBundledAddOn = (
    addOnId: number,
    planType?: string | null,
): boolean =>
    addOnId === ADD_ON_IDS.ADVANCED_LOYALTY && planType === 'Laundry';
