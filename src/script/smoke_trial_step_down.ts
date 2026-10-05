/*
 * End-to-end smoke: a tenant on the 30-day PRO TRIAL steps down to BASIC and
 * everything it already holds keeps working. LOCAL ONLY (host guard below).
 *
 * Creates two throwaway tenants per run (Retail + Laundry Pro trial, via the
 * same admin.service.createTenant the /admin/signup route uses), drives the
 * tenant API over HTTP against the running local server (PM2 `web-app`,
 * http://localhost:8081) with the tenant's own JWT, calls the admin service
 * directly for the operator actions (changeTenantPlan, recordPayment,
 * createOutletForTenant, createTenantUser), asserts DB state, and finally
 * drops both tenants (tenant DB + every global row) unless --keep is given.
 *
 *   npx tsx src/script/smoke_trial_step_down.ts            # run + clean up
 *   npx tsx src/script/smoke_trial_step_down.ts --keep     # leave tenants for inspection
 *
 * Exit code 1 on any failed check.
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { Decimal } from "decimal.js";

// ---- safety: refuse to run against anything that isn't local ----
for (const key of ["TENANT_DATABASE_URL", "GLOBAL_DB_URL"]) {
    const url = process.env[key] || "";
    if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
        console.error(`ABORT: ${key} is not local (127.0.0.1/localhost). Refusing to run.`);
        console.error("       host seen: " + (url.match(/@([^:/]+)/)?.[1] || "?"));
        process.exit(1);
    }
}
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:8081";
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
    console.error(`ABORT: SMOKE_BASE_URL ${BASE} is not local.`);
    process.exit(1);
}
const KEEP = process.argv.includes("--keep");

const adminService = require("../admin/admin.service") as any;
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");
const { ADD_ON_IDS } = require("../constants/add-on-ids") as typeof import("../constants/add-on-ids");

// ---------------------------------------------------------------------------
// check() + helpers
// ---------------------------------------------------------------------------
let passed = 0;
const failures: string[] = [];
const check = (name: string, cond: boolean, detail = "") => {
    if (cond) {
        passed++;
        console.log(`  ✔ ${name}`);
    } else {
        failures.push(`${name} ${detail}`);
        console.log(`  ✘ ${name} ${detail}`);
    }
};
const n = (v: any) => new Decimal(v ?? 0).toNumber();
const section = (title: string) => console.log(`\n── ${title}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitHealth(timeoutMs = 90_000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
        try {
            const r = await fetch(`${BASE}/health`);
            if (r.ok) return;
        } catch { /* restarting */ }
        await sleep(1000);
    }
    throw new Error(`server at ${BASE} not healthy after ${timeoutMs}ms`);
}

type ApiRes = { status: number; body: any };
async function api(
    method: string,
    path: string,
    opts: { token?: string; outletId?: number; body?: any; idem?: boolean } = {},
): Promise<ApiRes> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers.token = opts.token;
    if (opts.outletId) headers["X-Outlet-ID"] = String(opts.outletId);
    if (opts.idem) headers["X-Idempotency-Key"] = crypto.randomUUID();
    const init: RequestInit = { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined };
    let res: Response;
    try {
        res = await fetch(`${BASE}${path}`, init);
    } catch {
        // PM2 watch may be restarting the server (a file under src/ changed): wait and retry once.
        await waitHealth();
        res = await fetch(`${BASE}${path}`, init);
    }
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body };
}
const errMsg = (r: ApiRes) => r.body?.error?.message ?? (typeof r.body === "string" ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 300));
/** Unwrap a 2xx response or throw — used for setup steps that must succeed. */
const must = (r: ApiRes, what: string) => {
    if (r.status < 200 || r.status >= 300 || r.body?.success === false) {
        throw new Error(`${what} failed: HTTP ${r.status} ${errMsg(r)}`);
    }
    return r.body.data;
};

// ---------------------------------------------------------------------------
// Tenant lifecycle
// ---------------------------------------------------------------------------
type Tenant = { id: number; name: string; db: string };
const created: Tenant[] = [];

async function createTrialTenant(name: string, planType: "Retail" | "Laundry"): Promise<Tenant> {
    const g: any = getGlobalPrisma();
    if (await g.tenant.findFirst({ where: { tenantName: name } })) throw new Error(`tenant ${name} already exists`);
    console.log(`  creating ${planType} Pro-trial tenant "${name}" (runs prisma migrate deploy, ~30s)...`);
    // Same call as create_test_tenant.ts / POST /admin/signup. "Trial" = 30-day Pro trial.
    await adminService.createTenant({ tenant: { tenantName: name, plan: "Trial", planType, password: name } });
    const row = await g.tenant.findFirst({ where: { tenantName: name } });
    const t = { id: row.id, name, db: row.databaseName };
    created.push(t);
    return t;
}

