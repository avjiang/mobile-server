import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newToken, priceCart, QrMenu, TOKEN_RE } from '../qr-order.service';

// F&B QR self-order pricing (docs/modules/FNB.md P6): the diner's cart is
// re-priced from the menu; nothing the phone says about prices is trusted.

const menu: QrMenu = {
    categories: [{ id: 1, name: 'Kopi', icon: 'coffee' }],
    items: [
        { id: 10, name: 'Es Kopi Susu Aren', description: null, price: 18000, imageUrl: null, categoryId: 1, variants: [], groups: [1, 2], hasTax: true },
        { id: 11, name: 'Kopi Hitam', description: null, price: 8000, imageUrl: null, categoryId: 1, variants: [], groups: [] },
        { id: 12, name: 'Teh', description: null, price: 6000, imageUrl: null, categoryId: 1, variants: [{ id: 5, name: 'Besar', price: 9000 }], groups: [] },
    ],
    groups: [
        { id: 1, name: 'Es/Panas', min: 1, max: 1, free: 0, options: [{ id: 101, name: 'Es', price: 0, isDefault: true }, { id: 102, name: 'Panas', price: 0, isDefault: false }] },
        { id: 2, name: 'Topping', min: 0, max: 2, free: 1, options: [{ id: 201, name: 'Boba', price: 5000, isDefault: false }, { id: 202, name: 'Cincau', price: 3000, isDefault: false }] },
    ],
};

describe('priceCart (F&B P6)', () => {
    test('prices from the menu; the free topping is the pricier one', () => {
        const [l] = priceCart(menu, [{ itemId: 10, quantity: 2, modifierIds: [101, 201, 202], unitPrice: 1 }]);
        assert.equal(l.unitPrice, 18000 + 3000); // Boba free, Cincau paid
        assert.equal(l.quantity, 2);
        assert.equal(l.hasTax, true);
        assert.equal(l.source, 'qr');
        assert.deepEqual(l.modifiers?.map((m) => `${m.modifierName}:${m.price}`).sort(), ['Boba:0', 'Cincau:3000', 'Es:0']);
    });

    test('a required group must be chosen', () => {
        assert.throws(() => priceCart(menu, [{ itemId: 10, quantity: 1, modifierIds: [] }]), /Es\/Panas/);
    });

    test('max is enforced and foreign options are refused', () => {
        assert.throws(() => priceCart(menu, [{ itemId: 10, quantity: 1, modifierIds: [101, 102] }]), /Too many/);
        assert.throws(() => priceCart(menu, [{ itemId: 11, quantity: 1, modifierIds: [201] }]), /no longer available/);
    });

    test('variants price the line and are required', () => {
        assert.equal(priceCart(menu, [{ itemId: 12, quantity: 1, variantId: 5 }])[0].unitPrice, 9000);
        assert.throws(() => priceCart(menu, [{ itemId: 12, quantity: 1 }]), /variant/);
    });

    test('unknown items, bad quantities, empty carts and huge orders are refused', () => {
        assert.throws(() => priceCart(menu, [{ itemId: 99, quantity: 1 }]), /no longer available/);
        assert.throws(() => priceCart(menu, [{ itemId: 11, quantity: 0 }]), /Quantity/);
        assert.throws(() => priceCart(menu, [{ itemId: 11, quantity: 51 }]), /Quantity/);
        assert.throws(() => priceCart(menu, []), /empty/);
        const big = Array.from({ length: 30 }, () => ({ itemId: 10, quantity: 50, modifierIds: [101, 201, 202] }));
        assert.throws(() => priceCart(menu, big), /too large/);
    });
});

describe('newToken', () => {
    test('is 10 chars of base62 and not repeated', () => {
        const a = newToken(), b = newToken();
        assert.match(a, TOKEN_RE);
        assert.match(b, TOKEN_RE);
        assert.notEqual(a, b);
    });
});
