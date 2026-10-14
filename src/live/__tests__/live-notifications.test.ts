import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { CLOSE_TOKEN_EXPIRED, LIVE_NOTIFICATIONS_PATH, LiveNotificationHub, REPLAY_WINDOW_MS } from '../live-notifications';
import type { UserInfo } from '../../middleware/authorize-middleware';

// A fake token table instead of real JWTs: token string → claims.
const user = (tenantId: number, topics: string[]): UserInfo => ({
    tenantUserId: 1, userId: 1, username: 'u', databaseName: 'db', tenantId, role: 'user', notificationTopics: topics,
});
const tokens: Record<string, { user: UserInfo; exp?: number }> = {
    t5: { user: user(5, ['tenant_5', 'tenant_5_outlet_1_sales']) },
    t9: { user: user(9, ['tenant_9_outlet_1_sales']) },
};

async function startHub(now: () => number = Date.now) {
    const hub = new LiveNotificationHub((token) => {
        const claims = tokens[token];
        if (!claims) throw new Error('bad token');
        return claims;
    }, now);
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

function connect(port: number, token?: string, path = LIVE_NOTIFICATIONS_PATH): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers: token ? { token } : {} });
        ws.once('open', () => resolve(ws));
        ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
        ws.once('error', reject);
    });
}

const nextMessage = (ws: WebSocket) =>
    new Promise<any>((resolve) => ws.once('message', (raw) => resolve(JSON.parse(raw.toString()))));
const tick = () => new Promise((r) => setTimeout(r, 30));

test('no token, a bad token, or another path is refused before the upgrade', async () => {
    const { port, stop } = await startHub();
    try {
        await assert.rejects(connect(port), /HTTP 401/);
        await assert.rejects(connect(port, 'nope'), /HTTP 401/);
        await assert.rejects(connect(port, 't5', '/elsewhere'), /HTTP 404/);
    } finally {
        await stop();
    }
});

test('a subscribed topic arrives with the exact FCM payload; others do not', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 't5');
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales'] }));
        await tick();

        assert.equal(hub.publish('tenant_5_outlet_1_inventory', { title: 'x', message: 'y' }), 0);
        const payload = { title: 'Penjualan selesai', message: 'Rp 187.550', type: 'sale_completed', tenantId: 5, outletId: 1, triggeringUserId: 7 };
        const received = nextMessage(ws);
        assert.equal(hub.publish('tenant_5_outlet_1_sales', payload), 1);
        const { at, ...frame } = await received;
        assert.deepEqual(frame, { type: 'notification', topic: 'tenant_5_outlet_1_sales', data: payload });
        assert.equal(typeof at, 'number');
        ws.close();
    } finally {
        await stop();
    }
});

test('a client cannot subscribe to topics its token does not list (another tenant, another permission)', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 't9');
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales', 'tenant_9_outlet_1_inventory', 'tenant_9_outlet_1_sales'] }));
        await tick();
        assert.equal(hub.publish('tenant_5_outlet_1_sales', { title: 'a', message: 'b' }), 0);
        assert.equal(hub.publish('tenant_9_outlet_1_inventory', { title: 'a', message: 'b' }), 0);
        assert.equal(hub.publish('tenant_9_outlet_1_sales', { title: 'a', message: 'b' }), 1);
        ws.close();
    } finally {
        await stop();
    }
});

test('a later subscribe replaces the earlier one; junk messages are ignored', async () => {
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 't5');
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5', 'tenant_5_outlet_1_sales'] }));
        ws.send('not json');
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5'] }));
        await tick();
        assert.equal(hub.publish('tenant_5_outlet_1_sales', { title: 'a', message: 'b' }), 0);
        assert.equal(hub.publish('tenant_5', { title: 'a', message: 'b' }), 1);
        ws.close();
    } finally {
        await stop();
    }
});

test('an expiring token closes the socket with 4001 so the app refreshes it', async () => {
    tokens.soon = { user: user(5, ['tenant_5']), exp: Math.floor(Date.now() / 1000) };
    const { hub, port, stop } = await startHub();
    try {
        const ws = await connect(port, 'soon');
        const [code] = await new Promise<[number]>((r) => ws.once('close', (c) => r([c])));
        assert.equal(code, CLOSE_TOKEN_EXPIRED);
        await tick();
        assert.equal(hub.connectionCount, 0);
    } finally {
        await stop();
    }
});

test('shutdown closes every socket with 1012 (service restart)', async () => {
    const { port, stop } = await startHub();
    const ws = await connect(port, 't5');
    const closed = new Promise<number>((r) => ws.once('close', (c) => r(c)));
    await stop();
    assert.equal(await closed, 1012);
});

/** Collects every frame the socket receives. */
function collect(ws: WebSocket): any[] {
    const frames: any[] = [];
    ws.on('message', (raw) => frames.push(JSON.parse(raw.toString())));
    return frames;
}

test('a push sent while the app was closed is replayed on subscribe with since, oldest first', async () => {
    const { hub, port, stop } = await startHub();
    try {
        hub.publish('tenant_5_outlet_1_sales', { title: 'a', message: 'first' });
        hub.publish('tenant_5_outlet_1_sales', { title: 'b', message: 'second' });
        hub.publish('tenant_9_outlet_1_sales', { title: 'x', message: 'other tenant' });

        const ws = await connect(port, 't5');
        const frames = collect(ws);
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales', 'tenant_9_outlet_1_sales'], since: 0 }));
        await tick();

        assert.deepEqual(frames.map((f) => f.data.message), ['first', 'second']);
        assert.ok(frames.every((f) => f.replay === true && typeof f.at === 'number'));
        assert.ok(frames[0].at < frames[1].at);
        ws.close();
    } finally {
        await stop();
    }
});

test('since skips what the app already has; no since means no replay; live frames carry at', async () => {
    const { hub, port, stop } = await startHub();
    try {
        hub.publish('tenant_5_outlet_1_sales', { message: 'seen' });
        hub.publish('tenant_5_outlet_1_sales', { message: 'missed' });

        const first = await connect(port, 't5');
        const firstFrames = collect(first);
        first.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales'] }));
        await tick();
        assert.equal(firstFrames.length, 0);

        const second = await connect(port, 't5');
        const frames = collect(second);
        second.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales'], since: 0 }));
        await tick();
        const seenAt = frames[0].at;
        frames.length = 0;
        second.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5_outlet_1_sales'], since: seenAt }));
        await tick();
        assert.deepEqual(frames.map((f) => f.data.message), ['missed']);

        frames.length = 0;
        hub.publish('tenant_5_outlet_1_sales', { message: 'live' });
        await tick();
        assert.equal(frames[0].data.message, 'live');
        assert.equal(frames[0].replay, undefined);
        assert.ok(frames[0].at > seenAt);
        first.close();
        second.close();
    } finally {
        await stop();
    }
});

test('pushes older than the replay window are not replayed', async () => {
    let clock = 1_000_000;
    const { hub, port, stop } = await startHub(() => clock);
    try {
        hub.publish('tenant_5', { message: 'old' });
        clock += REPLAY_WINDOW_MS + 1;
        hub.publish('tenant_5', { message: 'recent' });

        const ws = await connect(port, 't5');
        const frames = collect(ws);
        ws.send(JSON.stringify({ type: 'subscribe', topics: ['tenant_5'], since: 0 }));
        await tick();
        assert.deepEqual(frames.map((f) => f.data.message), ['recent']);
        ws.close();
    } finally {
        await stop();
    }
});