/** Drop the tenant DB and every global row that references the tenant. */
async function dropTenant(t: Tenant) {
    const g: any = getGlobalPrisma();
    const users = await g.tenantUser.findMany({ where: { tenantId: t.id }, select: { id: true } });
    const userIds = users.map((u: any) => u.id);
    const devices = await g.pushyDevice.findMany({ where: { tenantUserId: { in: userIds } }, select: { id: true } });
    await g.refreshToken.deleteMany({ where: { tenantUserId: { in: userIds } } });
    if (devices.length) {
        await g.pushySubscription.deleteMany({ where: { deviceId: { in: devices.map((d: any) => d.id) } } });
        await g.pushyDeviceAllocation.deleteMany({ where: { tenantId: t.id } });
        await g.pushyDevice.deleteMany({ where: { id: { in: devices.map((d: any) => d.id) } } });
    }
    await g.pushyDeviceAllocation.deleteMany({ where: { tenantId: t.id } });
    await g.tenantPayment.deleteMany({ where: { tenantId: t.id } });
    await g.customPriceLog.deleteMany({ where: { tenantId: t.id } });
    await g.tenantAddOn.deleteMany({ where: { tenantId: t.id } });
    const subs = await g.tenantSubscription.findMany({ where: { tenantId: t.id }, select: { id: true } });
    await g.tenantSubscriptionAddOn.deleteMany({ where: { tenantSubscriptionId: { in: subs.map((s: any) => s.id) } } });
    await g.tenantSubscription.deleteMany({ where: { tenantId: t.id } });
    await g.tenantWarehouse.deleteMany({ where: { tenantId: t.id } });
    await g.tenantOutlet.deleteMany({ where: { tenantId: t.id } });
    await g.tenantUser.deleteMany({ where: { tenantId: t.id } });
    await g.tenant.delete({ where: { id: t.id } });
    await getTenantPrisma(t.db).$disconnect().catch(() => undefined);
    await g.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${t.db}\``);
}

async function login(username: string, password: string) {
    return must(await api("POST", "/auth/login", { body: { username, password } }), `login ${username}`);
}

// ---------------------------------------------------------------------------
// Seeding (tenant DB) + sale payload (mirrors the Flutter SalesDO/PaymentDO maps)
// ---------------------------------------------------------------------------
type SeedItem = { id: number; code: string; name: string; price: number; cost: number; categoryId: number };

async function seedItem(prisma: any, o: { code: string; price: number; cost: number; categoryId: number; supplierId: number; trackStock: boolean; stockAtOutlet?: { outletId: number; qty: number } }): Promise<SeedItem> {
    const it = await prisma.item.create({
        data: {
            itemName: o.code, itemCode: o.code, itemBrand: "", itemModel: "",
            category: { connect: { id: o.categoryId } }, supplier: { connect: { id: o.supplierId } },
            cost: new Decimal(o.cost), price: new Decimal(o.price), unitOfMeasure: "Piece",
            trackStock: o.trackStock, hasVariants: false,
        },
    });
    if (o.stockAtOutlet) {
        const { outletId, qty } = o.stockAtOutlet;
        await prisma.stockReceipt.create({ data: { itemId: it.id, outletId, quantity: new Decimal(qty), cost: new Decimal(o.cost), receiptDate: new Date("2026-01-01T00:00:00Z") } });
        await prisma.stockBalance.create({ data: { itemId: it.id, outletId, availableQuantity: new Decimal(qty), onHandQuantity: new Decimal(qty) } });
    }
    return { id: it.id, code: o.code, name: o.code, price: o.price, cost: o.cost, categoryId: o.categoryId };
}

function buildSale(o: {
    outletId: number;
    performedBy: string;
    customerId: number;
    customerName: string;
    lines: { item: SeedItem; qty: number }[];
    voucher?: { id: number; amount: number };
    points?: { n: number; value: number };
    pkg?: { id: number; amount: number; qtyUsed: number };
    salesType?: string;
}) {
    const now = new Date().toISOString();
    const subtotal = o.lines.reduce((s, l) => s + l.item.price * l.qty, 0);
    const total = subtotal - (o.voucher?.amount ?? 0) - (o.points?.value ?? 0) - (o.pkg?.amount ?? 0);
    const sales: any = {
        id: 0, outletId: o.outletId, businessDate: now, clientCreatedAt: now,
        salesType: o.salesType ?? "Retail", customerId: o.customerId, customerName: o.customerName, phoneNumber: "",
        status: "Completed", remark: "SMOKE-TRIAL-STEP-DOWN", sessionId: 0, eodId: 0, performedBy: o.performedBy,
        deleted: false, profitAmount: 0, discountAmount: 0, discountPercentage: 0, totalItemDiscountAmount: 0,
        subtotalAmount: subtotal, taxAmount: 0, serviceChargeAmount: 0, roundingAmount: 0,
        totalAmount: total, paidAmount: total, changeAmount: 0, isTaxInclusive: false,
        salesItems: o.lines.map((l) => ({
            id: 0, salesId: 0, itemId: l.item.id, itemCode: l.item.code, itemName: l.item.name,
            itemBrand: "", itemModel: "", quantity: l.qty, cost: l.item.cost, price: l.item.price,
            priceBeforeTax: l.item.price * l.qty, profit: 0, discountPercentage: 0, discountAmount: 0,
            serviceChargeAmount: 0, taxAmount: 0, subtotalAmount: l.item.price * l.qty, remark: "", deleted: false,
        })),
    };
    if (o.points) {
        sales.loyaltyPointsToRedeem = o.points.n;
        sales.loyaltyPointsRedemptionValue = o.points.value;
    }
    if (o.voucher) {
        sales.voucherId = o.voucher.id;
        sales.voucherDiscountAmount = o.voucher.amount;
    }
    if (o.pkg) {
        sales.customerSubscriptionId = o.pkg.id;
        sales.subscriptionQuantityUsed = o.pkg.qtyUsed;
        sales.subscriptionDiscountAmount = o.pkg.amount;
    }
    const payments = total > 0 ? [{
        method: "Cash", tenderedAmount: total, paidAmount: total, currencySymbol: "Rp", reference: "", remark: "",
        businessDate: now, status: "PAID", outletId: o.outletId, sessionId: 0, eodId: 0, performedBy: o.performedBy,
    }] : [];
    return { body: { sales, payments }, total };
}

