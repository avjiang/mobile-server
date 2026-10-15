/**
 * The anomaly rule registry (anomaly-rules.json) as typed data, plus the pure
 * helpers every surface shares: a tenant's effective settings per rule, and the
 * bilingual copy rendered from a rule's templates. No I/O here.
 *
 * The JSON is the one list of rules: the server runs them, the app's rules
 * screen and alert copy come from `GET /anomaly/rules` / the events, and the FE
 * repo's tool/product_catalog/sync.py reads the same file for the landing page
 * and docs/modules/ANOMALY.md.
 */
import { Decimal } from 'decimal.js';
import registryJson from './anomaly-rules.json';

export type Lang = 'id' | 'en';
export type Bilingual = { id: string; en: string };
export type RuleStatus = 'live' | 'beta' | 'planned';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type Vertical = 'retail' | 'laundry';

export interface RuleParamDef {
    key: string;
    default: number;
    min: number;
    max: number;
    unit: 'per_day' | 'minutes' | 'percent' | 'rupiah' | 'hour' | 'times' | 'count';
    label: Bilingual;
}

export interface AnomalyRuleDef {
    id: string;
    /** "report" = a scheduled summary (the closing report), not a rule with a detector. */
    kind?: 'rule' | 'report';
    status: RuleStatus;
    /** false = off until the tenant switches it on (e.g. it needs their opening hours). */
    defaultEnabled?: boolean;
    since: string | null;
    phase: number;
    verticals: Vertical[];
    severity: Severity;
    name: Bilingual;
    summary: Bilingual;
    params: RuleParamDef[];
    push: { title: Bilingual; body: Bilingual };
    engineering: string;
}

export const ANOMALY_RULES: AnomalyRuleDef[] = (registryJson as { rules: AnomalyRuleDef[] }).rules;

export const RULE_ID = {
    REVERSAL_BURST: 'REVERSAL_BURST',
    QUICK_REVERSAL: 'QUICK_REVERSAL',
    LARGE_DISCOUNT: 'LARGE_DISCOUNT',
    BELOW_COST: 'BELOW_COST',
    LARGE_STOCK_WRITEOFF: 'LARGE_STOCK_WRITEOFF',
    CASH_SHORTAGE: 'CASH_SHORTAGE',
    AFTER_HOURS: 'AFTER_HOURS',
    SUPPLIER_PRICE_RISE: 'SUPPLIER_PRICE_RISE',
    VOID_RATE_OUTLIER: 'VOID_RATE_OUTLIER',
    REPEATED_SHORTAGE: 'REPEATED_SHORTAGE',
    DAILY_REPORT: 'DAILY_REPORT',
} as const;

export function getRule(ruleId: string): AnomalyRuleDef | undefined {
    return ANOMALY_RULES.find((r) => r.id === ruleId);
}

const forVertical = (r: AnomalyRuleDef, vertical?: string | null) => {
    const v = (vertical ?? '').toLowerCase();
    return !v || r.verticals.includes(v as Vertical);
};

/**
 * What the app's rules screen lists: `live` entries only. `beta` ones run
 * (see [isRunning]) but are not shown or sold until their input exists in the
 * app (CASH_SHORTAGE needs the cash count at close).
 */
export function activeRules(vertical?: string | null): AnomalyRuleDef[] {
    return ANOMALY_RULES.filter((r) => r.status === 'live' && forVertical(r, vertical));
}

/** The engine runs live and beta entries. */
export function isRunning(rule: AnomalyRuleDef | undefined): rule is AnomalyRuleDef {
    return !!rule && (rule.status === 'live' || rule.status === 'beta');
}

/** A tenant's stored row for one rule (anomaly_rule_config), if any. */
export interface StoredRuleConfig {
    enabled: boolean;
    params: Record<string, unknown>;
}

export interface EffectiveRuleSettings {
    enabled: boolean;
    params: Record<string, number>;
}

/** Clamp a stored value into the param's range; anything unusable → the default. */
export function clampParam(def: RuleParamDef, value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return def.default;
    return Math.min(def.max, Math.max(def.min, Math.round(n)));
}

