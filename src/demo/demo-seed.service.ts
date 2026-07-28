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
} from './demo-catalogue';

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
        await adminService.createTenant({ tenant: { tenantName, plan: DEMO_PLAN, planType } });
        tenant = await globalPrisma.tenant.findFirst({ where: { tenantName } });
        if (!tenant) throw new Error(`createTenant reported success but "${tenantName}" is not in the global DB.`);
        created = true;
    }

    const databaseName = tenant.databaseName!;
    const prisma = getTenantPrisma(databaseName);

    await wipeOwnedTables(prisma);
    const result = await seedTenantData(prisma, vertical);

    return { vertical, tenantName, databaseName, skipped: false, created, ...result };
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
    // hand-maintained topological sort of the whole schema.
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    try {
        for (const table of targets) {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
        }
    } finally {
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }
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

    const now = new Date();
    const today = wibToday(now);
    const outletId = 1;
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

            for (const it of chosen) {
                const qty = randInt(rnd, 1, it.def.maxQty ?? 3);
                const lineSubtotal = it.def.price * qty;
                const lineCost = it.def.cost * qty;
                subtotal += lineSubtotal;
                profit += lineSubtotal - lineCost;

                const isWash = it.def.defaultLoadWeightKg != null;
                lines.push({
                    itemId: it.id,
                    itemName: it.def.name,
                    itemCode: it.def.code,
                    itemBrand: it.def.brand ?? '',
                    quantity: qty,
                    cost: it.def.cost * qty,
                    price: it.def.price,
                    priceBeforeTax: it.def.price,
                    profit: lineSubtotal - lineCost,
                    subtotalAmount: lineSubtotal,
                    unitOfMeasure: it.def.unitOfMeasure,
                    // A real machine load is never exactly the nominal size — reporting
                    // kg has to come from the weighed value, not the item default. NOT
                    // multiplied by qty: report.service counts one *line* as one load
                    // (`_count.id`), so wash services are capped at qty 1 in the
                    // catalogue and two loads means two lines.
                    loadWeightKg: isWash
                        ? Number((it.def.defaultLoadWeightKg! * (0.72 + rnd() * 0.33)).toFixed(2))
                        : null,
                    itemStatus: isLaundry ? laundryStatus(back, rnd) : null,
                    stockReceiptId: it.receiptId,
                    createdAt: at,
                });
            }

            // A quarter of baskets are a known face — enough for the customer screens and
            // loyalty pitch to have substance, not so many that "Walk-In" disappears.
            const withCustomer = rnd() < (isLaundry ? 0.55 : 0.25);
            const customerIdx = randInt(rnd, 0, DEMO_CUSTOMERS.length - 1);
            const customer = DEMO_CUSTOMERS[customerIdx];

            const collected = isLaundry && back >= 2;
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
                    paidAmount: subtotal,
                    profitAmount: profit,
                    status: 'Completed',
                    sessionId: session.id,
                    completedSessionId: session.id,
                    eodId: 0,
                    performedBy,
                    siteId: 1,
                    createdAt: at,
                    ...(isLaundry
                        ? {
                            orderRef: orderRef(rnd),
                            friendlyNumber: friendlyNumber(day, n + 1),
                            collectedAt: collected ? wibInstant(shiftDays(day, 1), 11, 0) : null,
                        }
                        : {}),
                    salesItems: { create: lines },
                },
            });

            const method = weightedPick(rnd, PAYMENT_MIX).method;
            if (method === 'Cash') cashTaken += subtotal;
            await prisma.payment.create({
                data: {
                    method,
                    tenderedAmount: subtotal,
                    paidAmount: subtotal,
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

            // Stock only moves for goods. Laundry services consume nothing here — supply
            // depletion is deliberately out of scope (see DEMO_STARTER_KIT.md §10).
            for (const line of lines) {
                const it = items.find(i => i.id === line.itemId)!;
                if (!it.def.opening) continue;
                const before = it.qty;
                it.qty = Math.max(0, before - Number(line.quantity));
                await prisma.stockMovement.create({
                    data: {
                        itemId: it.id, outletId,
                        previousAvailableQuantity: before, previousOnHandQuantity: before,
                        availableQuantityDelta: it.qty - before, onHandQuantityDelta: it.qty - before,
                        movementType: 'Sales', documentId: sale.id,
                        reason: 'Sales transaction', remark: '', performedBy, siteId: 1,
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
