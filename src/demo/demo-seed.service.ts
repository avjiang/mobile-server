/**
 * Demo Starter Kit — the "living business" seeder behind the login screen's
 * **Coba Demo** button. See docs/modules/DEMO_STARTER_KIT.md.
 *
 * A prospect taps Coba Demo, picks Retail or Laundry, and lands in a Pro tenant that
 * already looks like a shop that has been trading for ten days: stocked catalogue,
 * populated dashboard, real numbers in the reports. An empty app is the single biggest
 * reason a UMKM owner never comes back, so the demo must never be empty.
 *
 * Design notes:
 *  - **No top-level side effects** (no dotenv, no argv, no auto-run). The running server
 *    imports this from the reset cron, so anything that reads process.argv here would
 *    detonate inside the API process. Env selection belongs to the CLI wrapper.
 *  - **The seed IS the reset.** There is no separate restore path — resetting a demo
 *    tenant means wiping its owned tables and seeding again. One code path, so the
 *    nightly reset can never drift from what provisioning produced.
 *  - **Deterministic given a date.** A seeded PRNG drives every choice, so the catalogue,
 *    the basket mix and the payment split are identical run to run. The ten-day *window*
 *    slides with the calendar by design — the demo must always show "the last 10 days",
 *    never a fossil from provisioning day.
 *  - **WIB throughout.** Sale timestamps are built from Asia/Jakarta wall-clock hours and
 *    converted to UTC instants, so a prospect in Indonesia sees sales land on the days
 *    they expect. Reports bound periods by the viewer's local calendar day (see
 *    REPORT.md), and seeding in server-UTC would smear every shop day across two.
 */
import { getGlobalPrisma, getTenantPrisma, disconnectTenantClient } from '../db';
import {
    DemoVertical, DemoItemDef, DEMO_SUPPLIER, DEMO_CUSTOMERS, PAYMENT_MIX,
    RETAIL_CATEGORIES, RETAIL_ITEMS, LAUNDRY_CATEGORIES, LAUNDRY_ITEMS,
    LAUNDRY_SHOP, LAUNDRY_PACKAGES, LAUNDRY_PACKAGE_BUYERS, DEMO_LOYALTY, LOYALTY_TARGETS,
    RETAIL_SHOP, DEMO_CASHIERS, SECURITY_RULE_CONFIG, SECURITY_STORY,
} from './demo-catalogue';
import subscriptionPackageService from '../subscription-package/subscription-package.service';
import { AnomalyDeps, invalidateAnomalyConfig, onSaleCompleted, onSaleReversed } from '../anomaly/anomaly.service';
import { saveRules } from '../anomaly/anomaly.queries';
import { reversalAuditData } from '../sales/reversal-reason';
import { PERMISSION } from '../permission/permission-names';

const adminService = require('../admin/admin.service');

// ── Configuration ────────────────────────────────────────────────────────────

/** Tenant names == login usernames == passwords. Must match FE `DemoAccounts`. */
export const DEMO_TENANTS: Record<DemoVertical, { tenantName: string; planType: string }> = {
    retail: { tenantName: 'demo_retail', planType: 'Retail' },
    laundry: { tenantName: 'demo_laundry', planType: 'Laundry' },
};

/** Pro on purpose — a demo should show the ceiling, not the floor. */
const DEMO_PLAN = 'Pro';

/** Days of trading history to fabricate, including today. */
const HISTORY_DAYS = 10;

const WIB_OFFSET_MINUTES = 7 * 60;

/**
 * Tables the seeder does NOT own. Everything else in the demo tenant DB is wiped and
 * rebuilt, which is what makes the reset total: a prospect who spent the afternoon
 * raising purchase orders, issuing invoices and enrolling loyalty members leaves no
 * trace by morning. Deriving the wipe list from information_schema (rather than listing
 * owned tables) means a table added in a future migration is reset automatically instead
 * of quietly accumulating demo junk.
 */
const PRESERVED_TABLES = new Set([
    '_prisma_migrations',
    '_user_roles', 'user', 'role', 'role_permission',   // login + RBAC
    'outlet', 'setting', 'company', 'warehouse',        // tenant setup created by createTenant
    'registered_device', 'notification_preference',
    'user_outlet',                                       // user ↔ outlet access (multi-outlet)
]);

export interface DemoSeedResult {
    vertical: DemoVertical;
    tenantName: string;
    databaseName: string;
    /** True when the tenant did not exist and createIfMissing was false — nothing done. */
    skipped: boolean;
    created: boolean;
    items: number;
    customers: number;
    sales: number;
    revenue: number;
    /** Security alerts the anomaly engine recorded for today's story (retail only). */
    alerts?: number;
}

// ── Deterministic randomness ─────────────────────────────────────────────────

/**
 * mulberry32 — small, fast, and crucially *reproducible*. `Math.random()` would make
 * every reseed produce a different shop, so a screenshot from yesterday's demo would
 * never match today's.
 */