/** The registry defaults overlaid with the tenant's stored row (no row → defaults, enabled). */
export function effectiveSettings(rule: AnomalyRuleDef, stored?: StoredRuleConfig | null): EffectiveRuleSettings {
    const params: Record<string, number> = {};
    for (const p of rule.params) {
        params[p.key] = stored && p.key in (stored.params ?? {}) ? clampParam(p, stored.params[p.key]) : p.default;
    }
    const enabledByDefault = rule.defaultEnabled !== false;
    return { enabled: stored ? stored.enabled !== false : enabledByDefault, params };
}

/**
 * Validate a save from the rules screen. Returns the error text for the first
 * bad entry, or null. Out-of-range numbers are an error here (the screen bounds
 * them), unlike `clampParam`, which only protects reads.
 */
export function validateRuleUpdate(update: { ruleId?: unknown; enabled?: unknown; params?: unknown }): string | null {
    if (typeof update.ruleId !== 'string') return 'ruleId is required';
    const rule = getRule(update.ruleId);
    if (!rule || rule.status !== 'live') return `Unknown rule ${update.ruleId}`;
    if (update.enabled !== undefined && typeof update.enabled !== 'boolean') return `enabled must be true or false (${rule.id})`;
    if (update.params !== undefined) {
        if (typeof update.params !== 'object' || update.params === null || Array.isArray(update.params)) {
            return `params must be an object (${rule.id})`;
        }
        for (const [key, value] of Object.entries(update.params as Record<string, unknown>)) {
            const def = rule.params.find((p) => p.key === key);
            if (!def) return `Unknown parameter ${key} (${rule.id})`;
            if (typeof value !== 'number' || !Number.isFinite(value) || value < def.min || value > def.max) {
                return `${key} must be between ${def.min} and ${def.max} (${rule.id})`;
            }
        }
    }
    return null;
}

/** "Rp 1.250.000" (id) / "Rp 1,250,000" (en), whole rupiah. */
export function formatRupiah(value: Decimal.Value, lang: Lang): string {
    const n = new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    const sep = lang === 'id' ? '.' : ',';
    const sign = n < 0 ? '-' : '';
    const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return `${sign}Rp ${digits}`;
}

/**
 * Values a template can use. Money values are raw numbers here and formatted
 * per language; everything else is printed as is.
 */
export interface TemplateVars {
    user?: string;
    outlet?: string;
    count?: number;
    sale?: string | number;
    minutes?: number;
    percent?: number | string;
    items?: Bilingual | string;
    amount?: Decimal.Value;
    [param: string]: unknown;
}

const MONEY_KEYS = new Set(['amount', 'maxAmount', 'minShortage', 'minRupiah', 'expected', 'declared', 'profit']);

/** Fill `{token}`s; an unknown token renders empty (never "{token}" in a push). */
export function renderTemplate(template: string, vars: TemplateVars, lang: Lang): string {
    return template
        .replace(/\{(\w+)\}/g, (_m, key: string) => {
            const v = vars[key];
            if (v === undefined || v === null) return '';
            if (MONEY_KEYS.has(key)) return formatRupiah(v as Decimal.Value, lang);
            if (typeof v === 'object' && 'id' in (v as object) && 'en' in (v as object)) return (v as Bilingual)[lang];
            return String(v);
        })
        .replace(/\s+·\s*$/, '') // a trailing "· {outlet}" with no outlet
        .trim();
}

export function renderBilingual(template: Bilingual, vars: TemplateVars): Bilingual {
    return { id: renderTemplate(template.id, vars, 'id'), en: renderTemplate(template.en, vars, 'en') };
}

/** "Gula 1kg", "Gula 1kg dan 2 lainnya" / "Gula 1kg and 2 more". */
export function itemsPhrase(names: string[]): Bilingual {
    const unique = [...new Set(names.filter((n) => n && n.trim()))];
    if (unique.length === 0) return { id: 'barang', en: 'items' };
    if (unique.length === 1) return { id: unique[0], en: unique[0] };
    const rest = unique.length - 1;
    return { id: `${unique[0]} dan ${rest} lainnya`, en: `${unique[0]} and ${rest} more` };
}
