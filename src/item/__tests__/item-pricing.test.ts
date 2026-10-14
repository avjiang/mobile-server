// Wholesale pricing — item units + price tiers (FE docs/modules/ITEM.md § Wholesale pricing data model): payload validation, Lite gating, soft-delete reconciliation, the
// unit-barcode uniqueness rule and the Item.updatedAt bump that delta sync needs.
//
// Run with:  npx tsx --test src/item/__tests__/item-pricing.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import {
    assertDecreasingTiers,
    assertNoDuplicateTiers,
    assertWholesaleAllowed,
    normalizeTiers,
    normalizeUnits,
    syncItemUnitsAndTiers,
    toTierPayload,
    toUnitPayload,
} from "../item-pricing";
import { BusinessLogicError, ErrorCode, PlanLimitError } from "../../api-helpers/error";

// ── Pure validation ──────────────────────────────────────────────────────────

describe("normalizeUnits", () => {
    test("accepts a carton and trims name/barcode; empty barcode becomes null", () => {
        const [u] = normalizeUnits([{ name: " Dus ", factor: 40, price: 128000, barcode: "  " }]);
        assert.equal(u.name, "Dus");
        assert.equal(u.factor.toString(), "40");
        assert.equal(u.price.toString(), "128000");
        assert.equal(u.barcode, null);
        assert.equal(u.id, null);
        assert.equal(u.sortOrder, 0);
    });

    test("factor must be > 1", () => {
        assert.throws(() => normalizeUnits([{ name: "Pcs", factor: 1, price: 1 }]), BusinessLogicError);
        assert.throws(() => normalizeUnits([{ name: "Half", factor: 0.5, price: 1 }]), BusinessLogicError);
        assert.throws(() => normalizeUnits([{ name: "Dus", factor: "abc", price: 1 }]), BusinessLogicError);
        assert.doesNotThrow(() => normalizeUnits([{ name: "Pak", factor: "1.5", price: 1 }]));
    });

    test("names are required, ≤ 32 chars and unique per item (case-insensitive)", () => {
        assert.throws(() => normalizeUnits([{ name: "", factor: 2, price: 1 }]), /name is required/);
        assert.throws(() => normalizeUnits([{ name: "x".repeat(33), factor: 2, price: 1 }]), /longer than 32/);
        assert.throws(
            () => normalizeUnits([{ name: "Dus", factor: 40, price: 1 }, { name: "dus", factor: 20, price: 1 }]),
            /used twice/,
        );
    });

    test("price must be ≥ 0; barcodes unique inside the payload", () => {
        assert.throws(() => normalizeUnits([{ name: "Dus", factor: 2, price: -1 }]), /negative/);
        assert.throws(
            () => normalizeUnits([
                { name: "Dus", factor: 40, price: 1, barcode: "899" },
                { name: "Pak", factor: 10, price: 1, barcode: "899" },
            ]),
            /used by two units/,
        );
    });

    test("not an array is rejected", () => {
        assert.throws(() => normalizeUnits({ name: "Dus" }), /must be an array/);
    });
});

describe("normalizeTiers / duplicates", () => {
    test("minQuantity defaults to 1; must be > 0; price ≥ 0", () => {
        const [t] = normalizeTiers([{ price: 9500, priceLevelId: 2 }]);
        assert.equal(t.minQuantity.toString(), "1");
        assert.equal(t.priceLevelId, 2);
        assert.throws(() => normalizeTiers([{ price: 1, minQuantity: 0 }]), /more than 0/);
        assert.throws(() => normalizeTiers([{ price: -5 }]), /negative/);
        assert.throws(() => normalizeTiers([{ price: 1, priceLevelId: -3 }]), /Invalid/);
    });

    test("same (variant, unit, level, minQty) twice is rejected; different level is fine", () => {
        const base = { itemVariantId: null, itemUnitId: null, unitName: null, id: null, price: new Decimal(1) };
        assert.throws(() => assertNoDuplicateTiers([
            { ...base, priceLevelId: null, minQuantity: new Decimal(12), resolvedUnitId: null },
            { ...base, priceLevelId: null, minQuantity: new Decimal(12), resolvedUnitId: null },
        ]), BusinessLogicError);
        assert.doesNotThrow(() => assertNoDuplicateTiers([
            { ...base, priceLevelId: null, minQuantity: new Decimal(12), resolvedUnitId: null },
            { ...base, priceLevelId: 1, minQuantity: new Decimal(12), resolvedUnitId: null },
            { ...base, priceLevelId: null, minQuantity: new Decimal(12), resolvedUnitId: 7 },
        ]));
    });
});

