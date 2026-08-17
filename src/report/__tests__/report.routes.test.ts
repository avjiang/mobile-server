import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import router = require('../report.controller');

/**
 * Guards the server-side permission gate on the outlet report.
 *
 * The Flutter client hides "Generate Outlet Report" behind
 * AppPermission.viewFinancialReports, but that only hides a button — before
 * this gate existed, any authenticated user of the tenant could call
 * GET /report/generateOutletReport and read outlet financials directly.
 *
 * This asserts the middleware is genuinely wired to the route, so removing it
 * fails the suite instead of silently reopening the hole.
 */
type Layer = {
    route?: {
        path: string;
        stack: { name: string }[];
    };
};

const layersFor = (path: string) =>
    ((router as unknown as { stack: Layer[] }).stack || [])
        .filter((layer) => layer.route?.path === path);

describe('report routes — permission gating', () => {
    test('GET /generateOutletReport is wrapped in a permission gate', () => {
        const layers = layersFor('/generateOutletReport');
        assert.equal(layers.length, 1, 'expected exactly one /generateOutletReport route');

        const handlers = layers[0].route!.stack;
        assert.ok(
            handlers.length >= 2,
            `expected a gate + handler on /generateOutletReport, found ${handlers.length} handler(s) — ` +
            'the requirePermission(VIEW_FINANCIAL_REPORTS) middleware appears to have been removed',
        );
    });

    test('the route is registered at all', () => {
        assert.equal(layersFor('/generateOutletReport').length, 1);
        assert.equal(layersFor('/generate').length, 1);
        assert.equal(layersFor('/generateLaundryReport').length, 1);
    });
});
