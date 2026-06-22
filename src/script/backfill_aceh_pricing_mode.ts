/**
 * aceh_wash price-representation backfill — converts legacy per-kg wash service
 * items to the explicit `flat_per_load` pricing mode with a clean, rounded
 * per-load price.
 *
 * WHY: aceh_wash priced wash items per-kg (e.g. "Cuci Kering Lipat" = 5833.33/kg)
 * and the app charged price × machine capacity → 5833.33 × 6 = 34999.98 (ugly
 * cents). The new binary understands `pricingMode`:
 *   - null / 'per_piece'  → legacy (price × capacity, then rounded at sale time)
 *   - 'flat_per_load'     → price IS the per-load total, charged as-is (rounded)
 * This script rewrites those items to `flat_per_load` with
 *   newPrice = roundToNearest(oldPricePerKg × defaultLoadWeightKg, increment)
 * so 5833.33 × 6 → 35000 is stored directly and never round-trips again.
 *
 *   node dist/script/backfill_aceh_pricing_mode.js <local|prod> [databaseName] [--confirm] [--increment=100]
 *
 * Without --confirm it is a DRY RUN: prints every change it WOULD make, no writes.
 * Default databaseName = aceh_wash_db. Default rounding increment = 100.
 *
 * ⚠️ DEPLOY ORDERING: run this ONLY together with / after the Flutter binary that
 * understands `flat_per_load` has shipped. An OLD binary would charge
 * `flatPrice × capacity` (e.g. 35000 × 6 = 210000). Migrate-with-binary, not before.
 *
 * ⚠️ BACKUP FIRST on prod: `npm run backup_db_prod` (or a targeted mysqldump of
 * the `item` table) before running with --confirm.
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
// Optional positional db name (skip if it looks like a flag).
const positional = process.argv[3];
const databaseName =
    positional && !positional.startsWith("--") ? positional : "aceh_wash_db";
const confirm = process.argv.includes("--confirm");
const incrementArg = process.argv.find((a) => a.startsWith("--increment="));
const increment = incrementArg ? parseInt(incrementArg.split("=")[1], 10) : 100;

if (!["local", "prod"].includes(target) || Number.isNaN(increment) || increment < 0) {
    console.error(
        "Usage: node dist/script/backfill_aceh_pricing_mode.js <local|prod> [databaseName] [--confirm] [--increment=100]"
    );
    process.exit(1);
}

if (target === "prod") {
    if (!process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else {
    console.log("Target: LOCAL");
}

// Load AFTER env override so the tenant client resolves to the chosen target.
const { getTenantPrisma, disconnectAllPrismaClients } =
    require("../db") as typeof import("../db");

function roundToIncrement(amount: number, inc: number): number {
    if (inc <= 0) return amount;
    return Math.round(amount / inc) * inc;
}

async function main() {
    console.log(
        `DB: ${databaseName} · rounding increment: ${increment} · mode: ${confirm ? "APPLY" : "DRY RUN"}\n`
    );
    const prisma = getTenantPrisma(databaseName);

    // Legacy wash service items: a service with a machine-load weight and no
    // explicit pricing mode yet. Match BOTH null and the conceptual 'per_piece'
    // legacy value (some rows may carry it) so nothing is silently left behind.
    // Items already flat_per_load/per_kg are skipped (idempotent re-runs).
    const items = await prisma.item.findMany({
        where: {
            itemType: "service",
            deleted: false,
            defaultLoadWeightKg: { not: null },
            OR: [{ pricingMode: null }, { pricingMode: "per_piece" }],
        },
        select: { id: true, itemName: true, price: true, defaultLoadWeightKg: true },
        orderBy: { itemName: "asc" },
    });

    if (items.length === 0) {
        console.log("No legacy per-kg wash items to convert. Nothing to do.");
        return;
    }

    console.log(
        "ID   | Item                          | per-kg     | cap | old total  | new flat   | Δ"
    );
    console.log("-".repeat(92));

    let changed = 0;
    // Items we CAN'T auto-convert (no capacity ⇒ no derivable per-load price).
    // Collected and reported loudly so they get manual attention rather than
    // being silently skipped and left mispriced.
    const needsManual: { id: number; itemName: string; price: number }[] = [];
    for (const it of items) {
        const perKg = Number(it.price ?? 0);
        const cap = Number(it.defaultLoadWeightKg ?? 0);
        if (cap <= 0) {
            needsManual.push({ id: it.id, itemName: it.itemName ?? "", price: perKg });
            continue; // can't derive a per-load price without capacity
        }
        const oldTotal = perKg * cap;
        const newFlat = roundToIncrement(oldTotal, increment);
        const delta = newFlat - oldTotal;
        const name = (it.itemName ?? "").padEnd(29).slice(0, 29);
        console.log(
            `${String(it.id).padEnd(4)} | ${name} | ${perKg.toFixed(2).padStart(10)} | ${String(cap).padStart(3)} | ${oldTotal.toFixed(2).padStart(10)} | ${newFlat.toFixed(2).padStart(10)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
        );

        if (confirm) {
            await prisma.item.update({
                where: { id: it.id },
                // version auto-increments via the tenant client extension.
                data: {
                    price: newFlat,
                    pricingMode: "flat_per_load",
                    updatedAt: new Date(),
                },
            });
        }
        changed++;
    }

    console.log("-".repeat(92));
    console.log(
        confirm
            ? `\n✅ Updated ${changed} item(s) → pricingMode='flat_per_load' with rounded per-load prices.`
            : `\nDRY RUN — would update ${changed} item(s). Re-run with --confirm to apply (BACKUP FIRST).`
    );

    // Surface anything that could NOT be auto-migrated — these stay legacy and
    // must be fixed by hand (set a real per-load price + basis in the app).
    if (needsManual.length > 0) {
        console.log(
            `\n⚠️  ${needsManual.length} item(s) have no machine capacity and were NOT converted:`
        );
        for (const m of needsManual) {
            console.log(`   - ID ${m.id} "${m.itemName}" (price ${m.price.toFixed(2)})`);
        }
        console.log(
            "   Fix each in the app (Item → edit → set price + basis) or correct the capacity, then re-run."
        );
    }

    // Post-run completeness check: confirm no legacy wash items remain (apply mode).
    if (confirm) {
        const remaining = await prisma.item.count({
            where: {
                itemType: "service",
                deleted: false,
                defaultLoadWeightKg: { not: null },
                OR: [{ pricingMode: null }, { pricingMode: "per_piece" }],
            },
        });
        console.log(
            remaining === 0
                ? "\n✔ Verified: 0 legacy wash items remain (all converted or flagged above)."
                : `\n❗ ${remaining} legacy wash item(s) still unmigrated (capacity-less items above). Resolve them.`
        );
    }
}

main()
    .catch((error) => {
        console.error("Backfill failed:", error);
        process.exit(1);
    })
    .finally(() => disconnectAllPrismaClients());