describe("assertDecreasingTiers (Phase 2: breaks get cheaper as qty rises)", () => {
    const t = (minQuantity: number, price: number, extra: Partial<{ priceLevelId: number | null; resolvedUnitId: number | null; itemVariantId: number | null }> = {}) => ({
        id: null, itemVariantId: null, itemUnitId: null, unitName: null, priceLevelId: null,
        minQuantity: new Decimal(minQuantity), price: new Decimal(price), resolvedUnitId: null, ...extra,
    });

    test("12+ 3.300 · 40+ 3.200 is fine, in any payload order", () => {
        assert.doesNotThrow(() => assertDecreasingTiers([t(40, 3200), t(12, 3300)]));
    });

    test("a higher or equal price at a higher quantity is rejected", () => {
        assert.throws(() => assertDecreasingTiers([t(12, 3300), t(40, 3400)]), /must be lower/);
        assert.throws(() => assertDecreasingTiers([t(12, 3300), t(40, 3300)]), BusinessLogicError);
    });

    test("each unit and each level is its own ladder (no cross-unit totals)", () => {
        assert.doesNotThrow(() => assertDecreasingTiers([
            t(12, 3300),
            t(10, 120000, { resolvedUnitId: 7 }), // Dus breaks are in Dus prices
            t(1, 3400, { priceLevelId: 2 }),       // a level price stands alone
            t(12, 3350, { itemVariantId: 4 }),
        ]));
    });
});

describe("assertWholesaleAllowed (Retail Lite)", () => {
    test("Lite cannot add units or tiers", () => {
        assert.throws(() => assertWholesaleAllowed("Lite", [{ name: "Dus" }], undefined), (e: any) =>
            e instanceof PlanLimitError && e.errorCode === ErrorCode.PlanFeatureLocked);
        assert.throws(() => assertWholesaleAllowed("lite", undefined, [{ price: 1 }]), PlanLimitError);
    });
    test("Lite may keep/remove rows carried over from a higher plan; other plans are free", () => {
        assert.doesNotThrow(() => assertWholesaleAllowed("Lite", [{ id: 4, name: "Dus" }], []));
        assert.doesNotThrow(() => assertWholesaleAllowed("Lite", [], []));
        assert.doesNotThrow(() => assertWholesaleAllowed("Basic", [{ name: "Dus" }], [{ price: 1 }]));
        assert.doesNotThrow(() => assertWholesaleAllowed("Pro", [{ name: "Dus" }], undefined));
        assert.doesNotThrow(() => assertWholesaleAllowed(null, [{ name: "Dus" }], undefined));
    });
});

describe("read payload", () => {
    test("Decimals become numbers", () => {
        const [u] = toUnitPayload([{ id: 1, itemVariantId: null, name: "Dus", factor: new Decimal("40.0000"), price: new Decimal("128000.0000"), barcode: "899", sortOrder: 0 }]);
        assert.deepEqual(u, { id: 1, itemVariantId: null, name: "Dus", factor: 40, price: 128000, barcode: "899", sortOrder: 0 });
        const [t] = toTierPayload([{ id: 2, itemVariantId: null, itemUnitId: 1, priceLevelId: null, minQuantity: new Decimal("10"), price: new Decimal("120000") }]);
        assert.deepEqual(t, { id: 2, itemVariantId: null, itemUnitId: 1, priceLevelId: null, minQuantity: 10, price: 120000 });
        assert.deepEqual(toUnitPayload(undefined), []);
    });
});

// ── Reconciliation against a fake transaction ────────────────────────────────

type Row = Record<string, any>;

