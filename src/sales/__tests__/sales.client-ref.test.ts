// Unit tests for the permanent checkout/payment replay dedupe (sales/client-ref.ts).
//
// Background (2026-09-28): the app's outbox replays a queued checkout with its
// original X-Idempotency-Key. idempotency_record forgets keys after 24h, so a
// till offline for a day could record a sale twice. The key now also lives on
// the created row (sales.CLIENT_REF / payment.CLIENT_REF, unique).
//
// Pure: a fake db stands in for Prisma. Run with:  npm test

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { Prisma } from "../../../prisma/client/generated/client";
import {
    ClientRefDb,
    findPaidSaleIdByClientRef,
    findSaleIdByClientRef,
    isClientRefConflict,
    markAlreadyRecorded,
    paymentClientRef,
    readClientRef,
} from "../client-ref";

const KEY = "3f2b8c1e-8d6a-4c2e-9b1a-7e5d4c3b2a10";

function fakeDb(
    sales: Record<string, number>,
    payments: Record<string, number>,
): ClientRefDb {
    return {
        sales: {
            findUnique: async ({ where }) =>
                where.clientRef in sales ? { id: sales[where.clientRef] } : null,
        },
        payment: {
            findUnique: async ({ where }) =>
                where.clientRef in payments
                    ? { salesId: payments[where.clientRef] }
                    : null,
        },
    };
}

function p2002(target: unknown) {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target },
    });
}

describe("readClientRef", () => {
    test("accepts a UUID key", () => {
        assert.equal(readClientRef(KEY), KEY);
    });

    test("rejects missing, blank and over-long keys", () => {
        assert.equal(readClientRef(undefined), null);
        assert.equal(readClientRef(""), null);
        assert.equal(readClientRef("   "), null);
        assert.equal(readClientRef("x".repeat(65)), null);
        assert.equal(readClientRef(["a"]), null);
    });
});

describe("paymentClientRef", () => {
    test("suffixes the payment's index so one call's payments stay unique", () => {
        assert.equal(paymentClientRef(KEY, 0), `${KEY}:0`);
        assert.equal(paymentClientRef(KEY, 2), `${KEY}:2`);
        assert.ok(paymentClientRef("x".repeat(64), 99).length <= 80,
            "must fit payment.CLIENT_REF VARCHAR(80)");
    });
});

describe("findSaleIdByClientRef", () => {
    test("returns the sale an earlier checkout with this key created", async () => {
        const db = fakeDb({ [KEY]: 30 }, {});
        assert.equal(await findSaleIdByClientRef(db, KEY), 30);
    });

    test("returns null for a key never seen", async () => {
        assert.equal(await findSaleIdByClientRef(fakeDb({}, {}), KEY), null);
    });
});

describe("findPaidSaleIdByClientRef", () => {
    test("finds the sale through the call's first payment", async () => {
        const db = fakeDb({}, { [`${KEY}:0`]: 42, [`${KEY}:1`]: 42 });
        assert.equal(await findPaidSaleIdByClientRef(db, KEY), 42);
    });

    test("does not match a sale created with the same key", async () => {
        // Checkout and add-payment keys live in separate columns.
        const db = fakeDb({ [KEY]: 7 }, {});
        assert.equal(await findPaidSaleIdByClientRef(db, KEY), null);
    });
});

describe("isClientRefConflict", () => {
    test("true for P2002 on the CLIENT_REF index (MySQL index-name target)", () => {
        assert.equal(isClientRefConflict(p2002("sales_CLIENT_REF_key")), true);
        assert.equal(isClientRefConflict(p2002("payment_CLIENT_REF_key")), true);
    });

    test("true for P2002 reported as a field list", () => {
        assert.equal(isClientRefConflict(p2002(["clientRef"])), true);
    });

    test("false for other unique indexes and other errors", () => {
        // A duplicate laundry ORDER_REF is a different failure — keep throwing it.
        assert.equal(isClientRefConflict(p2002("sales_ORDER_REF_key")), false);
        assert.equal(isClientRefConflict(new Error("boom")), false);
        assert.equal(
            isClientRefConflict(
                new Prisma.PrismaClientKnownRequestError("fk", {
                    code: "P2003",
                    clientVersion: "test",
                    meta: { target: "sales_CLIENT_REF_key" },
                }),
            ),
            false,
        );
    });
});

describe("markAlreadyRecorded", () => {
    test("returns the existing sale unchanged, flagged", () => {
        const sale = { id: 30, totalAmount: 13000, status: "Completed" };
        assert.deepEqual(markAlreadyRecorded(sale), {
            ...sale,
            alreadyRecorded: true,
        });
    });
});
