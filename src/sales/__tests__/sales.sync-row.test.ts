// The sales-sync client row. The app upserts these rows WHOLE into its local
// sales_histories table, so a field one read forgets is erased on the device.
// 2026-09-28: getPartiallyPaidSales had its own trimmed copy without orderRef /
// friendlyNumber / collectedAt, and pay-at-pickup laundry orders vanished from
// the pickup queue. Every read now uses salesSyncSelect + toSalesSyncRow; these
// tests keep the two in step.
//
// Run with:  npm test

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import salesService from "../sales.service";

const { salesSyncSelect, toSalesSyncRow } = (salesService as any).__testables;

function fakeSale(overrides: Record<string, unknown> = {}) {
    const sale: Record<string, unknown> = {};
    for (const key of Object.keys(salesSyncSelect)) sale[key] = `v:${key}`;
    sale.salesItems = [];
    sale.payments = [{ method: "Bank Transfer" }];
    return { ...sale, ...overrides };
}

describe("toSalesSyncRow", () => {
    test("carries every scalar field the shared select loads", () => {
        const row = toSalesSyncRow(fakeSale(), new Map());
        const scalarKeys = Object.keys(salesSyncSelect).filter((k) => k !== "salesItems" && k !== "payments");
        for (const key of scalarKeys) {
            assert.equal(row[key], `v:${key}`, `field "${key}" is selected but not returned to the app`);
        }
    });

    test("keeps the laundry pickup identity (the fields the partially-paid read used to drop)", () => {
        const row = toSalesSyncRow(
            fakeSale({ orderRef: "ref-1", friendlyNumber: "260928-1-002", collectedAt: null, status: "Partially Paid" }),
            new Map(),
        );
        assert.equal(row.orderRef, "ref-1");
        assert.equal(row.friendlyNumber, "260928-1-002");
        assert.equal(row.collectedAt, null);
        assert.equal(row.status, "Partially Paid");
    });

    test("rolls the lines up: billable count excludes supply lines, weight + service kind", () => {
        const row = toSalesSyncRow(
            fakeSale({
                salesItems: [
                    { itemId: 1, price: 35000, loadWeightKg: 6, stockConsumptionQty: null }, // wash
                    { itemId: 9, price: 0, loadWeightKg: null, stockConsumptionQty: 60 },   // detergent supply line
                ],
            }),
            new Map([[1, "wash" as const]]),
        );
        assert.equal(row.totalItems, 1);
        assert.equal(row.loadWeightKg, 6);
        assert.equal(row.laundryServiceKind, "wash");
        assert.deepEqual(row.payments, [{ method: "Bank Transfer" }]);
    });
});