/** Just enough of Prisma's TransactionClient for syncItemUnitsAndTiers. */
function fakeTx(seed: { units?: Row[]; tiers?: Row[]; items?: Row[]; variants?: Row[]; levels?: Row[] } = {}) {
    const db = {
        units: (seed.units ?? []).map((r): Row => ({ deleted: false, ...r })),
        tiers: (seed.tiers ?? []).map((r): Row => ({ deleted: false, ...r })),
        items: (seed.items ?? [{ id: 1, itemName: "Indomie", alternateLookUp: "111", deleted: false }]),
        variants: seed.variants ?? [],
        levels: (seed.levels ?? []).map((r): Row => ({ deleted: false, ...r })),
        itemUpdates: [] as Row[],
    };
    let nextId = 100;
    const match = (row: Row, where: Row): boolean => Object.entries(where ?? {}).every(([k, v]) => {
        if (v && typeof v === "object" && !(v instanceof Date)) {
            if ("in" in v) return v.in.includes(row[k]);
            if ("not" in v) return row[k] !== v.not;
            return true;
        }
        return row[k] === v;
    });
    const table = (rows: Row[]) => ({
        findMany: async ({ where }: Row = {}) => rows.filter(r => match(r, where)),
        create: async ({ data }: Row) => { const r = { id: nextId++, ...data }; rows.push(r); return r; },
        update: async ({ where, data }: Row) => { const r = rows.find(x => x.id === where.id)!; Object.assign(r, data); return r; },
        updateMany: async ({ where, data }: Row) => {
            const hit = rows.filter(r => match(r, where)); hit.forEach(r => Object.assign(r, data)); return { count: hit.length };
        },
    });
    const tx: any = {
        itemUnit: {
            ...table(db.units),
            // relation select used by the barcode check
            findMany: async ({ where }: Row = {}) => db.units.filter(r => match(r, where))
                .map(u => ({ ...u, item: db.items.find(i => i.id === u.itemId) ?? { id: u.itemId, itemName: "?" } })),
        },
        itemPriceTier: table(db.tiers),
        priceLevel: table(db.levels),
        itemVariant: {
            findMany: async ({ where }: Row = {}) => db.variants.filter(r => match(r, where))
                .map(v => ({ ...v, item: db.items.find(i => i.id === v.itemId) })),
        },
        item: {
            findMany: async ({ where }: Row = {}) => db.items.filter(r => match(r, where)),
            update: async ({ where, data }: Row) => { db.itemUpdates.push({ id: where.id, ...data }); return { id: where.id }; },
        },
    };
    return { tx, db };
}