function makePrng(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const randInt = (rnd: () => number, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

function weightedPick<T extends { weight: number }>(rnd: () => number, pool: T[]): T {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let roll = rnd() * total;
    for (const p of pool) {
        roll -= p.weight;
        if (roll <= 0) return p;
    }
    return pool[pool.length - 1];
}

// ── Time helpers (Asia/Jakarta) ──────────────────────────────────────────────

/** The Y/M/D of "today" in WIB, regardless of the server's own timezone. */
function wibToday(now: Date): { y: number; m: number; d: number } {
    const shifted = new Date(now.getTime() + WIB_OFFSET_MINUTES * 60_000);
    return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** A WIB wall-clock moment as the UTC instant that gets stored. */
function wibInstant(day: { y: number; m: number; d: number }, hour: number, minute: number): Date {
    return new Date(Date.UTC(day.y, day.m, day.d, hour, minute) - WIB_OFFSET_MINUTES * 60_000);
}

function shiftDays(day: { y: number; m: number; d: number }, delta: number) {
    const d = new Date(Date.UTC(day.y, day.m, day.d + delta));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/** `YYMMDD-01-0007` — the laundry friendly number the FE prints on the intake slip. */
function friendlyNumber(day: { y: number; m: number; d: number }, seq: number): string {
    const yy = String(day.y % 100).padStart(2, '0');
    const mm = String(day.m + 1).padStart(2, '0');
    const dd = String(day.d).padStart(2, '0');
    return `${yy}${mm}${dd}-01-${String(seq).padStart(4, '0')}`;
}

/**
 * Deterministic UUID-shaped order ref. `Sales.orderRef` is @unique and is the durable
 * scan key for GET /sales/ref/:orderRef, so it has to look like what the app mints —
 * but it must NOT be random, or a reseed would collide with nothing and drift forever.
 */
function orderRef(rnd: () => number): string {
    const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

// ── Seeding ──────────────────────────────────────────────────────────────────

/**
 * Provision (optionally) and seed one demo tenant.
 *
 * @param createIfMissing `true` from the CLI (provisioning + manual reseed); `false` from
 *   the nightly cron, so a deployment without demo tenants is a clean no-op rather than a
 *   surprise tenant appearing in production one night.
 */
export async function seedDemoTenant(
    vertical: DemoVertical,
    opts: { createIfMissing: boolean },
): Promise<DemoSeedResult> {
    const { tenantName, planType } = DEMO_TENANTS[vertical];
    const globalPrisma = getGlobalPrisma();

    let tenant = await globalPrisma.tenant.findFirst({ where: { tenantName } });
    let created = false;

    if (!tenant) {
        if (!opts.createIfMissing) {
            return { vertical, tenantName, databaseName: '', skipped: true, created: false, items: 0, customers: 0, sales: 0, revenue: 0 };
        }
        const plan = await globalPrisma.subscriptionPlan.findFirst({ where: { planName: DEMO_PLAN, planType } });
        if (!plan) {
            throw new Error(`Subscription plan "${DEMO_PLAN}" (${planType}) not found in the global DB — seed plans first.`);
        }
        console.log(`[Demo] Creating tenant "${tenantName}" (${DEMO_PLAN} / ${planType})...`);
        // Demo login ("Coba Demo") signs in with password == username.
        await adminService.createTenant({ tenant: { tenantName, plan: DEMO_PLAN, planType, password: String(tenantName).toLowerCase().replace(/\s/g, '_') } });
        tenant = await globalPrisma.tenant.findFirst({ where: { tenantName } });
        if (!tenant) throw new Error(`createTenant reported success but "${tenantName}" is not in the global DB.`);
        created = true;
    }

    const databaseName = tenant.databaseName!;
    const prisma = getTenantPrisma(databaseName);

    // A demo must never lock its visitor out, so every reseed also rolls the
    // subscription forward (createTenant only grants 30 days).
    await globalPrisma.tenantSubscription.updateMany({
        where: { tenantId: tenant.id },
        data: {
            status: 'Active',
            subscriptionValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60_000),
            nextPaymentDate: new Date(Date.now() + 365 * 24 * 60 * 60_000),
        },
    });

    await wipeOwnedTables(prisma);
    // Identity first: sales record the owner's name as performedBy.
    if (vertical === 'laundry') await applyLaundryIdentity(prisma, tenant.id);
    else await applyRetailIdentity(prisma, tenant.id);
    const result = await seedTenantData(prisma, vertical);
    if (vertical === 'laundry') await seedLaundryPackages(prisma, databaseName);
    // After the packages on purpose (see seedLaundryPackages): no account exists while
    // they are bought, so no English "Earned from package purchase" row is written.
    await seedLoyaltyBaseline(prisma, vertical);
    // Last: its sales carry no customer, so the loyalty replay above never sees them.
    const alerts = vertical === 'retail' ? await seedSecurityAlerts(prisma, databaseName, tenant.id) : undefined;

    return { vertical, tenantName, databaseName, skipped: false, created, ...result, ...(alerts === undefined ? {} : { alerts }) };
}

/**
 * TRUNCATE every table the seeder owns. TRUNCATE (not DELETE) so auto-increment counters
 * restart at 1 — receipt numbers are `sales.ID`, and a demo whose first receipt is #4,318
 * looks like a system that has been through something.
 */
async function wipeOwnedTables(prisma: any): Promise<void> {
    const rows: Array<{ TABLE_NAME: string }> = await prisma.$queryRawUnsafe(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    const targets = rows.map(r => r.TABLE_NAME).filter(t => !PRESERVED_TABLES.has(t));

    // FK checks off for the duration — the wipe order would otherwise have to be a
    // hand-maintained topological sort of the whole schema. FOREIGN_KEY_CHECKS is
    // per-connection, so everything runs inside one interactive transaction: that
    // pins a single pooled connection. Issued as separate $executeRawUnsafe calls,
    // a TRUNCATE could land on another connection with checks still on and fail
    // with 1701 ("Cannot truncate a table referenced in a foreign key constraint").
    await prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
        try {
            for (const table of targets) {
                await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
            }
        } finally {
            await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
        }
    }, { timeout: 120_000 });
}

interface SeededItem {
    id: number;
    def: DemoItemDef;
    /** Running stock, tracked in memory so movements can record accurate previous values. */
    qty: number;
    receiptId: number | null;
}

async function seedTenantData(prisma: any, vertical: DemoVertical) {
    const isLaundry = vertical === 'laundry';
    const categories = isLaundry ? LAUNDRY_CATEGORIES : RETAIL_CATEGORIES;
    const itemDefs = isLaundry ? LAUNDRY_ITEMS : RETAIL_ITEMS;
    const supplierDef = DEMO_SUPPLIER[vertical];

    // Distinct seeds per vertical so the two demos don't share a basket rhythm.
    const rnd = makePrng(isLaundry ? 0x1A0D2E7 : 0x5E7A11);
    // Pay-at-pickup decisions draw from their own stream so adding them left the
    // basket/customer sequence above — and the loyalty targets built on it — unchanged.
    const pickupRnd = makePrng(0x71C2A9);

    const now = new Date();
    const today = wibToday(now);
    // The tenant's primary outlet (lowest live id) — outlet.ID is auto-increment and
    // not guaranteed to be 1 (the `outlet` table is preserved across re-seeds).
    const primaryOutlet = await prisma.outlet.findFirst({ where: { deleted: false }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!primaryOutlet) throw new Error('Demo seed: tenant has no live outlet');
    const outletId: number = primaryOutlet.id;
    const owner = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    const performedBy = owner ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.username : 'Demo';
    const ownerId = owner?.id ?? 1;

    // ── Master data ──────────────────────────────────────────────────────────
    const supplier = await prisma.supplier.create({
        data: { ...supplierDef, hasTax: false, companyCountry: 'Indonesia' },
    });

    const categoryIds: number[] = [];
    for (const c of categories) {
        const row = await prisma.category.create({ data: { name: c.name, description: c.description } });
        categoryIds.push(row.id);
    }

    const openingReceiptAt = wibInstant(shiftDays(today, -(HISTORY_DAYS - 1)), 7, 30);
    const items: SeededItem[] = [];

    for (const def of itemDefs) {
        const tracksStock = (def.opening ?? 0) > 0;
        const item = await prisma.item.create({
            data: {
                itemName: def.name,
                itemCode: def.code,
                itemType: def.itemType ?? '',
                itemBrand: def.brand ?? '',
                itemDescription: '',
                categoryId: categoryIds[def.category],
                pricingMode: def.pricingMode ?? null,
                cost: tracksStock ? 0 : def.cost,   // FIFO owns cost for stocked items
                price: def.price,
                unitOfMeasure: def.unitOfMeasure,
                supplierId: supplier.id,
                trackStock: tracksStock,
                hasTax: false,
                defaultLoadWeightKg: def.defaultLoadWeightKg ?? null,
                includesIroning: def.includesIroning ?? false,
                createdAt: openingReceiptAt,
            },
        });

        // The junction is what the PO/quotation picker and supplier.itemCount read —
        // an item without a row here is invisible in every supplier-scoped screen.
        await prisma.itemSupplier.create({
            data: { itemId: item.id, supplierId: supplier.id, isPreferred: true, cost: def.cost, version: 1 },
        });

        let receiptId: number | null = null;
        if (tracksStock) {
            const opening = def.opening!;
            const receipt = await prisma.stockReceipt.create({
                data: { itemId: item.id, outletId, quantity: opening, cost: def.cost, receiptDate: openingReceiptAt, createdAt: openingReceiptAt },
            });
            receiptId = receipt.id;
            await prisma.stockMovement.create({
                data: {
                    itemId: item.id, outletId,
                    previousAvailableQuantity: 0, previousOnHandQuantity: 0,
                    availableQuantityDelta: opening, onHandQuantityDelta: opening,
                    movementType: 'Create Item', documentId: receipt.id,
                    reason: 'Stok awal', remark: '', performedBy, createdAt: openingReceiptAt,
                },
            });
        }

        items.push({ id: item.id, def, qty: def.opening ?? 0, receiptId });
    }

    // Laundry recipes (item_consumable) — the prefill the FE reads when a service is
    // added to the cart, so a new sale on the demo draws supplies exactly like ours do.
    const byCode = new Map(items.map(i => [i.def.code, i]));
    for (const it of items) {
        for (const r of it.def.recipe ?? []) {
            const supply = byCode.get(r.supply)!;
            await prisma.itemConsumable.create({
                data: {
                    serviceItemId: it.id, consumableItemId: supply.id,
                    ratePerKg: r.rate, unit: supply.def.unitOfMeasure, consumptionBasis: r.basis,
                    createdAt: openingReceiptAt,
                },
            });
        }
    }

    const customerIds: number[] = [];
    for (const c of DEMO_CUSTOMERS) {
        const row = await prisma.customer.create({
            data: {
                salutation: c.salutation, firstName: c.firstName, lastName: c.lastName,
                mobile: c.mobile, gender: c.gender, billCity: c.city, billCountry: 'Indonesia',
                createdAt: openingReceiptAt,
            },
        });
        customerIds.push(row.id);
    }

    // ── Trading history ──────────────────────────────────────────────────────
    const sellable = itemDefs
        .map((def, idx) => ({ ...items[idx], weight: def.weight }))
        .filter(i => i.weight > 0);

    let totalSales = 0;
    let totalRevenue = 0;
    // Balances settled when the order was collected, written on the pickup day's
    // session (which does not exist yet while the drop-off day is being played out).
    const pickupPayments: { salesId: number; amount: number; method: string; at: Date; back: number }[] = [];

    for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
        const day = shiftDays(today, -back);
        const isToday = back === 0;
        const isWeekend = new Date(Date.UTC(day.y, day.m, day.d)).getUTCDay() % 6 === 0;

        // Today is still in progress — only part of the day's sales exist yet, which is
        // what makes the dashboard's "today" tile look live rather than suspiciously round.
        const base = isLaundry ? randInt(rnd, 8, 12) : randInt(rnd, 13, 18);
        const dayCount = Math.max(1, Math.round(base * (isWeekend ? 1.25 : 1) * (isToday ? 0.55 : 1)));

        const session = await prisma.session.create({
            data: {
                outletId,
                businessDate: wibInstant(day, 0, 0),
                openingDateTime: wibInstant(day, 8, 0),
                closingDateTime: isToday ? null : wibInstant(day, 21, 0),
                openingAmount: 200000,
                totalSalesCount: dayCount,
                openByUserID: ownerId,
                closeByUserID: isToday ? 0 : ownerId,
                siteId: 1,
                createdAt: wibInstant(day, 8, 0),
            },
        });

        let cashTaken = 0;

        // Earlier orders collected today: the balance is paid at the counter now, the
        // way the Pickup screen's add-payment writes it (this session, this moment).
        for (const pp of pickupPayments.filter(p => p.back === back)) {
            if (pp.method === 'Cash') cashTaken += pp.amount;
            await prisma.payment.create({
                data: {
                    method: pp.method,
                    tenderedAmount: pp.amount,
                    paidAmount: pp.amount,
                    currencySymbol: 'Rp',
                    salesId: pp.salesId,
                    businessDate: pp.at,
                    status: 'PAID',
                    outletId,
                    sessionId: session.id,
                    eodId: 0,
                    performedBy,
                    siteId: 1,
                    createdAt: pp.at,
                },
            });
        }

        for (let n = 0; n < dayCount; n++) {
            // Spread across trading hours; today stops at the current WIB hour.
            const openHour = 8;
            const closeHour = isToday
                ? Math.max(openHour + 1, Math.min(20, new Date(now.getTime() + WIB_OFFSET_MINUTES * 60_000).getUTCHours()))
                : 20;
            const hour = randInt(rnd, openHour, closeHour);
            const minute = randInt(rnd, 0, 59);
            const at = wibInstant(day, hour, minute);

            const lineCount = isLaundry ? randInt(rnd, 1, 2) : randInt(rnd, 1, 4);
            const chosen: SeededItem[] = [];
            for (let l = 0; l < lineCount; l++) {
                const pick = weightedPick(rnd, sellable as any) as any;
                if (!chosen.some(c => c.id === pick.id)) chosen.push(pick);
            }

            let subtotal = 0;
            let profit = 0;
            const lines: any[] = [];

            // Supply draw-down for this basket: one consumption line per supply, exactly
            // the shape POST /sales writes (quantity 1, price 0, stockConsumptionQty).
            const consumed = new Map<number, number>();

            for (const it of chosen) {
                // Laundry lines follow the item's pricing mode, like sales_screen.dart:
                // per_kg = rate × weighed kg (rounded to Rp 100), per_piece/flat = as-is.
                const mode = it.def.pricingMode;
                const kg = mode === 'per_kg'
                    ? Number((it.def.kgRange![0] + rnd() * (it.def.kgRange![1] - it.def.kgRange![0])).toFixed(1))
                    : null;
                const qty = mode ? 1 : randInt(rnd, 1, it.def.maxQty ?? 3);
                const unitPrice = kg != null ? Math.round((it.def.price * kg) / 100) * 100 : it.def.price;
                const lineSubtotal = unitPrice * qty;
                const lineCost = Math.round(it.def.cost * (kg ?? qty));
                subtotal += lineSubtotal;
                profit += lineSubtotal - lineCost;

                for (const r of it.def.recipe ?? []) {
                    const supply = items.find(i => i.def.code === r.supply)!;
                    const amount = r.basis === 'perKg' ? r.rate * (kg ?? 0) : r.rate * qty;
                    consumed.set(supply.id, (consumed.get(supply.id) ?? 0) + amount);
                }

                const isWash = it.def.defaultLoadWeightKg != null;
                lines.push({
                    itemId: it.id,
                    itemName: it.def.name,
                    itemCode: it.def.code,
                    itemBrand: it.def.brand ?? '',
                    quantity: qty,
                    cost: lineCost,
                    // PRICE is the LINE total (unit × qty), exactly what POST /sales
                    // stores (`price × qty` per row) — reports and the Home Top 5 sum it
                    // as revenue. Demo items carry no tax, and the app sends
                    // priceBeforeTax = 0 for an untaxed line.
                    price: lineSubtotal,
                    priceBeforeTax: 0,
                    profit: lineSubtotal - lineCost,
                    subtotalAmount: lineSubtotal,
                    unitOfMeasure: it.def.unitOfMeasure,
                    // A real machine load is never exactly the nominal size — reporting
                    // kg has to come from the weighed value, not the item default. NOT
                    // multiplied by qty: report.service counts one *line* as one load
                    // (`_count.id`), so wash services are capped at qty 1 in the
                    // catalogue and two loads means two lines.
                    loadWeightKg: kg != null
                        ? kg
                        : isWash && it.def.defaultLoadWeightKg! > 0
                            ? Number((it.def.defaultLoadWeightKg! * (0.72 + rnd() * 0.33)).toFixed(2))
                            : null,
                    itemStatus: isLaundry ? laundryStatus(back, rnd) : null,
                    stockReceiptId: it.receiptId,
                    createdAt: at,
                });
            }

            for (const [supplyId, amount] of consumed) {
                const supply = items.find(i => i.id === supplyId)!;
                const qtyUsed = Number(amount.toFixed(2));
                const supplyCost = Math.round(qtyUsed * supply.def.cost);
                profit -= supplyCost;
                lines.push({
                    itemId: supply.id, itemName: supply.def.name, itemCode: supply.def.code, itemBrand: '',
                    quantity: 1, cost: supplyCost, price: 0, priceBeforeTax: 0, profit: -supplyCost,
                    subtotalAmount: 0, unitOfMeasure: supply.def.unitOfMeasure,
                    stockConsumptionQty: qtyUsed, stockReceiptId: supply.receiptId, createdAt: at,
                });
            }

            // A quarter of baskets are a known face — enough for the customer screens and
            // loyalty pitch to have substance, not so many that "Walk-In" disappears.
            const withCustomer = rnd() < (isLaundry ? 0.55 : 0.25);
            const customerIdx = randInt(rnd, 0, DEMO_CUSTOMERS.length - 1);
            const customer = DEMO_CUSTOMERS[customerIdx];

            const collected = isLaundry && back >= 2;
            const dp = () => Math.max(5000, Math.round(subtotal / 2 / 1000) * 1000);
            // What the customer paid at drop-off. Work still on the shelf carries the
            // money questions the Pickup screen answers: some paid in full, some left a
            // DP, some pay on collection. Collected orders had the same mix at drop-off
            // and settled the balance when they were picked up the next day.
            let paid = subtotal;
            if (isLaundry && !collected) {
                const roll = rnd();
                if (roll < 0.35) paid = dp();
                else if (roll < 0.55) paid = 0;
            } else if (collected) {
                const roll = pickupRnd();
                if (roll < 0.35) paid = dp();
                else if (roll < 0.55) paid = 0;
            }
            paid = Math.min(paid, subtotal);
            const fullyPaid = paid >= subtotal;
            const collectedAt = collected
                ? wibInstant(shiftDays(day, 1), randInt(pickupRnd, 9, 19), randInt(pickupRnd, 0, 59))
                : null;
            // A collected order always leaves the shop settled: its balance is paid at
            // pickup, which is what completes it (addPaymentToPartiallyPaidSales leaves
            // completedSessionId untouched, so only drop-off-paid orders carry one).
            const settledAtPickup = collected && !fullyPaid;
            const finalPaid = settledAtPickup ? subtotal : paid;
            const sale = await prisma.sales.create({
                data: {
                    outletId,
                    businessDate: at,
                    salesType: 'Walk-In',
                    customerId: withCustomer ? customerIds[customerIdx] : null,
                    customerName: withCustomer ? `${customer.firstName} ${customer.lastName}` : '',
                    phoneNumber: withCustomer ? customer.mobile : '',
                    subtotalAmount: subtotal,
                    totalAmount: subtotal,
                    paidAmount: finalPaid,
                    profitAmount: profit,
                    status: finalPaid >= subtotal ? 'Completed' : 'Partially Paid',
                    sessionId: session.id,
                    completedSessionId: fullyPaid ? session.id : null,
                    eodId: 0,
                    performedBy,
                    siteId: 1,
                    createdAt: at,
                    ...(isLaundry
                        ? {
                            orderRef: orderRef(rnd),
                            friendlyNumber: friendlyNumber(day, n + 1),
                            collectedAt,
                        }
                        : {}),
                    salesItems: { create: lines },
                },
            });

            const method = weightedPick(rnd, PAYMENT_MIX).method;
            if (paid > 0) {
            if (method === 'Cash') cashTaken += paid;
            await prisma.payment.create({
                data: {
                    method,
                    tenderedAmount: paid,
                    paidAmount: paid,
                    currencySymbol: 'Rp',
                    salesId: sale.id,
                    businessDate: at,
                    status: 'PAID',
                    outletId,
                    sessionId: session.id,
                    eodId: 0,
                    performedBy,
                    siteId: 1,
                    createdAt: at,
                },
            });
            }
            if (settledAtPickup) {
                pickupPayments.push({
                    salesId: sale.id,
                    amount: subtotal - paid,
                    method: weightedPick(pickupRnd, PAYMENT_MIX).method,
                    at: collectedAt!,
                    back: back - 1,
                });
            }

            // Stock moves for goods (retail lines) and for laundry supplies drawn by a
            // service recipe (consumption lines, measured in stockConsumptionQty).
            for (const line of lines) {
                const it = items.find(i => i.id === line.itemId)!;
                if (!it.def.opening) continue;
                const before = it.qty;
                const used = line.stockConsumptionQty != null ? Number(line.stockConsumptionQty) : Number(line.quantity);
                it.qty = Math.max(0, Number((before - used).toFixed(2)));
                await prisma.stockMovement.create({
                    data: {
                        itemId: it.id, outletId,
                        previousAvailableQuantity: before, previousOnHandQuantity: before,
                        availableQuantityDelta: it.qty - before, onHandQuantityDelta: it.qty - before,
                        movementType: 'Sales', documentId: sale.id,
                        reason: 'Penjualan', remark: '', performedBy, siteId: 1,
                        createdAt: at,
                    },
                });
            }

            totalSales++;
            totalRevenue += subtotal;
        }

        if (!isToday) {
            await prisma.declaration.create({
                data: {
                    paymentType: 'Cash',
                    totalPaymentAmount: cashTaken,
                    declarationAmount: cashTaken,
                    differenceAmount: 0,
                    sessionID: session.id,
                    createdAt: wibInstant(day, 21, 0),
                },
            });
        }
    }

    // Balances are current state — write them once, after the ten days have played out,
    // so they agree with the movement ledger instead of being recomputed per sale.
    for (const it of items) {
        if (!it.def.opening) continue;
        await prisma.stockBalance.create({
            data: {
                itemId: it.id,
                outletId,
                availableQuantity: it.qty,
                onHandQuantity: it.qty,
                reorderThreshold: it.def.reorderThreshold ?? null,
                lastRestockDate: openingReceiptAt,
            },
        });
    }

    return { items: items.length, customers: customerIds.length, sales: totalSales, revenue: totalRevenue };
}

/**
 * The laundry demo's shop identity, all in Indonesian. `user`, `outlet`, `warehouse`
 * and `setting` survive the wipe (createTenant owns them), so these are updates and
 * upserts, not creates — and they are re-applied on every reseed so a changed
 * LAUNDRY_SHOP reaches an already-provisioned demo.
 */
async function applyLaundryIdentity(prisma: any, tenantId: number): Promise<void> {
    const globalPrisma = getGlobalPrisma();
    const owner = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    if (owner) {
        await prisma.user.update({
            where: { id: owner.id },
            data: { firstName: LAUNDRY_SHOP.ownerFirstName, lastName: LAUNDRY_SHOP.ownerLastName },
        });
    }
    // The primary outlet (lowest live id) — outlet.ID is not guaranteed to be 1; see seedDemoData.
    const primaryOutlet = await prisma.outlet.findFirst({ where: { deleted: false }, orderBy: { id: 'asc' }, select: { id: true } });
    const outletId: number | null = primaryOutlet?.id ?? null;
    if (outletId !== null) {
        await prisma.outlet.update({ where: { id: outletId }, data: { outletName: LAUNDRY_SHOP.outletName, street: LAUNDRY_SHOP.street, city: LAUNDRY_SHOP.city } });
    }
    await prisma.warehouse.updateMany({ data: { warehouseName: LAUNDRY_SHOP.warehouseName } });
    // tenant_outlet (global, billing) has no link to the tenant outlet id: rename only
    // the tenant's first row, so a demo that gained extra outlets keeps their names.
    const primaryTenantOutlet = await globalPrisma.tenantOutlet.findFirst({ where: { tenantId }, orderBy: { id: 'asc' }, select: { id: true } });
    if (primaryTenantOutlet) {
        await globalPrisma.tenantOutlet.update({ where: { id: primaryTenantOutlet.id }, data: { outletName: LAUNDRY_SHOP.outletName } });
    }

    for (const [key, value] of Object.entries(LAUNDRY_SHOP.settings)) {
        const def = await globalPrisma.settingDefinition.findFirst({ where: { key, deleted: false } });
        if (!def) continue;   // an older global DB without this key — nothing to set
        if (def.scope === 'OUTLET' && outletId === null) continue;   // no live outlet to scope it to
        const scope = {
            settingDefinitionId: def.id,
            tenantId: def.scope === 'TENANT' ? tenantId : null,
            userId: def.scope === 'USER' ? owner?.id ?? null : null,
            outletId: def.scope === 'OUTLET' ? outletId : null,
        };
        const existing = await prisma.setting.findFirst({ where: { ...scope, deleted: false } });
        if (existing) {
            await prisma.setting.update({ where: { id: existing.id }, data: { value, version: { increment: 1 } } });
        } else {
            await prisma.setting.create({ data: { ...scope, value } });
        }
    }
}

/**
 * The retail demo's outlet name, in Indonesian (createTenant's default is "Main Outlet",
 * which every security alert prints). Same pattern as applyLaundryIdentity: `outlet` is
 * preserved, so this is an update, re-applied on every reseed.
 */
async function applyRetailIdentity(prisma: any, tenantId: number): Promise<void> {
    const primaryOutlet = await prisma.outlet.findFirst({ where: { deleted: false }, orderBy: { id: 'asc' }, select: { id: true } });
    if (primaryOutlet) {
        await prisma.outlet.update({ where: { id: primaryOutlet.id }, data: { outletName: RETAIL_SHOP.outletName } });
    }
    const globalPrisma = getGlobalPrisma();
    const primaryTenantOutlet = await globalPrisma.tenantOutlet.findFirst({ where: { tenantId }, orderBy: { id: 'asc' }, select: { id: true } });
    if (primaryTenantOutlet) {
        await globalPrisma.tenantOutlet.update({ where: { id: primaryTenantOutlet.id }, data: { outletName: RETAIL_SHOP.outletName } });
    }
}

/**
 * Security alerts (Peringatan Keamanan, Pro — docs/modules/ANOMALY.md) for the retail demo:
 * two cashiers trade today, Andi voids three sales and Sari gives 30 % off (SECURITY_STORY).
 *
 * The alerts are NOT written by hand. Each action's rows are written the way the sales
 * service writes them (sale + lines + payment + stock move; a void flips the sale and its
 * payments, stamps the reversal audit and puts the stock back), then the REAL engine runs
 * on them (onSaleReversed / onSaleCompleted) with injected deps: Pro, a cashier's
 * permissions (never '*'), a push that goes nowhere, and `now` = the moment of the action.
 * The resulting anomaly_event rows are what production would have recorded; only their
 * CREATED_AT / UPDATED_AT are moved to that moment, because Prisma stamps the wall clock.
 * The steps run in order on purpose: REVERSAL_BURST counts the voids that exist when it runs.
 *
 * Times: the story ends at an anchor = today, at the current WIB hour clamped to 10–20
 * (the session opens at 08:00), and each step is SECURITY_STORY minutes before it. From
 * 10.00 WIB on, every alert is therefore in the past; a reseed earlier than that dates
 * them 08:08–09:51, ahead of the clock — like the rest of "today", which the seeder also
 * places ahead of the clock in the early morning.
 *
 * `anomaly_event` and `anomaly_rule_config` are not preserved tables, so a reseed wipes and
 * rebuilds them; `user` is preserved, so the cashiers are upserted.
 */
async function seedSecurityAlerts(prisma: any, databaseName: string, tenantId: number): Promise<number> {
    const now = new Date();
    const today = wibToday(now);
    const nowHourWib = new Date(now.getTime() + WIB_OFFSET_MINUTES * 60_000).getUTCHours();
    const anchor = wibInstant(today, Math.max(10, Math.min(20, nowHourWib)), 0);
    const minutesBefore = (m: number) => new Date(anchor.getTime() - m * 60_000);

    const owner = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    const cashiers = new Map<string, { id: number; username: string; name: string }>();
    for (const c of DEMO_CASHIERS) {
        const row = await prisma.user.upsert({
            where: { username: c.username },
            update: { firstName: c.firstName, lastName: c.lastName, deleted: false, deletedAt: null },
            // No global tenant_user row: a staff record for the demo, not a login.
            create: { username: c.username, password: '!', firstName: c.firstName, lastName: c.lastName },
        });
        cashiers.set(c.username, { id: row.id, username: row.username, name: c.firstName });
    }

    // The owner's own limits, through the same validation + upsert the rules screen uses.
    await saveRules(prisma, databaseName, SECURITY_RULE_CONFIG, owner?.id ?? 1);

    const outlet = await prisma.outlet.findFirst({ where: { deleted: false }, orderBy: { id: 'asc' }, select: { id: true } });
    const session = await prisma.session.findFirst({ where: { closingDateTime: null, deleted: false }, orderBy: { id: 'desc' } });
    if (!outlet || !session) throw new Error('Demo seed: no outlet / open session for the security alerts');
    const outletId: number = outlet.id;

    const codes = [...new Set(SECURITY_STORY.flatMap((s) => s.lines.map(([code]) => code)))];
    const itemRows = await prisma.item.findMany({ where: { itemCode: { in: codes } } });
    const items = new Map<string, any>(itemRows.map((i: any) => [i.itemCode, i]));
    const receipts = await prisma.stockReceipt.findMany({ where: { itemId: { in: itemRows.map((i: any) => i.id) } } });
    const receiptOf = new Map<number, number>(receipts.map((r: any) => [r.itemId, r.id]));
    const costOf = new Map<string, number>(RETAIL_ITEMS.map((d) => [d.code, d.cost]));

    /** One stock move against the live balance (what the sales service does per line). */
    const moveStock = async (itemId: number, delta: number, movementType: string, documentId: number, at: Date, extra: object) => {
        const balance = await prisma.stockBalance.findFirst({ where: { itemId, outletId, deleted: false } });
        if (!balance) return;
        await prisma.stockBalance.update({
            where: { id: balance.id },
            data: { availableQuantity: { increment: delta }, onHandQuantity: { increment: delta } },
        });
        await prisma.stockMovement.create({
            data: {
                itemId, outletId, documentId, movementType,
                previousAvailableQuantity: balance.availableQuantity, previousOnHandQuantity: balance.onHandQuantity,
                availableQuantityDelta: delta, onHandQuantityDelta: delta,
                siteId: 1, createdAt: at, ...extra,
            },
        });
    };

    const pushes: string[] = [];
    const failures: string[] = [];
    const depsAt = (at: Date): AnomalyDeps => ({
        prisma: () => prisma,
        isPro: async () => true,                 // the demo is Pro
        permissions: async () => [],             // a cashier, never the owner's '*'
        push: async (_topic, notification) => { pushes.push(notification.title); },
        now: () => at,
        log: (message, error) => { failures.push(`${message}: ${error instanceof Error ? error.message : String(error ?? '')}`); },
    });
    /** Run one engine call "at" `at`, then date the events it wrote at `at` too. */
    const runEngine = async (at: Date, work: (deps: AnomalyDeps) => Promise<void>) => {
        const stamp = async () => new Map<number, number>(
            (await prisma.anomalyEvent.findMany({ select: { id: true, updatedAt: true } })).map((e: any) => [e.id, e.updatedAt.getTime()]),
        );
        const before = await stamp();
        await work(depsAt(at));
        for (const [id, updatedAt] of await stamp()) {
            if (before.get(id) === updatedAt) continue;   // untouched by this step
            await prisma.anomalyEvent.update({ where: { id }, data: { updatedAt: at, ...(before.has(id) ? {} : { createdAt: at }) } });
        }
    };

    invalidateAnomalyConfig(databaseName);
    for (const step of SECURITY_STORY) {
        const cashier = cashiers.get(step.cashier)!;
        const soldAt = minutesBefore(step.soldAt);
        const lines = step.lines.map(([code, qty]) => {
            const item = items.get(code)!;
            const unitPrice = Number(item.price);
            const lineTotal = unitPrice * qty;
            const cost = costOf.get(code)! * qty;
            return {
                item, qty, unitPrice,
                row: {
                    itemId: item.id, itemName: item.itemName, itemCode: item.itemCode, itemBrand: item.itemBrand ?? '',
                    quantity: qty, cost, price: lineTotal, priceBeforeTax: 0, profit: lineTotal - cost,
                    subtotalAmount: lineTotal, unitOfMeasure: item.unitOfMeasure,
                    stockReceiptId: receiptOf.get(item.id) ?? null, createdAt: soldAt,
                },
            };
        });
        const subtotal = lines.reduce((sum, l) => sum + l.row.subtotalAmount, 0);
        const discount = step.discountPercent ? Math.round((subtotal * step.discountPercent) / 100) : 0;
        const total = subtotal - discount;

        const sale = await prisma.sales.create({
            data: {
                outletId, businessDate: soldAt, salesType: 'Walk-In', customerName: '', phoneNumber: '',
                subtotalAmount: subtotal, totalAmount: total, paidAmount: total,
                discountAmount: discount, discountPercentage: step.discountPercent ?? 0,
                profitAmount: lines.reduce((sum, l) => sum + l.row.profit, 0) - discount,
                status: 'Completed', sessionId: session.id, completedSessionId: session.id, eodId: 0,
                performedBy: cashier.name, performedByUserId: cashier.id, siteId: 1, createdAt: soldAt,
                salesItems: { create: lines.map((l) => l.row) },
            },
        });
        await prisma.payment.create({
            data: {
                method: step.method, tenderedAmount: total, paidAmount: total, currencySymbol: 'Rp', salesId: sale.id,
                businessDate: soldAt, status: 'PAID', outletId, sessionId: session.id, eodId: 0,
                performedBy: cashier.name, siteId: 1, createdAt: soldAt,
            },
        });
        for (const l of lines) {
            await moveStock(l.item.id, -l.qty, 'Sales', sale.id, soldAt, { reason: 'Penjualan', remark: '', performedBy: cashier.name });
        }

        const actor = { userId: cashier.id, username: cashier.username };
        if (step.voidAt === undefined) {
            // A completed sale: the discount rules (sales.service completeNewSales hook).
            await runEngine(soldAt, (deps) => onSaleCompleted({
                databaseName, tenantId, actor,
                // Her role may give any discount, so checkout allowed it; the alert still fires above the owner's 20 %.
                permissions: [PERMISSION.GIVE_DISCOUNT],
                saleId: sale.id,
                salesBody: {
                    discountAmount: discount, discountPercentage: step.discountPercent ?? 0, totalItemDiscountAmount: 0,
                    businessDate: soldAt, clientCreatedAt: soldAt,
                    salesItems: lines.map((l) => ({ price: l.unitPrice, quantity: l.qty, discountAmount: 0, discountPercentage: 0 })),
                },
                discountDecision: { action: 'allow' },
            }, deps));
            continue;
        }

        // The void, as sales.service voidSales writes it (claimSalesReversal + payments + stock back).
        const reversedAt = minutesBefore(step.voidAt);
        await prisma.sales.update({
            where: { id: sale.id },
            data: {
                status: 'Voided',
                ...reversalAuditData({ userId: cashier.id, username: cashier.username, reason: { code: step.reason!, note: null }, at: reversedAt }),
            },
        });
        await prisma.payment.updateMany({ where: { salesId: sale.id }, data: { status: 'Voided' } });
        for (const l of lines) {
            await moveStock(l.item.id, l.qty, 'Sales Void', sale.id, reversedAt, { reason: '', remark: `Sales #${sale.id} voided` });
        }
        await runEngine(reversedAt, (deps) => onSaleReversed({ databaseName, tenantId, actor, saleId: sale.id, kind: 'void' }, deps));
    }
    // The engine's config cache was last filled "at" a story time; let the server reload it.
    invalidateAnomalyConfig(databaseName);

    if (failures.length > 0) throw new Error(`Demo seed: the anomaly engine failed — ${failures.join('; ')}`);
    return prisma.anomalyEvent.count();
}

/**
 * Prepaid packages ("Paket Hemat 10x Cuci") and a few regulars who bought one, through
 * the real service so the rows are exactly what the app's own package flow writes.
 * Usage is applied as a quota adjustment rather than fabricated usage-sale links.
 */
async function seedLaundryPackages(prisma: any, databaseName: string): Promise<void> {
    const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });
    const customers = await prisma.customer.findMany({ orderBy: { id: 'asc' } });
    const packageIds: number[] = [];
    for (const p of LAUNDRY_PACKAGES) {
        const pkg = await subscriptionPackageService.createPackage(databaseName, {
            name: p.name, packageType: 'USAGE', price: p.price, totalQuota: p.totalQuota,
            quotaUnit: p.quotaUnit, validityDays: p.validityDays,
            categoryIds: p.categories.map(i => categories[i].id),
        });
        packageIds.push(pkg.id);
    }
    for (const [customerIdx, packageIdx, used] of LAUNDRY_PACKAGE_BUYERS) {
        const p = LAUNDRY_PACKAGES[packageIdx];
        const sub = await subscriptionPackageService.subscribeCustomer(databaseName, {
            customerId: customers[customerIdx].id, subscriptionPackageId: packageIds[packageIdx], paidAmount: p.price,
        });
        await prisma.customerSubscription.update({
            where: { id: sub.id },
            data: { usedQuota: used, remainingQuota: p.totalQuota - used },
        });
    }

    // The loyalty programme the package tab needs is created by seedLoyaltyBaseline,
    // right after this — see there.
}

/**
 * Loyalty baseline for both verticals: programme, reward rule, (laundry) tiers, and every
 * customer's account replayed from their COMPLETED demo sales exactly as the sales
 * service would have earned it — points on the paid total at the tier held before the
 * sale, spend accumulating, tiers promoting, one voucher per Rp 500.000 crossed. The
 * LOYALTY_TARGETS regulars get an opening "kartu stempel" balance on top, so they end
 * on the numbers real-UI captures script against (docs/future/IG_MOTION_POSTS.md §7).
 * Rows are written directly: the services' EARN/reversal descriptions are English audit
 * text (the app renders those rows from type + salesId, but the tour's English guard reads
 * the DB), and vouchers issued before 2026-09-28 carried an English "RM" label.
 */
async function seedLoyaltyBaseline(prisma: any, vertical: DemoVertical): Promise<void> {
    const L = DEMO_LOYALTY;
    const program = await prisma.loyaltyProgram.create({ data: L.program });
    const tiers = vertical === 'laundry'
        ? await Promise.all(L.tiers.map((t) => prisma.loyaltyTier.create({ data: { ...t, loyaltyProgramId: program.id } })))
        : [];
    const tierFor = (spend: number) =>
        [...tiers].sort((a: any, b: any) => Number(b.minSpend) - Number(a.minSpend)).find((t: any) => spend >= Number(t.minSpend)) ?? null;
    const R = L.rewardRule;
    const rule = await prisma.rewardRule.create({
        data: {
            name: R.name, triggerType: 'SPEND_MILESTONE', spendThreshold: R.spendThreshold, isRepeatable: R.isRepeatable,
            discountType: R.discountType, discountPercentage: R.discountPercentage, expiryDays: R.expiryDays,
        },
    });

    const DAY = 24 * 60 * 60_000;
    const now = Date.now();
    const customers = await prisma.customer.findMany({ orderBy: { id: 'asc' } });
    for (const [idx, c] of customers.entries()) {
        const account = await prisma.loyaltyAccount.create({ data: { customerId: c.id, loyaltyProgramId: program.id } });
        const sales = await prisma.sales.findMany({
            where: { customerId: c.id, status: 'Completed' }, orderBy: { createdAt: 'asc' },
            select: { id: true, totalAmount: true, createdAt: true, performedBy: true },
        });
        const windowSpend = sales.reduce((sum: number, x: any) => sum + Number(x.totalAmount), 0);
        const target = LOYALTY_TARGETS.find(([i]) => i === idx);
        const openingSpend = target ? Math.max(0, target[1] - windowSpend) : 0;

        // Replay the window at the tier held before each sale (what the sales service does).
        let spend = openingSpend;
        const earns = sales.map((x: any) => {
            const mult = Number(tierFor(spend)?.pointsMultiplier ?? 1);
            const points = Math.floor(Number(x.totalAmount) * L.program.pointsPerCurrency * mult);
            const before = spend;
            spend += Number(x.totalAmount);
            return { sale: x, points, before, after: spend };
        });
        const windowPoints = earns.reduce((sum: number, e: any) => sum + e.points, 0);
        const openingPoints = target ? Math.max(0, target[2] - windowPoints) : 0;
        if (target && (windowSpend > target[1] || windowPoints > target[2])) {
            console.warn(`[Demo] ${c.firstName}: seeded sales alone exceed the loyalty target — ends at Rp ${spend} / ${windowPoints + openingPoints} poin`);
        }

        const openedAt = new Date((sales[0]?.createdAt?.getTime() ?? now - 10 * DAY) - DAY);
        const expiry = (d: Date) => new Date(d.getTime() + L.program.pointsExpiryDays * DAY);
        let balance = 0;
        if (openingPoints > 0 || openingSpend > 0) {
            balance += openingPoints;
            if (openingPoints > 0) {
                await prisma.loyaltyPointBatch.create({ data: { loyaltyAccountId: account.id, originalPoints: openingPoints, remainingPoints: openingPoints, expiresAt: expiry(openedAt), earnedAt: openedAt, createdAt: openedAt } });
            }
            await prisma.loyaltyTransaction.create({ data: { loyaltyAccountId: account.id, type: 'ADJUST', points: openingPoints, balanceAfter: balance, description: L.openingDescription, createdAt: openedAt } });
        }
        for (const e of earns) {
            if (e.points <= 0) continue;
            balance += e.points;
            const at = e.sale.createdAt;
            await prisma.loyaltyPointBatch.create({ data: { loyaltyAccountId: account.id, originalPoints: e.points, remainingPoints: e.points, expiresAt: expiry(at), earnedAt: at, salesId: e.sale.id, createdAt: at } });
            await prisma.loyaltyTransaction.create({ data: { loyaltyAccountId: account.id, type: 'EARN', points: e.points, balanceAfter: balance, salesId: e.sale.id, performedBy: e.sale.performedBy, createdAt: at } });
        }

        // One voucher per threshold crossed, dated at the crossing — so checkMilestones
        // finds every slot filled and the next real sale issues nothing unexpected.
        const threshold = R.spendThreshold;
        const slots = Math.floor(spend / threshold);
        for (let k = 1; k <= slots; k++) {
            const crossing = earns.find((e: any) => e.before < k * threshold && e.after >= k * threshold);
            const issuedAt = crossing ? crossing.sale.createdAt : openedAt;
            const expiresAt = new Date(issuedAt.getTime() + R.expiryDays * DAY);
            await prisma.voucher.create({
                data: {
                    rewardRuleId: rule.id, customerId: c.id, loyaltyAccountId: account.id,
                    discountType: R.discountType, discountPercentage: R.discountPercentage,
                    status: expiresAt.getTime() < now ? 'EXPIRED' : 'ACTIVE',
                    milestoneSpendSnapshot: crossing ? crossing.after : openingSpend,
                    label: R.label, expiresAt, createdAt: issuedAt,
                },
            });
        }

        await prisma.loyaltyAccount.update({
            where: { id: account.id },
            data: {
                currentPoints: balance, totalEarned: balance, totalSpend: spend,
                loyaltyTierId: tierFor(spend)?.id ?? null, joinedAt: openedAt,
            },
        });
    }
}

/**
 * Where a laundry order sits in the intake→pickup pipeline. Older orders are done;
 * the last two days hold the work-in-progress that makes the Pickup screen worth
 * opening during a demo.
 */
function laundryStatus(daysBack: number, rnd: () => number): string {
    if (daysBack >= 2) return 'COLLECTED';
    if (daysBack === 1) return rnd() < 0.7 ? 'READY' : 'PROCESSING';
    return rnd() < 0.55 ? 'INTAKE' : 'PROCESSING';
}

/**
 * Nightly reset entry point. `createIfMissing:false` — this must never conjure a demo
 * tenant on an environment that was not deliberately provisioned.
 */
export async function resetDemoTenants(): Promise<DemoSeedResult[]> {
    const results: DemoSeedResult[] = [];
    for (const vertical of ['retail', 'laundry'] as DemoVertical[]) {
        try {
            const r = await seedDemoTenant(vertical, { createIfMissing: false });
            results.push(r);
            if (!r.skipped) {
                console.log(`[Demo] Reset ${r.tenantName}: ${r.items} items, ${r.sales} sales, Rp ${r.revenue.toLocaleString('id-ID')}`);
                await disconnectTenantClient(r.databaseName);
            }
        } catch (error) {
            // One vertical failing must not stop the other from resetting.
            console.error(`[Demo] Reset failed for ${DEMO_TENANTS[vertical].tenantName}:`, error);
        }
    }
    return results;
}
