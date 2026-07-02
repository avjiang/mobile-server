/*
 * DEV SEED — creates two PARTIAL invoice settlements in LOCAL web_bytes_db so the
 * "Mark as fully paid" FE button can be tested end-to-end:
 *   SEED-A  bill 1,000,404 / paid 1,000,400  (4 short, within cap)  -> button SHOWS
 *   SEED-B  bill 1,000,000 / paid   800,000  (200k short, over cap) -> button HIDDEN
 * Each gets one linked invoice so it renders like real data. Re-running replaces them.
 * NEVER runs against prod (host guard). Run:  npx tsx src/script/seed_markpaid_web_bytes.ts
 */
import dotenv from "dotenv";
dotenv.config();

const TENANT_DB = "web_bytes_db";
const url = process.env.TENANT_DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.error("ABORT: TENANT_DATABASE_URL is not local. Refusing to run.");
    process.exit(1);
}

const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const INV_PREFIX = "SEED-MP-INV-";
const SET_PREFIX = "SEED-MP-";

async function seedOne(prisma: any, tag: string, supplierId: number, bill: number, paid: number) {
    // 1. unsettled invoice
    const invoice = await prisma.invoice.create({
        data: {
            invoiceNumber: `${INV_PREFIX}${tag}`,
            taxInvoiceNumber: `${INV_PREFIX}${tag}`,
            supplierId,
            outletId: 1,
            subtotalAmount: bill,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: bill,
            currency: "IDR",
            status: "Partially Paid",
            invoiceDate: new Date(),
        },
    });

    // 2. PARTIAL settlement (paidAmount = real cash, a bit short of the bill)
    const settlement = await prisma.invoiceSettlement.create({
        data: {
            settlementNumber: `${SET_PREFIX}${tag}`,
            settlementDate: new Date(),
            settlementType: "BULK",
            paymentMethod: "BANK_TRANSFER",
            settlementAmount: bill,
            currency: "IDR",
            status: "COMPLETED",
            paidAmount: paid,
            paymentStatus: "PARTIAL",
            totalInvoiceCount: 1,
            totalInvoiceAmount: bill,
            performedBy: "seed",
        },
    });

    // 3. payment ledger row for the real cash
    await prisma.invoiceSettlementPayment.create({
        data: {
            invoiceSettlementId: settlement.id,
            paymentDate: new Date(),
            paymentMethod: "BANK_TRANSFER",
            amount: paid,
        },
    });

    // 4. link the invoice to the settlement
    await prisma.invoice.update({
        where: { id: invoice.id },
        data: { invoiceSettlementId: settlement.id },
    });

    console.log(`  ${SET_PREFIX}${tag}: settlement #${settlement.id} bill=${bill} paid=${paid} (short ${bill - paid})`);
    return settlement.id;
}

async function main() {
    const prisma = getTenantPrisma(TENANT_DB);
    console.log(`Seeding ${TENANT_DB} (LOCAL)...`);

    // wipe previous seed rows (payments -> invoices link -> settlements -> invoices)
    const old = await prisma.invoiceSettlement.findMany({ where: { settlementNumber: { startsWith: SET_PREFIX } }, select: { id: true } });
    const oldIds = old.map((s: any) => s.id);
    if (oldIds.length) {
        await prisma.invoiceSettlementPayment.deleteMany({ where: { invoiceSettlementId: { in: oldIds } } });
        await prisma.invoice.updateMany({ where: { invoiceSettlementId: { in: oldIds } }, data: { invoiceSettlementId: null } });
        await prisma.invoiceSettlement.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: INV_PREFIX } } });

    const supplier = await prisma.supplier.findFirst({ where: { deleted: false }, orderBy: { id: "asc" }, select: { id: true } });
    const supplierId = supplier?.id ?? 1;

    await seedOne(prisma, "A-INCAP", supplierId, 1000404, 1000400);  // 4 short -> button SHOWS
    await seedOne(prisma, "B-OVERCAP", supplierId, 1000000, 800000); // 200k short -> button HIDDEN

    console.log("\nDone. In the app: Procurement → Settlements (pull to refresh).");
    console.log("  SEED-MP-A-INCAP   -> 'Mark as fully paid' button visible (writes off Rp 4)");
    console.log("  SEED-MP-B-OVERCAP -> only 'Add Payment' (gap exceeds cap)");
    await disconnectAllPrismaClients();
    process.exit(0);
}

main().catch(async (e) => { console.error(e); await disconnectAllPrismaClients().catch(() => {}); process.exit(1); });
