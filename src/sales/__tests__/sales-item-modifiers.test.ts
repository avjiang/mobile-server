import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { attachSalesItemModifiers, rowIndexesByLine } from '../sales-item-modifiers';

// A fake transaction: persisted sales_item ids, the modifier library, and a
// capture of what would be inserted.
const fakeTx = (persistedIds: number[], library: { id: number; name: string; price: number; group: string }[] = []) => {
    const inserted: any[] = [];
    let modifierReads = 0;
    const tx: any = {
        salesItem: { findMany: async () => persistedIds.map((id) => ({ id })) },
        modifier: {
            findMany: async ({ where }: any) => {
                modifierReads++;
                return library
                    .filter((m) => where.id.in.includes(m.id))
                    .map((m) => ({ id: m.id, name: m.name, price: m.price, group: { name: m.group } }));
            },
        },
        salesItemModifier: { createMany: async ({ data }: any) => { inserted.push(...data); } },
    };
    return { tx, inserted, reads: () => modifierReads };
};

describe('rowIndexesByLine', () => {
    test('groups FIFO-split rows under their request line', () => {
        const map = rowIndexesByLine([{ __order: 0 }, { __order: 0 }, { __order: 1 }, { __order: 2 }, { __order: 2 }]);
        assert.deepEqual(map.get(0), [0, 1]);
        assert.deepEqual(map.get(1), [2]);
        assert.deepEqual(map.get(2), [3, 4]);
    });
});

describe('attachSalesItemModifiers', () => {
    test('a sale with no modifiers touches nothing', async () => {
        const { tx, inserted, reads } = fakeTx([10]);
        await attachSalesItemModifiers(tx, 1, [{}], [{ __order: 0 }]);
        assert.equal(inserted.length, 0);
        assert.equal(reads(), 0);
    });

    test('snapshots names and prices the terminal sent, on the right row', async () => {
        const { tx, inserted } = fakeTx([10, 11], [{ id: 5, name: 'Pedas (renamed)', price: 0, group: 'Level' }]);
        await attachSalesItemModifiers(tx, 1, [
            {},
            { modifiers: [{ modifierId: 5, groupName: 'Level pedas', modifierName: 'Pedas', price: 0, quantity: 1 }] },
        ], [{ __order: 0 }, { __order: 1 }]);
        assert.equal(inserted.length, 1);
        assert.equal(inserted[0].salesItemId, 11);
        assert.equal(inserted[0].modifierId, 5);
        assert.equal(inserted[0].groupName, 'Level pedas');
        assert.equal(inserted[0].modifierName, 'Pedas');
    });

    test('a split line gets its modifiers on every row', async () => {
        const { tx, inserted } = fakeTx([20, 21]);
        await attachSalesItemModifiers(tx, 1, [
            { modifiers: [{ groupName: 'Topping', modifierName: 'Keju', price: 5000, quantity: 2 }] },
        ], [{ __order: 0 }, { __order: 0 }]);
        assert.deepEqual(inserted.map((r) => r.salesItemId), [20, 21]);
        assert.ok(inserted.every((r) => r.quantity === 2 && Number(r.price) === 5000));
    });

    test('fills a missing name and price from the library; a deleted option keeps the sent names', async () => {
        const { tx, inserted } = fakeTx([30], [{ id: 7, name: 'Telur', price: 4000, group: 'Tambahan' }]);
        await attachSalesItemModifiers(tx, 1, [{
            modifiers: [
                { modifierId: 7 },
                { modifierId: 99, groupName: 'Gula', modifierName: 'Sedikit', price: 0 },
            ],
        }], [{ __order: 0 }]);
        assert.equal(inserted.length, 2);
        assert.equal(inserted[0].modifierName, 'Telur');
        assert.equal(inserted[0].groupName, 'Tambahan');
        assert.equal(Number(inserted[0].price), 4000);
        assert.equal(inserted[0].quantity, 1);
        // Option 99 no longer exists: keep the snapshot, drop the dangling id.
        assert.equal(inserted[1].modifierId, null);
        assert.equal(inserted[1].modifierName, 'Sedikit');
    });

    test('never fails the sale: an unnamed pick is skipped, a row-count mismatch writes nothing', async () => {
        const a = fakeTx([40]);
        await attachSalesItemModifiers(a.tx, 1, [{ modifiers: [{ price: 1000 }] }], [{ __order: 0 }]);
        assert.equal(a.inserted.length, 0);

        const b = fakeTx([50, 51]);
        await attachSalesItemModifiers(b.tx, 1, [{ modifiers: [{ modifierName: 'Keju' }] }], [{ __order: 0 }]);
        assert.equal(b.inserted.length, 0);
    });
});
