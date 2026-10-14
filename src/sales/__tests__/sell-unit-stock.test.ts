// Wholesale multi-UOM (FE docs/future/MULTI_TIER_PRICING.md §2.4): a sell-unit
// line ("2 Dus isi 40") moves `quantity × unitFactor` BASE units of stock, through
// the same helper on sale, void, return and refund; it is stored as ONE row with a
// weighted-average FIFO cost; it is never a laundry supply line.
//
// Pure: the helpers below are what completeNewSales / voidSales / returnSales /
// refundSales call. The end-to-end run against a real tenant DB (sale 2 Dus →
// 400 → 320 pcs; void/return/refund → 400) is recorded in SALES.md.
//
// Run with:  npx tsx --test src/sales/__tests__/sell-unit-stock.test.ts

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import salesService from "../sales.service";
import { BusinessLogicError } from "../../api-helpers/error";

const { getEffectiveStockQty, assertSingleStockFactor, singleRowCostAndProfit, isSupplyLine } =
    (salesService as any).__testables;

describe("getEffectiveStockQty — sell units", () => {
    test("sale: 2 Dus isi 40 takes 80 pcs", () => {
        assert.equal(getEffectiveStockQty(new Decimal(2), null, 40).toString(), "80");
    });

    test("void / return / refund restore read the STORED row (Prisma Decimal strings) → +80", () => {
        // What `salesItems: true` returns for the stored carton row.
        const stored = { quantity: new Decimal("2.0000"), stockConsumptionQty: null, unitFactor: new Decimal("40.0000") };
        const restore = getEffectiveStockQty(new Decimal(stored.quantity), stored.stockConsumptionQty, stored.unitFactor);
        assert.equal(restore.toString(), "80");
    });

    test("a piece line (both null) is unchanged; consumption still wins its own factor", () => {
        assert.equal(getEffectiveStockQty(new Decimal(3), null, null).toString(), "3");
        assert.equal(getEffectiveStockQty(new Decimal(3), undefined, undefined).toString(), "3");
        assert.equal(getEffectiveStockQty(new Decimal(3), 50, null).toString(), "150");
    });

    test("a fractional carton count multiplies cleanly (1.5 dus × 40 = 60)", () => {
        assert.equal(getEffectiveStockQty(new Decimal(1.5), null, "40").toString(), "60");
    });
});

describe("assertSingleStockFactor", () => {
    test("a unit line or a consumption line alone is fine", () => {
        assert.doesNotThrow(() => assertSingleStockFactor({ itemName: "Indomie", unitFactor: 40 }));
        assert.doesNotThrow(() => assertSingleStockFactor({ itemName: "Deterjen", stockConsumptionQty: 50 }));
        assert.doesNotThrow(() => assertSingleStockFactor({ itemName: "Aqua" }));
    });

    test("rejects a line that sets both stockConsumptionQty and unitFactor", () => {
        assert.throws(
            () => assertSingleStockFactor({ itemName: "Indomie", stockConsumptionQty: 1, unitFactor: 40 }),
            (e: unknown) => e instanceof BusinessLogicError && /cannot both be set/.test((e as Error).message),
        );
    });

    test("rejects a zero, negative or non-numeric unitFactor (it moves stock)", () => {
        for (const bad of [0, -40, "abc", "Infinity"]) {
            assert.throws(() => assertSingleStockFactor({ itemName: "Indomie", unitFactor: bad }), /unitFactor/);
        }
    });
});

describe("singleRowCostAndProfit — carton FIFO cost", () => {
    test("2 Dus isi 40 across two receipt layers: cost = 80 × weighted average", () => {
        // 50 pcs @ Rp 3.000 (older layer) + 30 pcs @ Rp 3.200 → avg 3.075 → 246.000.
        const r = singleRowCostAndProfit({
            price: 128000,
            quantity: 2,
            usedReceipts: [
                { quantityUsed: new Decimal(50), cost: new Decimal(3000) },
                { quantityUsed: new Decimal(30), cost: new Decimal(3200) },
            ],
        });
        assert.equal(r.totalRevenue.toString(), "256000", "revenue = carton price × cartons");
        assert.equal(r.totalCost.toString(), "246000");
        assert.equal(r.totalCost.dividedBy(80).toString(), "3075");
        assert.equal(r.profit.toString(), "10000");
    });

    test("discount and service charge come off the profit, as for consumption lines", () => {
        const r = singleRowCostAndProfit({
            price: 128000,
            quantity: 1,
            discountAmount: 8000,
            serviceChargeAmount: 0,
            usedReceipts: [{ quantityUsed: new Decimal(40), cost: new Decimal(3000) }],
        });
        assert.equal(r.profit.toString(), "0");
    });
});

describe("isSupplyLine — a free carton is never a laundry supply", () => {
    test("Rp 0 consumption line without a unit is a supply (unchanged)", () => {
        assert.equal(isSupplyLine({ price: 0, loadWeightKg: null, stockConsumptionQty: 50, itemUnitId: null }), true);
    });

    test("Rp 0 line carrying an itemUnitId is not", () => {
        assert.equal(isSupplyLine({ price: 0, loadWeightKg: null, stockConsumptionQty: 50, itemUnitId: 7 }), false);
        assert.equal(isSupplyLine({ price: 0, loadWeightKg: null, stockConsumptionQty: null, itemUnitId: 7 }), false);
    });
});
