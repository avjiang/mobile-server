// Unit tests for server-assigned document numbers (pure parts + the SQL call
// sequence against a fake transaction client). The real race-safety check runs
// against MySQL: src/script/smoke_document_number_concurrency.ts.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    DEFAULT_UTC_OFFSET_MINUTES,
    formatDocumentNumber,
    localDocumentDate,
    nextDocumentNumber,
    parseUtcOffsetMinutes,
} from "../documentNumber";

describe("formatDocumentNumber", () => {
    test("pads to 4 digits", () => {
        assert.equal(formatDocumentNumber("INV", 3, "20260928", 7), "INV-OUT3-20260928-0007");
    });
    test("grows beyond 9999", () => {
        assert.equal(formatDocumentNumber("RTN", 1, "20260928", 12345), "RTN-OUT1-20260928-12345");
    });
});

describe("localDocumentDate", () => {
    const now = new Date("2026-09-28T17:30:00Z"); // 00:30 WIB on the 29th
    test("WIB default rolls the date over at local midnight", () => {
        assert.equal(localDocumentDate(DEFAULT_UTC_OFFSET_MINUTES, now), "20260929");
    });
    test("UTC stays on the UTC date", () => {
        assert.equal(localDocumentDate(0, now), "20260928");
    });
    test("negative offsets move backwards", () => {
        assert.equal(localDocumentDate(-600, new Date("2026-01-01T05:00:00Z")), "20251231");
    });
});

describe("parseUtcOffsetMinutes", () => {
    test("absent → WIB", () => {
        assert.equal(parseUtcOffsetMinutes(undefined), 420);
        assert.equal(parseUtcOffsetMinutes(null), 420);
    });
    test("accepts integers and numeric strings", () => {
        assert.equal(parseUtcOffsetMinutes(480), 480);
        assert.equal(parseUtcOffsetMinutes("-300"), -300);
    });
    test("rejects fractions, out-of-range and junk", () => {
        assert.throws(() => parseUtcOffsetMinutes(420.5));
        assert.throws(() => parseUtcOffsetMinutes(900));
        assert.throws(() => parseUtcOffsetMinutes("abc"));
    });
});

describe("nextDocumentNumber", () => {
    function fakeTx(rowExists: boolean, lastValue: number, maxIssued = 0) {
        const calls: string[] = [];
        return {
            calls,
            async $executeRawUnsafe(sql: string) {
                calls.push(sql.split(" ")[0]);
                return sql.startsWith("UPDATE") ? (rowExists ? 1 : 0) : 1;
            },
            async $queryRawUnsafe(sql: string) {
                calls.push("SELECT");
                if (sql.includes("MAX(")) return [{ maxSeq: maxIssued }];
                return [{ LAST_VALUE: lastValue }];
            },
        };
    }

    test("existing counter: one UPDATE then read back", async () => {
        const tx = fakeTx(true, 42);
        assert.equal(await nextDocumentNumber(tx, 2, "PO", "20260928"), "PO-OUT2-20260928-0042");
        assert.deepEqual(tx.calls, ["UPDATE", "SELECT"]);
    });

    test("missing counter: falls back to insert seeded past issued numbers", async () => {
        const tx = fakeTx(false, 6, 5);
        assert.equal(await nextDocumentNumber(tx, 1, "QT", "20260928"), "QT-OUT1-20260928-0006");
        assert.deepEqual(tx.calls, ["UPDATE", "SELECT", "INSERT", "SELECT"]);
    });

    test("rejects a missing outlet", async () => {
        await assert.rejects(() => nextDocumentNumber(fakeTx(true, 1), undefined as any, "INV", "20260928"));
    });
});
