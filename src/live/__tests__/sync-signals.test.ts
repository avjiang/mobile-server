import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { LIVE_NOTIFICATIONS_PATH, LiveNotificationHub, syncTopic } from '../live-notifications';
import { signalFor, syncSignals } from '../sync-signals';
import type { UserInfo } from '../../middleware/authorize-middleware';

const user = (tenantId: number, userId = 1, role = 'user'): UserInfo => ({
    tenantUserId: userId, userId, username: 'u', databaseName: 'db', tenantId, role, notificationTopics: [],
});
const tokens: Record<string, { user: UserInfo }> = {
    // tenant 5: cashier may use outlet 1 only; owner of tenant 5 is admin-like (all outlets)
    cashier: { user: user(5, 1) },
    owner: { user: user(5, 2, 'admin') },
    other: { user: user(9, 3) },
};
const outletsOf = async (u: UserInfo) => (u.role === 'admin' ? null : u.tenantId === 5 ? [1] : [4]);

async function startHub() {
    const hub = new LiveNotificationHub((token) => {
        const claims = tokens[token];
        if (!claims) throw new Error('bad token');
        return claims;
    }, Date.now, outletsOf);
    const server = http.createServer();
    hub.attach(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const stop = async () => {
        hub.closeAll();
        await new Promise<void>((r) => server.close(() => r()));
    };
    return { hub, port, stop };
}

function connect(port: number, token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${LIVE_NOTIFICATIONS_PATH}`, { headers: { token } });
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}
const nextMessage = (ws: WebSocket) =>
    new Promise<any>((resolve) => ws.once('message', (raw) => resolve(JSON.parse(raw.toString()))));
const tick = () => new Promise((r) => setTimeout(r, 30));

test('sync topics are named per tenant and per outlet', () => {
    assert.equal(syncTopic(5), 'sync_t5');
    assert.equal(syncTopic(5, null), 'sync_t5');
    assert.equal(syncTopic(5, 2), 'sync_t5_o2');
});

test('a terminal joins its own tenant and its outlet; another outlet only gets the tenant topic', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const a = await connect(port, 'cashier');
        a.send(JSON.stringify({ type: 'subscribe', topics: ['sync_t9', 'sync_t5_o2'], syncOutletId: 1 }));
        const b = await connect(port, 'cashier');
        b.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 2 }));
        await tick();
        assert.equal(hub.signal('sync_t5', { modules: ['item'] }), 2);
        assert.equal(hub.signal('sync_t5_o1', { modules: ['sales'] }), 1);
        assert.equal(hub.signal('sync_t5_o2', { modules: ['sales'] }), 0, 'outlet 2 is not allowed, and raw sync topics are ignored');
        assert.equal(hub.signal('sync_t9', { modules: ['item'] }), 0, 'another tenant');
        a.close();
        b.close();
    } finally {
        await stop();
    }
});

test('the tenant comes from the token, never the client', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 'other');
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 4 }));
        await tick();
        assert.equal(hub.signal('sync_t9_o4', { modules: ['sales'] }), 1);
        assert.equal(hub.signal('sync_t5_o4', { modules: ['sales'] }), 0);
        ws.close();
    } finally {
        await stop();
    }
});

test('an unrestricted user (admin) may join any outlet of its own tenant', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 'owner');
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 7 }));
        await tick();
        assert.equal(hub.signal('sync_t5_o7', { modules: ['sales'] }), 1);
        ws.close();
    } finally {
        await stop();
    }
});

test('a subscribe without syncOutletId leaves the sync topics', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 'cashier');
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 1 }));
        await tick();
        ws.send(JSON.stringify({ type: 'subscribe', topics: [] }));
        await tick();
        assert.equal(hub.signal('sync_t5_o1', { modules: ['sales'] }), 0);
        ws.close();
    } finally {
        await stop();
    }
});

test('every terminal of the outlet gets the poke, as a "changed" frame', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const terminals = await Promise.all(Array.from({ length: 10 }, () => connect(port, 'cashier')));
        const acks = Promise.all(terminals.map(nextMessage));
        for (const ws of terminals) ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 1 }));
        await acks;
        const frames = Promise.all(terminals.map(nextMessage));
        assert.equal(hub.signal('sync_t5_o1', { modules: ['sales', 'stock'], outletId: 1 }), 10);
        for (const frame of await frames) {
            assert.deepEqual(frame, { type: 'changed', topic: 'sync_t5_o1', data: { modules: ['sales', 'stock'], outletId: 1 } });
        }
        for (const ws of terminals) ws.close();
    } finally {
        await stop();
    }
});

test('a sync subscribe is confirmed with the topics joined', async () => {
    const { port, stop } = await startHub();
    try {
        const ws = await connect(port, 'cashier');
        const ack = nextMessage(ws);
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 2 }));
        assert.deepEqual(await ack, { type: 'subscribed', syncTopics: ['sync_t5'] });
        const ack2 = nextMessage(ws);
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 1 }));
        assert.deepEqual(await ack2, { type: 'subscribed', syncTopics: ['sync_t5', 'sync_t5_o1'] });
        ws.close();
    } finally {
        await stop();
    }
});

test('signals are not replayed: a later subscribe with since gets nothing old', async () => {
    const { hub, port, stop } = await startHub();
    try {
        hub.signal('sync_t5_o1', { modules: ['sales'] });
        const ws = await connect(port, 'cashier');
        const got: any[] = [];
        ws.on('message', (raw) => got.push(JSON.parse(raw.toString())));
        ws.send(JSON.stringify({ type: 'subscribe', topics: [], syncOutletId: 1, since: 0 }));
        await tick();
        assert.deepEqual(got.map((m) => m.type), ['subscribed'], 'only the ack, no replayed signal');
        ws.close();
    } finally {
        await stop();
    }
});

test('the route table: writes signal, reads and no-op writes do not', () => {
    assert.deepEqual(signalFor('POST', '/sales/completeNewSales'), { modules: ['sales', 'stock'], scope: 'outlet' });
    assert.deepEqual(signalFor('PUT', '/sales/void/12'), { modules: ['sales', 'stock'], scope: 'outlet' });
    assert.deepEqual(signalFor('PUT', '/stock/adjustment'), { modules: ['stock'], scope: 'outlet' });
    assert.deepEqual(signalFor('PUT', '/item/update'), { modules: ['item', 'stock'], scope: 'tenant' });
    assert.deepEqual(signalFor('POST', '/customer/create'), { modules: ['customers'], scope: 'tenant' });
    assert.equal(signalFor('GET', '/sales/outlet'), null);
    assert.equal(signalFor('POST', '/sales/calculate'), null);
    assert.equal(signalFor('POST', '/sales/photo/upload-url'), null);
    assert.equal(signalFor('POST', '/user/3/change-password'), null);
    assert.equal(signalFor('POST', '/session/openSession'), null);
    assert.equal(signalFor('POST', '/loyalty/redeem'), null);
});

async function startApp(status: number, outletId?: number) {
    const sent: Array<{ topic: string; data: Record<string, unknown> }> = [];
    const app = express();
    app.use((req: any, _res, next) => {
        req.user = user(5);
        req.outletId = outletId;
        next();
    });
    app.use(syncSignals((topic, data) => { sent.push({ topic, data }); return 1; }));
    app.all('*', (_req, res) => { res.status(status).json({}); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { sent, base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test('the middleware signals the request outlet after a 2xx write', async () => {
    const { sent, base, close } = await startApp(200, 3);
    try {
        await fetch(`${base}/sales/completeNewSales`, { method: 'POST' });
        await fetch(`${base}/customer/update`, { method: 'PUT' });
        await fetch(`${base}/sales/outlet`);
        await tick();
        assert.deepEqual(sent, [
            { topic: 'sync_t5_o3', data: { modules: ['sales', 'stock'], outletId: 3 } },
            { topic: 'sync_t5', data: { modules: ['customers'], outletId: null } },
        ]);
    } finally {
        await close();
    }
});

test('a failed write signals nothing', async () => {
    const { sent, base, close } = await startApp(400, 3);
    try {
        await fetch(`${base}/sales/completeNewSales`, { method: 'POST' });
        await tick();
        assert.deepEqual(sent, []);
    } finally {
        await close();
    }
});
