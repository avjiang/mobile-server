import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { expandRecipeLines } from '../recipe.service';

describe('expandRecipeLines (F&B D4)', () => {
    const recipes = [
        { itemId: 1, modifierId: null, ingredientItemId: 100, quantity: 150, batchYield: null }, // 150 g rice per plate
        { itemId: 1, modifierId: null, ingredientItemId: 101, quantity: 1000, batchYield: 20 }, // 1 L sauce per 20 plates
        { itemId: null, modifierId: 7, ingredientItemId: 102, quantity: 1, batchYield: null },  // extra egg
        { itemId: null, modifierId: 7, ingredientItemId: 100, quantity: 10, batchYield: null }, // + a little rice
    ];

    test('per unit: quantity / yield; option recipes × picks merge per ingredient', () => {
        const out = expandRecipeLines([
            { itemId: 1, quantity: 2, modifiers: [{ modifierId: 7, quantity: 2 }] },
        ], recipes);
        const by = Object.fromEntries(out.map((o) => [o.ingredientItemId, o]));
        assert.equal(by[100].stockConsumptionQty.toNumber(), 150 + 10 * 2);
        assert.equal(by[101].stockConsumptionQty.toNumber(), 50);
        assert.equal(by[102].stockConsumptionQty.toNumber(), 2);
        assert.ok(out.every((o) => o.quantity === 2 && o.sourceIndex === 0));
    });

    test('no recipe (retail / laundry lines) adds nothing; zero quantity adds nothing', () => {
        assert.deepEqual(expandRecipeLines([{ itemId: 5, quantity: 3 }], recipes), []);
        assert.deepEqual(expandRecipeLines([{ itemId: 1, quantity: 0 }], recipes), []);
        assert.deepEqual(expandRecipeLines([{ itemId: 1, quantity: 1 }], []), []);
    });
});