describe("syncItemUnitsAndTiers", () => {
    test("no units/priceTiers keys → nothing written, item not bumped", async () => {
        const { tx, db } = fakeTx();
        assert.equal(await syncItemUnitsAndTiers(tx, 1, undefined, undefined, "Basic"), false);
        assert.equal(db.itemUpdates.length, 0);
    });

    test("creates a unit and a tier that names it, then bumps Item.updatedAt", async () => {
        const { tx, db } = fakeTx({ levels: [{ id: 3, name: "Grosir" }] });
        const wrote = await syncItemUnitsAndTiers(
            tx, 1,
            [{ name: "Dus", factor: 40, price: 128000, barcode: "8990001" }],
            [{ unitName: "dus", minQuantity: 10, price: 120000 }, { priceLevelId: 3, price: 3200 }],
            "Basic",
        );
        assert.equal(wrote, true);
        assert.equal(db.units.length, 1);
        assert.equal(db.units[0].factor, "40");
        assert.equal(db.tiers.length, 2);
        assert.equal(db.tiers[0].itemUnitId, db.units[0].id, "unitName resolved to the new unit's id");
        assert.equal(db.tiers[1].priceLevelId, 3);
        assert.equal(db.tiers[1].minQuantity, "1");
        assert.equal(db.itemUpdates.length, 1, "children only sync inside the item delta → parent bumped");
        assert.ok(db.itemUpdates[0].updatedAt instanceof Date);
    });

    test("the payload is the complete set: a dropped unit is soft-deleted and takes its tiers along", async () => {
        const { tx, db } = fakeTx({
            units: [{ id: 5, itemId: 1, name: "Dus", barcode: null }, { id: 6, itemId: 1, name: "Pak", barcode: null }],
            tiers: [{ id: 9, itemId: 1, itemUnitId: 6, priceLevelId: null }],
        });
        await syncItemUnitsAndTiers(tx, 1, [{ id: 5, name: "Dus", factor: 40, price: 128000 }], undefined, "Pro");
        const pak = db.units.find(u => u.id === 6)!;
        assert.equal(pak.deleted, true);
        assert.ok(pak.deletedAt instanceof Date);
        assert.equal(db.units.find(u => u.id === 5)!.deleted, false);
        assert.equal(db.tiers[0].deleted, true, "a tier on a removed unit never applies again");
        assert.equal(db.itemUpdates.length, 1);
    });

    test("empty tiers array soft-deletes every stored tier", async () => {
        const { tx, db } = fakeTx({ tiers: [{ id: 9, itemId: 1 }, { id: 10, itemId: 1 }] });
        await syncItemUnitsAndTiers(tx, 1, undefined, [], "Basic");
        assert.deepEqual(db.tiers.map(t => t.deleted), [true, true]);
    });

    test("an id from another item is rejected", async () => {
        const { tx } = fakeTx({ units: [{ id: 5, itemId: 2, name: "Dus" }] });
        await assert.rejects(
            syncItemUnitsAndTiers(tx, 1, [{ id: 5, name: "Dus", factor: 40, price: 1 }], undefined, "Basic"),
            /does not belong/,
        );
    });

    test("unit barcode may not collide with an item barcode, a variant barcode or another item's unit", async () => {
        const items = [{ id: 1, itemName: "Indomie", alternateLookUp: "111", deleted: false }];
        let f = fakeTx({ items });
        await assert.rejects(syncItemUnitsAndTiers(f.tx, 1, [{ name: "Dus", factor: 40, price: 1, barcode: "111" }], undefined, "Basic"), /used by item/);
        f = fakeTx({ items, variants: [{ id: 4, itemId: 1, barcode: "222", variantName: "Soto", deleted: false }] });
        await assert.rejects(syncItemUnitsAndTiers(f.tx, 1, [{ name: "Dus", factor: 40, price: 1, barcode: "222" }], undefined, "Basic"), /used by variant/);
        f = fakeTx({ items, units: [{ id: 7, itemId: 2, name: "Dus", barcode: "333" }] });
        await assert.rejects(syncItemUnitsAndTiers(f.tx, 1, [{ name: "Dus", factor: 40, price: 1, barcode: "333" }], undefined, "Basic"), /used by unit/);
        // Tagged so the app can localize it (error_barcode_in_use).
        f = fakeTx({ items });
        await assert.rejects(
            syncItemUnitsAndTiers(f.tx, 1, [{ name: "Dus", factor: 40, price: 1, barcode: "111" }], undefined, "Basic"),
            (e: any) => e.errorCode === "BARCODE_IN_USE" && e.params.barcode === "111" && e.params.owner === "Indomie",
        );
        // This item's own stored unit may keep (or hand over) its barcode.
        f = fakeTx({ items, units: [{ id: 7, itemId: 1, name: "Dus", barcode: "333" }] });
        await assert.doesNotReject(syncItemUnitsAndTiers(f.tx, 1, [{ id: 7, name: "Dus", factor: 40, price: 1, barcode: "333" }], undefined, "Basic"));
    });

    test("breaks that get dearer, or twice the same quantity, are rejected before anything is written", async () => {
        let f = fakeTx();
        await assert.rejects(
            syncItemUnitsAndTiers(f.tx, 1, undefined, [{ minQuantity: 12, price: 3300 }, { minQuantity: 40, price: 3400 }], "Basic"),
            /must be lower/,
        );
        assert.equal(f.db.tiers.length, 0);
        f = fakeTx();
        await assert.rejects(
            syncItemUnitsAndTiers(f.tx, 1, undefined, [{ minQuantity: 12, price: 3300 }, { minQuantity: "12", price: 3200 }], "Basic"),
            /same quantity/,
        );
        assert.equal(f.db.tiers.length, 0);
    });

    test("a tier on an unknown unit name or a deleted level is rejected", async () => {
        let f = fakeTx();
        await assert.rejects(syncItemUnitsAndTiers(f.tx, 1, undefined, [{ unitName: "Dus", price: 1 }], "Basic"), /not on this item/);
        f = fakeTx({ levels: [{ id: 3, name: "Grosir", deleted: true }] });
        await assert.rejects(syncItemUnitsAndTiers(f.tx, 1, undefined, [{ priceLevelId: 3, price: 1 }], "Basic"), /price level/);
    });

    test("Retail Lite: adding is refused before anything is written", async () => {
        const { tx, db } = fakeTx();
        await assert.rejects(
            syncItemUnitsAndTiers(tx, 1, [{ name: "Dus", factor: 40, price: 1 }], undefined, "Lite"),
            (e: any) => e instanceof PlanLimitError,
        );
        assert.equal(db.units.length, 0);
        assert.equal(db.itemUpdates.length, 0);
    });
});