async function subsOf(tenantId: number) {
    return (getGlobalPrisma() as any).tenantSubscription.findMany({
        where: { tenantId }, include: { subscriptionPlan: true }, orderBy: { outletId: "asc" },
    });
}
async function extraUserQty(tenantId: number): Promise<number> {
    const row = await (getGlobalPrisma() as any).tenantAddOn.findUnique({
        where: { tenantId_addOnId: { tenantId, addOnId: ADD_ON_IDS.EXTRA_USER } },
    });
    return row?.quantity ?? 0;
}
async function expectedOverage(tenantId: number) {
    const subs = await subsOf(tenantId);
    const included = subs.reduce((s: number, x: any) => s + (x.subscriptionPlan?.maxUsers ?? 0), 0);
    const users = await (getGlobalPrisma() as any).tenantUser.count({ where: { tenantId, isDeleted: false } });
    return { users, included, overage: Math.max(0, users - included) };
}

// ---------------------------------------------------------------------------
// RETAIL
// ---------------------------------------------------------------------------
async function runRetail(stamp: string) {
    section("RETAIL — setup on the Pro trial");
    const t = await createTrialTenant(`sdr_${stamp}`, "Retail");
    const g: any = getGlobalPrisma();
    const prisma: any = getTenantPrisma(t.db);

    const auth = await login(t.name, t.name);
    let token: string = auth.token;
    const outletId: number = auth.allowedOutletIds?.[0];
    check("login on trial: planName Pro", auth.planName === "Pro", `(got ${auth.planName})`);
    check("login on trial: loyaltyTier basic (Retail Pro, no add-on)", auth.loyaltyTier === "basic", `(got ${auth.loyaltyTier})`);
    const trialSubs0 = await subsOf(t.id);
    check("subscription status 'trial'", trialSubs0.length === 1 && trialSubs0[0].status === "trial", `(got ${trialSubs0.map((s: any) => s.status)})`);

    // Seed catalogue: one stocked item for sales, one for the warehouse delivery order.
    const cat = await prisma.category.create({ data: { name: "Smoke Umum" } });
    const sup = await prisma.supplier.create({ data: { companyName: "Smoke Supplier", hasTax: false } });
    const itemA = await seedItem(prisma, { code: "SMK-A", price: 50000, cost: 20000, categoryId: cat.id, supplierId: sup.id, trackStock: true, stockAtOutlet: { outletId, qty: 20 } });
    const itemW = await seedItem(prisma, { code: "SMK-W", price: 3000, cost: 1000, categoryId: cat.id, supplierId: sup.id, trackStock: true });

    // 1. Loyalty program → customer (auto-enrolled) → points → two vouchers.
    const program = must(await api("POST", "/loyalty/program", { token, outletId, body: { name: "Smoke Points", pointsPerCurrency: 0.01, currencyPerPoint: 100, minRedeemPoints: 0 } }), "create loyalty program");
    const custRes = must(await api("POST", "/customer/create", { token, outletId, body: { customers: [{ firstName: "Smoke", lastName: "Enrolled", mobile: `08${stamp}1` }] } }), "create customer");
    const c1 = custRes[0].id as number;
    let acc = must(await api("GET", `/loyalty/account/customer/${c1}`, { token, outletId }), "get loyalty account");
    if (!acc) {
        acc = must(await api("POST", "/loyalty/enroll", { token, outletId, body: { customerId: c1, loyaltyProgramId: program.id } }), "enroll");
        console.log("    (customer was not auto-enrolled; enrolled via POST /loyalty/enroll)");
    } else {
        console.log("    (customer auto-enrolled on create — POST /customer/create with an active program)");
    }
    check("customer #1 has a loyalty account", !!acc?.id);
    must(await api("POST", `/loyalty/account/${acc.id}/earn`, { token, outletId, body: { points: 200, description: "smoke seed" } }), "earn points");
    const pointsStart = n((await prisma.loyaltyAccount.findUnique({ where: { id: acc.id } })).currentPoints);
    check("customer #1 holds 200 points", pointsStart === 200, `(got ${pointsStart})`);

    const issue = async (customerId: number, label: string) =>
        must(await api("POST", "/voucher/issue", { token, outletId, body: { customerId, discountType: "FIXED", discountAmount: 5000, expiryDays: 30, label } }), `issue voucher ${label}`);
    const v1 = await issue(c1, "Smoke V1");
    const v2 = await issue(c1, "Smoke V2");

    // A customer with NO loyalty account (created straight in the DB: through the API
    // with an active program they would be auto-enrolled) holding a voucher.
    const c2row = await prisma.customer.create({ data: { firstName: "Smoke", lastName: "NotEnrolled", mobile: `08${stamp}2` } });
    const c2 = c2row.id as number;
    check("customer #2 has no loyalty account", (await prisma.loyaltyAccount.count({ where: { customerId: c2 } })) === 0);
    const v3 = await issue(c2, "Smoke V3 (not enrolled)");
    check("three ACTIVE vouchers issued on trial", [v1, v2, v3].every((v: any) => v?.status === "ACTIVE"));

    // 2. Two extra logins (3 users) + a second outlet during the trial.
    for (const suffix of ["u1", "u2"]) await adminService.createTenantUser(t.id, { username: `${t.name}_${suffix}`, password: `${t.name}_${suffix}` });
    const usersNow = await g.tenantUser.count({ where: { tenantId: t.id, isDeleted: false } });
    check("3 active users", usersNow === 3, `(got ${usersNow})`);
    check("no EXTRA_USER on the trial (3 users ≤ Pro 3)", (await extraUserQty(t.id)) === 0, `(got ${await extraUserQty(t.id)})`);

    const outletRes = await adminService.createOutletForTenant(t.id, { outletName: "Smoke Outlet 2" });
    const subsAfterOutlet = await subsOf(t.id);
    const primarySub = subsAfterOutlet.find((s: any) => s.outletId !== outletRes.outlet.globalOutletId);
    const newSub = subsAfterOutlet.find((s: any) => s.outletId === outletRes.outlet.globalOutletId);
    check("createOutletForTenant on trial → new outlet subscription status 'trial'", newSub?.status === "trial", `(got ${newSub?.status})`);
    check("new outlet subscription validUntil == primary's",
        !!newSub && !!primarySub && new Date(newSub.subscriptionValidUntil).getTime() === new Date(primarySub.subscriptionValidUntil).getTime(),
        `(new ${newSub?.subscriptionValidUntil?.toISOString?.()} vs primary ${primarySub?.subscriptionValidUntil?.toISOString?.()})`);
    check("new outlet on the Pro plan", newSub?.subscriptionPlan?.planName === "Pro", `(got ${newSub?.subscriptionPlan?.planName})`);

    // (optional) A delivery order received into the Main Warehouse during the trial.
    const tw = await prisma.warehouse.findFirst({ where: { deleted: false } });
    check("trial tenant has an open warehouse", !!tw);
    const doRes = must(await api("POST", "/deliveryOrder/create", {
        token, outletId, idem: true,
        body: { deliveryOrders: [{ outletId, status: "Received", performedBy: t.name, destinationLocationType: "WAREHOUSE", warehouseId: tw.id,
            deliveryOrderItems: [{ itemId: itemW.id, orderedQuantity: 10, receivedQuantity: 10, unitPrice: 1000, deliveryFee: 0 }] }] },
    }), "create warehouse delivery order");
    const doId = doRes[0].id as number;
    const whBal0 = await prisma.warehouseStockBalance.findFirst({ where: { itemId: itemW.id, warehouseId: tw.id, deleted: false } });
    check("DO received 10 into the warehouse", n(whBal0?.availableQuantity) === 10, `(got ${whBal0?.availableQuantity})`);

    // 3. The "queued" sale, rung up on the trial: voucher #1 (5,000) + 50 points (5,000).
    const queued = buildSale({ outletId, performedBy: t.name, customerId: c1, customerName: "Smoke Enrolled",
        lines: [{ item: itemA, qty: 1 }], voucher: { id: v1.id, amount: 5000 }, points: { n: 50, value: 5000 } });

    // 4. STEP DOWN.
    section("RETAIL — step down Pro trial → Basic");
    const before = await subsOf(t.id);
    const result = await adminService.changeTenantPlan(t.id, "Basic");
    check("changeTenantPlan returns success", result?.success === true);
    const after = await subsOf(t.id);
    check("every outlet subscription is now Basic", after.length === 2 && after.every((s: any) => s.subscriptionPlan.planName === "Basic"), `(got ${after.map((s: any) => s.subscriptionPlan.planName)})`);
    check("every outlet subscription status 'Active' (trial ended)", after.every((s: any) => s.status === "Active"), `(got ${after.map((s: any) => s.status)})`);
    check("validUntil unchanged on every outlet",
        after.every((s: any) => new Date(s.subscriptionValidUntil).getTime() === new Date(before.find((b: any) => b.id === s.id).subscriptionValidUntil).getTime()));
    const ov = await expectedOverage(t.id);
    const eu = await extraUserQty(t.id);
    console.log(`    users ${ov.users}, included ${ov.included} (Basic Retail maxUsers=${after[0].subscriptionPlan.maxUsers} × ${after.length} outlets) → overage ${ov.overage}`);
    check("EXTRA_USER quantity = users − Σ Basic maxUsers", eu === ov.overage, `(got ${eu}, want ${ov.overage})`);
    const gw = await g.tenantWarehouse.findMany({ where: { tenantId: t.id } });
    check("global warehouses soft-deleted", gw.length > 0 && gw.every((w: any) => w.deleted && !w.isActive), JSON.stringify(gw.map((w: any) => ({ d: w.deleted, a: w.isActive }))));
    check("tenant warehouses soft-deleted", (await prisma.warehouse.count({ where: { deleted: false } })) === 0);
    const drained = await prisma.stockBalance.findFirst({ where: { itemId: itemW.id, outletId, deleted: false } });
    check("warehouse stock drained to the outlet (10)", n(drained?.availableQuantity) === 10, `(got ${drained?.availableQuantity})`);
    const rt = await g.refreshToken.findUnique({ where: { token: auth.refreshToken } });
    check("plan change did NOT revoke the refresh token", !!rt && rt.revoked == null, `(revoked=${rt?.revoked})`);

    // 5. Refresh → Basic claims.
    section("RETAIL — refresh token after the step down");
    const ref = await api("POST", "/auth/refresh-token", { body: { refreshToken: auth.refreshToken } });
    check("POST /auth/refresh-token → 200", ref.status === 200, `(HTTP ${ref.status} ${errMsg(ref)})`);
    check("refreshed planName Basic", ref.body?.data?.planName === "Basic", `(got ${ref.body?.data?.planName})`);
    check("refreshed loyaltyTier none", ref.body?.data?.loyaltyTier === "none", `(got ${ref.body?.data?.loyaltyTier})`);
    token = ref.body?.data?.token ?? token;

    // 6. Held value is still usable on Basic.
    section("RETAIL — vouchers + points held from the trial, used on Basic");
    const vl = await api("GET", `/voucher/customer/${c1}`, { token, outletId });
    const vlIds = (vl.body?.data ?? []).map((v: any) => v.id);
    check("GET /voucher/customer/:id on Basic → 200", vl.status === 200, `(HTTP ${vl.status} ${errMsg(vl)})`);
    check("lists both ACTIVE vouchers", vlIds.includes(v1.id) && vlIds.includes(v2.id), `(got ${JSON.stringify(vlIds)})`);
    const vi = await api("POST", "/voucher/issue", { token, outletId, body: { customerId: c1, discountType: "FIXED", discountAmount: 5000, expiryDays: 30, label: "nope" } });
    check("POST /voucher/issue on Basic → refused (402/403)", vi.status === 403 || vi.status === 402, `(HTTP ${vi.status})`);

    const stockA0 = n((await prisma.stockBalance.findFirst({ where: { itemId: itemA.id, outletId } })).availableQuantity);
    const qs = await api("POST", "/sales/completeNewSales", { token, outletId, body: queued.body, idem: true });
    check("queued trial sale (voucher + points) accepted on Basic → 200", qs.status === 200, `(HTTP ${qs.status} ${errMsg(qs)})`);
    const qsId = qs.body?.data?.id as number;
    const qsRow = qsId ? await prisma.sales.findUnique({ where: { id: qsId } }) : null;
    check("sale row: voucherId stored", qsRow?.voucherId === v1.id, `(got ${qsRow?.voucherId})`);
    check("sale row: voucherDiscountAmount 5000", n(qsRow?.voucherDiscountAmount) === 5000, `(got ${qsRow?.voucherDiscountAmount})`);
    check("sale row: loyaltyPointsRedeemed 50", n(qsRow?.loyaltyPointsRedeemed) === 50, `(got ${qsRow?.loyaltyPointsRedeemed})`);
    check("sale row: loyaltyPointsEarned 0 (points frozen below Pro)", n(qsRow?.loyaltyPointsEarned) === 0, `(got ${qsRow?.loyaltyPointsEarned})`);
    const v1Row = await prisma.voucher.findUnique({ where: { id: v1.id } });
    check("voucher #1 REDEEMED", v1Row?.status === "REDEEMED", `(got ${v1Row?.status})`);
    const pointsAfterQueued = n((await prisma.loyaltyAccount.findUnique({ where: { id: acc.id } })).currentPoints);
    check("points decreased by exactly 50 (200 → 150)", pointsAfterQueued === pointsStart - 50, `(got ${pointsAfterQueued})`);
    check("no EARN transaction for the sale", qsId ? (await prisma.loyaltyTransaction.count({ where: { salesId: qsId, type: "EARN" } })) === 0 : false);
    const stockA1 = n((await prisma.stockBalance.findFirst({ where: { itemId: itemA.id, outletId } })).availableQuantity);
    check("stock deducted by the queued sale (−1)", stockA1 === stockA0 - 1, `(${stockA0} → ${stockA1})`);

    const s2 = buildSale({ outletId, performedBy: t.name, customerId: c1, customerName: "Smoke Enrolled", lines: [{ item: itemA, qty: 1 }], voucher: { id: v2.id, amount: 5000 } });
    const s2r = await api("POST", "/sales/completeNewSales", { token, outletId, body: s2.body, idem: true });
    check("new Basic sale with voucher #2 → 200", s2r.status === 200, `(HTTP ${s2r.status} ${errMsg(s2r)})`);
    check("voucher #2 REDEEMED", (await prisma.voucher.findUnique({ where: { id: v2.id } }))?.status === "REDEEMED");
    const s2Row = s2r.body?.data?.id ? await prisma.sales.findUnique({ where: { id: s2r.body.data.id } }) : null;
    check("sale #2 earned 0 points", n(s2Row?.loyaltyPointsEarned) === 0, `(got ${s2Row?.loyaltyPointsEarned})`);
    const pointsAfterS2 = n((await prisma.loyaltyAccount.findUnique({ where: { id: acc.id } })).currentPoints);
    check("points unchanged by a Basic sale (no earn)", pointsAfterS2 === pointsAfterQueued, `(got ${pointsAfterS2})`);
    check("no milestone voucher issued on Basic", (await prisma.voucher.count({ where: { customerId: c1, rewardRuleId: { not: null } } })) === 0);

    const s3 = buildSale({ outletId, performedBy: t.name, customerId: c2, customerName: "Smoke NotEnrolled", lines: [{ item: itemA, qty: 1 }], voucher: { id: v3.id, amount: 5000 } });
    const s3r = await api("POST", "/sales/completeNewSales", { token, outletId, body: s3.body, idem: true });
    check("Basic sale for the NON-enrolled customer with their voucher → 200", s3r.status === 200, `(HTTP ${s3r.status} ${errMsg(s3r)})`);
    const s3Id = s3r.body?.data?.id as number;
    check("non-enrolled customer's voucher REDEEMED", (await prisma.voucher.findUnique({ where: { id: v3.id } }))?.status === "REDEEMED");

    const vd3 = s3Id ? await api("PUT", `/sales/void/${s3Id}`, { token, outletId, body: {}, idem: true }) : { status: 0, body: null };
    check("void the non-enrolled voucher sale → 200", vd3.status === 200, `(HTTP ${vd3.status} ${errMsg(vd3 as ApiRes)})`);
    check("voided → voucher #3 back to ACTIVE", (await prisma.voucher.findUnique({ where: { id: v3.id } }))?.status === "ACTIVE");

    const vdq = qsId ? await api("PUT", `/sales/void/${qsId}`, { token, outletId, body: {}, idem: true }) : { status: 0, body: null };
    check("void the queued sale → 200", vdq.status === 200, `(HTTP ${vdq.status} ${errMsg(vdq as ApiRes)})`);
    const pointsAfterVoid = n((await prisma.loyaltyAccount.findUnique({ where: { id: acc.id } })).currentPoints);
    check("voided → points back to the pre-sale balance (200)", pointsAfterVoid === pointsStart, `(got ${pointsAfterVoid})`);
    check("voided → REDEEM_REVERSAL of 50 written", qsId
        ? n((await prisma.loyaltyTransaction.findFirst({ where: { salesId: qsId, type: "REDEEM_REVERSAL" } }))?.points) === 50
        : false);
    check("voided → voucher #1 back to ACTIVE", (await prisma.voucher.findUnique({ where: { id: v1.id } }))?.status === "ACTIVE");

    // 7. Role sync drops push topics below Pro.
    section("RETAIL — role sync / warehouses / delivery order / billing");
    const rs = await api("GET", "/role/sync", { token, outletId });
    check("GET /role/sync → 200", rs.status === 200, `(HTTP ${rs.status} ${errMsg(rs)})`);
    check("role sync notificationTopics is []", Array.isArray(rs.body?.notificationTopics) && rs.body.notificationTopics.length === 0, `(got ${JSON.stringify(rs.body?.notificationTopics)})`);

    // 8. Warehouses are Pro-only.
    const wh = await api("GET", "/warehouses/sync", { token, outletId });
    check("GET /warehouses/sync on Basic → 402", wh.status === 402, `(HTTP ${wh.status})`);

    // (optional) Cancelling the warehouse DO after the warehouse closed is refused.
    const outW0 = n((await prisma.stockBalance.findFirst({ where: { itemId: itemW.id, outletId, deleted: false } }))?.availableQuantity);
    const dc = await api("PUT", "/deliveryOrder/update", { token, outletId, body: { id: doId, outletId, status: "CANCELLED", performedBy: t.name }, idem: true });
    check("cancel DO received into the closed warehouse → refused (4xx)", dc.status >= 400 && dc.status < 500, `(HTTP ${dc.status})`);
    check("refusal names the closed warehouse", /closed/i.test(errMsg(dc)), `(msg: ${errMsg(dc)})`);
    const doRow = await prisma.deliveryOrder.findUnique({ where: { id: doId } });
    check("DO status unchanged", doRow?.status === "Received", `(got ${doRow?.status})`);
    const outW1 = n((await prisma.stockBalance.findFirst({ where: { itemId: itemW.id, outletId, deleted: false } }))?.availableQuantity);
    check("outlet stock of the drained item unchanged", outW1 === outW0, `(${outW0} → ${outW1})`);

    // 9. First paid month on Basic.
    const primary = (await subsOf(t.id))[0];
    const prevValid = new Date(primary.subscriptionValidUntil);
    const basicRetail = await g.subscriptionPlan.findFirst({ where: { planName: "Basic", planType: "Retail" } });
    const pay = await adminService.recordPayment(t.id, primary.outletId, { amount: basicRetail.price, paymentMethod: "Cash", paymentDate: new Date(), extensionMonths: 1 });
    const payRow = await g.tenantPayment.findUnique({ where: { id: pay.payment.id } });
    const snap: any = payRow?.costSnapshot;
    check("payment costSnapshot planName Basic", snap?.planName === "Basic", `(got ${snap?.planName})`);
    check(`payment costSnapshot basePlanCost = Basic Retail price (${basicRetail.price})`, snap?.basePlanCost === basicRetail.price, `(got ${snap?.basePlanCost})`);
    const expectValid = new Date(prevValid);
    expectValid.setMonth(expectValid.getMonth() + 1);
    const primaryAfter = (await subsOf(t.id)).find((s: any) => s.id === primary.id);
    check("validUntil = previous + 1 month", new Date(primaryAfter.subscriptionValidUntil).getTime() === expectValid.getTime(),
        `(got ${primaryAfter.subscriptionValidUntil.toISOString()}, want ${expectValid.toISOString()})`);
    check("subscription status 'Active' after payment", primaryAfter.status === "Active", `(got ${primaryAfter.status})`);
}

