import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    summarizeManualDiscount,
    canGiveAnyDiscount,
    parseCapPercent,
    formatPercent,
    saleRungAt,
    isLateSale,
    decideManualDiscount,
    enforceManualDiscount,
    ManualDiscountSale,
} from '../manual-discount';
import { ErrorCode, RequestValidateError } from '../../api-helpers/error';
import { PERMISSION } from '../../permission/permission-names';

const NOW = new Date('2026-09-29T08:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

// Gross 100,000: 2 × 30,000 + 1 × 40,000.
const sale = (over: Partial<ManualDiscountSale> = {}, lineDiscounts: [number, number] = [0, 0]): ManualDiscountSale => ({
    businessDate: minutesAgo(1),
    discountAmount: 0,
    discountPercentage: 0,
    totalItemDiscountAmount: lineDiscounts[0] + lineDiscounts[1],
    salesItems: [
        { price: 30000, quantity: 2, discountAmount: lineDiscounts[0], discountPercentage: 0 },
        { price: 40000, quantity: 1, discountAmount: lineDiscounts[1], discountPercentage: 0 },
    ],
    ...over,
});

const ctx = (permissions: string[] = []) => ({
    databaseName: 'tenant_db', userId: 3, username: 'budi', permissions, saleRef: 'key-1', now: NOW,
});

describe('summarizeManualDiscount — sanity', () => {
    test('totals gross, line and order discount', () => {
        const s = summarizeManualDiscount(sale({ discountAmount: 5000 }, [6000, 0]));
        assert.equal(s.gross.toNumber(), 100000);
        assert.equal(s.itemAmount.toNumber(), 6000);
        assert.equal(s.orderAmount.toNumber(), 5000);
        assert.equal(s.total.toNumber(), 11000);
    });

    test('a sale without discount fields (old APK) is zero, not an error', () => {
        const s = summarizeManualDiscount({ salesItems: [{ price: 1000, quantity: 1 }] });
        assert.equal(s.total.toNumber(), 0);
    });

    test('rejects a negative line discount', () => {
        assert.throws(() => summarizeManualDiscount(sale({}, [-1, 0])), RequestValidateError);
    });

    test('rejects a line discount above price × qty (+1 tolerance ok)', () => {
        assert.doesNotThrow(() => summarizeManualDiscount(sale({}, [60001, 0])));
        assert.throws(() => summarizeManualDiscount(sale({}, [60002, 0])), RequestValidateError);
    });

    test('rejects a line or order % outside 0–100', () => {
        const bad = sale();
        bad.salesItems![0].discountPercentage = 101;
        assert.throws(() => summarizeManualDiscount(bad), RequestValidateError);
        assert.throws(() => summarizeManualDiscount(sale({ discountPercentage: -5 })), RequestValidateError);
    });

    test('rejects a negative order discount or one above the discounted subtotal', () => {
        assert.throws(() => summarizeManualDiscount(sale({ discountAmount: -1 })), RequestValidateError);
        // subtotal after line discounts = 100,000 − 10,000 = 90,000
        assert.doesNotThrow(() => summarizeManualDiscount(sale({ discountAmount: 90001 }, [10000, 0])));
        assert.throws(() => summarizeManualDiscount(sale({ discountAmount: 90002 }, [10000, 0])), RequestValidateError);
    });

    test('rejects a header totalItemDiscountAmount that disagrees with the lines', () => {
        assert.throws(
            () => summarizeManualDiscount(sale({ totalItemDiscountAmount: 0 }, [6000, 0])),
            RequestValidateError,
        );
    });

    test('rejects non-numeric input', () => {
        assert.throws(() => summarizeManualDiscount(sale({ discountAmount: 'abc' as any })), RequestValidateError);
    });
});

describe('helpers', () => {
    test('Give Discount and the super-admin wildcard are uncapped', () => {
        assert.equal(canGiveAnyDiscount([PERMISSION.GIVE_DISCOUNT]), true);
        assert.equal(canGiveAnyDiscount(['*']), true);
        assert.equal(canGiveAnyDiscount([PERMISSION.PROCESS_SALES]), false);
        assert.equal(canGiveAnyDiscount(undefined), false);
    });

    test('parseCapPercent defaults to 0 and clamps to 0–100', () => {
        assert.equal(parseCapPercent(null), 0);
        assert.equal(parseCapPercent(''), 0);
        assert.equal(parseCapPercent('x'), 0);
        assert.equal(parseCapPercent('12.5'), 12.5);
        assert.equal(parseCapPercent('250'), 100);
        assert.equal(parseCapPercent('-3'), 0);
    });

    test('formatPercent drops a trailing .0', () => {
        assert.equal(formatPercent(10), '10');
        assert.equal(formatPercent(10.0), '10');
        assert.equal(formatPercent(12.5), '12.5');
        assert.equal(formatPercent(0), '0');
    });

    test('saleRungAt prefers clientCreatedAt, falls back to businessDate', () => {
        assert.equal(
            saleRungAt({ clientCreatedAt: minutesAgo(2), businessDate: minutesAgo(600) })!.toISOString(),
            minutesAgo(2),
        );
        assert.equal(saleRungAt({ businessDate: minutesAgo(5) })!.toISOString(), minutesAgo(5));
        assert.equal(saleRungAt({ clientCreatedAt: 'garbage', businessDate: minutesAgo(5) })!.toISOString(), minutesAgo(5));
        assert.equal(saleRungAt({}), null);
    });

    test('isLateSale: > 10 minutes, or no timestamp at all', () => {
        assert.equal(isLateSale(new Date(minutesAgo(9)), NOW), false);
        assert.equal(isLateSale(new Date(minutesAgo(11)), NOW), true);
        assert.equal(isLateSale(null, NOW), true);
        // A device clock ahead of ours makes the sale look fresh, never late.
        assert.equal(isLateSale(new Date(NOW.getTime() + 5 * 60_000), NOW), false);
    });
});

describe('decideManualDiscount — cap', () => {
    const summary = (total: number) => summarizeManualDiscount(sale({ discountAmount: total }));

    test('no discount → allow even with cap 0', () => {
        assert.equal(
            decideManualDiscount({ summary: summary(0), canGiveAnyDiscount: false, capPercent: 0, rungAt: NOW, now: NOW }).action,
            'allow',
        );
    });

    test('within cap% × gross (+1) → allow', () => {
        assert.equal(
            decideManualDiscount({ summary: summary(10001), canGiveAnyDiscount: false, capPercent: 10, rungAt: NOW, now: NOW }).action,
            'allow',
        );
    });

    test('fresh sale over the cap → reject with the formatted percent', () => {
        const d = decideManualDiscount({ summary: summary(10002), canGiveAnyDiscount: false, capPercent: 10, rungAt: NOW, now: NOW });
        assert.equal(d.action, 'reject');
        assert.equal((d as any).percent, '10');
    });

    test('cap 0 means no manual discount for a fresh sale', () => {
        assert.equal(
            decideManualDiscount({ summary: summary(500), canGiveAnyDiscount: false, capPercent: 0, rungAt: NOW, now: NOW }).action,
            'reject',
        );
    });

    test('late sale over the cap → accept-late', () => {
        assert.equal(
            decideManualDiscount({
                summary: summary(50000), canGiveAnyDiscount: false, capPercent: 10,
                rungAt: new Date(minutesAgo(30)), now: NOW,
            }).action,
            'accept-late',
        );
    });

    test('Give Discount holder is never capped', () => {
        assert.equal(
            decideManualDiscount({ summary: summary(90000), canGiveAnyDiscount: true, capPercent: 0, rungAt: NOW, now: NOW }).action,
            'allow',
        );
    });
});

describe('enforceManualDiscount', () => {
    test('rejects a fresh over-cap sale with DISCOUNT_ABOVE_LIMIT { percent }', async () => {
        await assert.rejects(
            enforceManualDiscount(sale({ discountAmount: 20000 }), ctx(), { readCapSetting: async () => '12.5' }),
            (err: any) => {
                assert.ok(err instanceof RequestValidateError);
                assert.equal(err.statusCode, 400);
                assert.equal(err.errorCode, ErrorCode.DiscountAboveLimit);
                assert.deepEqual(err.params, { percent: '12.5' });
                return true;
            },
        );
    });

    test('accepts and warns for a late over-cap sale', async () => {
        const warnings: string[] = [];
        const d = await enforceManualDiscount(
            sale({ discountAmount: 20000, businessDate: minutesAgo(45) }),
            ctx(),
            { readCapSetting: async () => '10', warn: (l) => warnings.push(l) },
        );
        assert.equal(d.action, 'accept-late');
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /tenant=tenant_db user=budi\(3\) ref=key-1 total=20000\.00 cap=10%/);
    });

    test('does not read the setting for an undiscounted sale or a Give Discount holder', async () => {
        let reads = 0;
        const deps = { readCapSetting: async () => { reads++; return '0'; } };
        await enforceManualDiscount(sale(), ctx(), deps);
        await enforceManualDiscount(sale({ discountAmount: 90000 }), ctx([PERMISSION.GIVE_DISCOUNT]), deps);
        assert.equal(reads, 0);
    });

    test('a missing setting (null) means cap 0', async () => {
        await assert.rejects(
            enforceManualDiscount(sale({}, [100, 0]), ctx(), { readCapSetting: async () => null }),
            (err: any) => err.errorCode === ErrorCode.DiscountAboveLimit && err.params.percent === '0',
        );
    });

    test('sanity errors fire even for a Give Discount holder', async () => {
        await assert.rejects(
            enforceManualDiscount(sale({ discountAmount: -5 }), ctx(['*']), { readCapSetting: async () => '0' }),
            (err: any) => err instanceof RequestValidateError && err.errorCode === undefined,
        );
    });
});
