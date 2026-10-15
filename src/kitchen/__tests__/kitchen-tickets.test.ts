import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { groupByStation, writeSaleKitchenTickets } from '../kitchen-tickets';

describe('groupByStation', () => {
    test('splits by station in cart order, keeps options and note, skips laundry components', () => {
        const route: Record<number, number | null> = { 1: 10, 2: 20, 3: null };
        const groups = groupByStation([
            { itemId: 1, itemName: 'Mie Aceh', quantity: 2, specialInstructions: ' tanpa bawang ',
              modifiers: [{ groupName: 'Level', modifierName: 'Pedas' }, { groupName: 'X', modifierName: '' }] },
            { itemId: 2, itemName: 'Es Teh', quantity: 1 },
            { itemId: 1, itemName: 'Mie Aceh', quantity: 1 },
            { itemId: 3, itemName: 'Kerupuk', quantity: 3 },
            { itemId: 9, itemName: 'Deterjen', isLaundryComponent: true },
        ], (id) => route[id] ?? null);
        assert.deepEqual([...groups.keys()], [10, 20, null]);
        const kitchen = groups.get(10)!;
        assert.equal(kitchen.length, 2);
        assert.equal(kitchen[0].quantity, 2);
        assert.equal(kitchen[0].note, 'tanpa bawang');
        assert.deepEqual(kitchen[0].modifiers, [{ groupName: 'Level', modifierName: 'Pedas', quantity: 1 }]);
        assert.equal(groups.get(null)![0].name, 'Kerupuk');
    });
});

describe('writeSaleKitchenTickets', () => {
    test('a deleted station is unrouted; one ticket per station; never throws', async () => {
        const created: any[] = [];
        const tx: any = {
            item: { findMany: async () => [
                { id: 1, stationId: null, category: { stationId: 10 } },
                { id: 2, stationId: 99, category: { stationId: 10 } },
            ] },
            station: { findMany: async () => [{ id: 10 }] },
            kitchenTicket: { createMany: async ({ data }: any) => { created.push(...data); } },
        };
        const n = await writeSaleKitchenTickets(tx, { id: 5, outletId: 1, queueNo: 'A-007', salesType: 'Dine-In' },
            [{ itemId: 1, itemName: 'Nasi Goreng', quantity: 1 }, { itemId: 2, itemName: 'Es Kopi', quantity: 1 }]);
        assert.equal(n, 2);
        assert.deepEqual(created.map((t) => t.stationId), [10, null]);
        assert.ok(created.every((t) => t.queueNo === 'A-007' && t.salesId === 5));

        const broken: any = { item: { findMany: async () => { throw new Error('db down'); } } };
        assert.equal(await writeSaleKitchenTickets(broken, { id: 6, outletId: 1 }, [{ itemId: 1 }]), 0);
    });
});