// ---------------------------------------------------------------------------
// LAUNDRY
// ---------------------------------------------------------------------------
async function runLaundry(stamp: string) {
    section("LAUNDRY — setup on the Pro trial");
    const t = await createTrialTenant(`sdl_${stamp}`, "Laundry");
    const prisma: any = getTenantPrisma(t.db);
    const auth = await login(t.name, t.name);
    let token: string = auth.token;
    const outletId: number = auth.allowedOutletIds?.[0];
    check("login on trial: planName Pro", auth.planName === "Pro", `(got ${auth.planName})`);
    check("login on trial: loyaltyTier advanced (Laundry Pro)", auth.loyaltyTier === "advanced", `(got ${auth.loyaltyTier})`);

    const catWash = await prisma.category.create({ data: { name: "Smoke Cuci" } });
    const catOther = await prisma.category.create({ data: { name: "Smoke Lain" } });
    const sup = await prisma.supplier.create({ data: { companyName: "Smoke Supplier L", hasTax: false } });
    const wash = await seedItem(prisma, { code: "SMK-WASH", price: 10000, cost: 0, categoryId: catWash.id, supplierId: sup.id, trackStock: false });
    const extra = await seedItem(prisma, { code: "SMK-EXTRA", price: 5000, cost: 0, categoryId: catOther.id, supplierId: sup.id, trackStock: false });

    // 10. Prepaid USAGE package sold on the trial.
    const pkg = must(await api("POST", "/subscription/package", { token, outletId, body: { name: "Smoke Paket 5x", packageType: "USAGE", price: 40000, totalQuota: 5, quotaUnit: "cuci", validityDays: 60, categoryIds: [catWash.id] } }), "create package");
    const cust = must(await api("POST", "/customer/create", { token, outletId, body: { customers: [{ firstName: "Smoke", lastName: "Laundry", mobile: `08${stamp}3` }] } }), "create customer")[0];
    const csub = must(await api("POST", "/subscription/subscribe", { token, outletId, body: { customerId: cust.id, subscriptionPackageId: pkg.id, paidAmount: 40000 } }), "subscribe");
    const csubId = (csub?.id ?? csub?.customerSubscription?.id) as number;
    const cs0 = await prisma.customerSubscription.findUnique({ where: { id: csubId } });
    check("package sold on trial: ACTIVE, quota 5", cs0?.status === "ACTIVE" && cs0?.remainingQuota === 5, `(got ${cs0?.status}/${cs0?.remainingQuota})`);
    for (const suffix of ["u1", "u2"]) await adminService.createTenantUser(t.id, { username: `${t.name}_${suffix}`, password: `${t.name}_${suffix}` });

    // 11. Step down.
    section("LAUNDRY — step down Pro trial → Basic");
    const before = await subsOf(t.id);
    await adminService.changeTenantPlan(t.id, "Basic");
    const after = await subsOf(t.id);
    check("subscription Basic + status 'Active'", after.every((s: any) => s.subscriptionPlan.planName === "Basic" && s.status === "Active"), `(got ${after.map((s: any) => `${s.subscriptionPlan.planName}/${s.status}`)})`);
    check("validUntil unchanged",
        after.every((s: any) => new Date(s.subscriptionValidUntil).getTime() === new Date(before.find((b: any) => b.id === s.id).subscriptionValidUntil).getTime()));
    const ov = await expectedOverage(t.id);
    const eu = await extraUserQty(t.id);
    console.log(`    users ${ov.users}, included ${ov.included} (Basic Laundry maxUsers=${after[0].subscriptionPlan.maxUsers}) → overage ${ov.overage}`);
    check("EXTRA_USER = users − 1 (Laundry Basic maxUsers 1)", eu === ov.users - 1 && eu === ov.overage, `(got ${eu}, want ${ov.users - 1})`);
    const ref = await api("POST", "/auth/refresh-token", { body: { refreshToken: auth.refreshToken } });
    check("refresh → 200, planName Basic, loyaltyTier none", ref.status === 200 && ref.body?.data?.planName === "Basic" && ref.body?.data?.loyaltyTier === "none",
        `(HTTP ${ref.status} ${ref.body?.data?.planName}/${ref.body?.data?.loyaltyTier})`);
    token = ref.body?.data?.token ?? token;

    // 12. The package keeps working on Basic.
    section("LAUNDRY — prepaid package used + cancelled on Basic");
    const gl = await api("GET", `/subscription/customer/${cust.id}`, { token, outletId });
    check("GET /subscription/customer/:id on Basic → 200", gl.status === 200, `(HTTP ${gl.status} ${errMsg(gl)})`);
    const listed = (gl.body?.data?.subscriptions ?? []).map((s: any) => s.id);
    check("lists the package sold on trial", listed.includes(csubId), `(got ${JSON.stringify(listed)})`);

    const sale = buildSale({ outletId, performedBy: t.name, customerId: cust.id, customerName: "Smoke Laundry", salesType: "Laundry",
        lines: [{ item: wash, qty: 1 }, { item: extra, qty: 1 }], pkg: { id: csubId, amount: 10000, qtyUsed: 1 } });
    const sr = await api("POST", "/sales/completeNewSales", { token, outletId, body: sale.body, idem: true });
    check("Basic sale redeeming the package → 200", sr.status === 200, `(HTTP ${sr.status} ${errMsg(sr)})`);
    const cs1 = await prisma.customerSubscription.findUnique({ where: { id: csubId } });
    check("package quota decremented 5 → 4", cs1?.remainingQuota === 4 && cs1?.usedQuota === 1, `(remaining ${cs1?.remainingQuota}, used ${cs1?.usedQuota})`);
    const srRow = sr.body?.data?.id ? await prisma.sales.findUnique({ where: { id: sr.body.data.id } }) : null;
    check("sale row: customerSubscriptionId + subscriptionDiscountAmount 10000", srRow?.customerSubscriptionId === csubId && n(srRow?.subscriptionDiscountAmount) === 10000,
        `(got ${srRow?.customerSubscriptionId}/${srRow?.subscriptionDiscountAmount})`);

    const sb = await api("POST", "/subscription/subscribe", { token, outletId, body: { customerId: cust.id, subscriptionPackageId: pkg.id, paidAmount: 40000 } });
    check("POST /subscription/subscribe on Basic → refused (402/403)", sb.status === 403 || sb.status === 402, `(HTTP ${sb.status})`);
    const cc = await api("PUT", `/subscription/cancel/${csubId}`, { token, outletId, body: {}, idem: true });
    check("PUT /subscription/cancel/:id on Basic → 200", cc.status === 200, `(HTTP ${cc.status} ${errMsg(cc)})`);
    check("package status CANCELLED", (await prisma.customerSubscription.findUnique({ where: { id: csubId } }))?.status === "CANCELLED");
}

