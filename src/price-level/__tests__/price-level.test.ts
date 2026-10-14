// Run with:  npx tsx --test src/price-level/__tests__/price-level.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizePriceLevelName } from "../price-level.service";
import { RequestValidateError } from "../../api-helpers/error";

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
