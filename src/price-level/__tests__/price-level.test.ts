// Run with:  npx tsx --test src/price-level/__tests__/price-level.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import service, { assertLevelNotInUse, normalizePriceLevelName } from "../price-level.service";
import { BusinessLogicError, ErrorCode, RequestValidateError } from "../../api-helpers/error";

describe("normalizePriceLevelName", () => {
    test("trims and keeps a valid name", () => {
        assert.equal(normalizePriceLevelName("  Grosir "), "Grosir");
    });
    test("empty and > 32 chars are rejected", () => {
        assert.throws(() => normalizePriceLevelName("  "), RequestValidateError);
        assert.throws(() => normalizePriceLevelName(undefined), RequestValidateError);
        assert.throws(() => normalizePriceLevelName("x".repeat(33)), RequestValidateError);
    });
});

describe("delete rule (Phase 3: block while customers use the level)", () => {
    test("a level no customer uses may go", () => {
        assert.doesNotThrow(() => assertLevelNotInUse("Grosir", 0));
    });
    test("a level customers still carry is refused, tagged for the app", () => {
        assert.throws(
            () => assertLevelNotInUse("Grosir", 3),
            (e: any): boolean => e instanceof BusinessLogicError
                && e.errorCode === ErrorCode.PriceLevelInUse
                && e.params?.name === "Grosir"
                && e.params?.count === "3",
        );
    });
});

describe("customer level clear", () => {
    test("priceLevelId null (clear → ecer) or absent (leave alone) needs no level lookup", async () => {
        // Returns before touching any tenant database: null is always allowed.
        await assert.doesNotReject(service.assertLevelExists("no_such_db", null));
        await assert.doesNotReject(service.assertLevelExists("no_such_db", undefined));
    });
    test("a malformed id is a clear 400", async () => {
        await assert.rejects(service.assertLevelExists("no_such_db", "abc"), /Invalid priceLevelId/);
    });
});