// ---------------------------------------------------------------------------
async function main() {
    await waitHealth();
    console.log(`Server ${BASE} healthy. LOCAL databases only.`);
    const stamp = Date.now().toString(36);
    try {
        await runRetail(stamp);
    } catch (e: any) {
        failures.push(`RETAIL aborted: ${e?.message ?? e}`);
        console.log(`  ✘ RETAIL aborted: ${e?.stack ?? e}`);
    }
    try {
        await runLaundry(stamp);
    } catch (e: any) {
        failures.push(`LAUNDRY aborted: ${e?.message ?? e}`);
        console.log(`  ✘ LAUNDRY aborted: ${e?.stack ?? e}`);
    }
}

main()
    .catch((e) => {
        failures.push(`fatal: ${e?.message ?? e}`);
        console.error(e);
    })
    .finally(async () => {
        section("cleanup");
        for (const t of created) {
            if (KEEP) {
                console.log(`  kept tenant ${t.name} (id ${t.id}, db ${t.db}) — login = password = ${t.name}`);
                continue;
            }
            try {
                await dropTenant(t);
                console.log(`  dropped tenant ${t.name} (id ${t.id}) + database ${t.db}`);
            } catch (e: any) {
                console.log(`  ! could not fully drop ${t.name} (id ${t.id}, db ${t.db}): ${e?.message ?? e}`);
            }
        }
        await disconnectAllPrismaClients().catch(() => undefined);
        console.log(`\n${passed} passed, ${failures.length} failed`);
        if (failures.length) {
            console.log("FAILED:");
            for (const f of failures) console.log(`  - ${f}`);
        }
        process.exit(failures.length ? 1 : 0);
    });
