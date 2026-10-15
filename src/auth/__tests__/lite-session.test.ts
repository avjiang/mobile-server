import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { ActiveSession, DeviceInUseError, LiteSessions, SessionReplacedError, liteSessionGuard } from '../lite-session';
import { CLOSE_SESSION_REPLACED, LIVE_NOTIFICATIONS_PATH, LiveNotificationHub } from '../../live/live-notifications';
import type { UserInfo } from '../../middleware/authorize-middleware';

const HOUR = 3600_000;

function fakeStore() {
    const rows = new Map<number, ActiveSession>();
    const revoked: Array<{ id: number; keep: string }> = [];
    return {
        rows, revoked,
        async find(id: number) { return rows.get(id) ?? null; },
        async save(s: ActiveSession) { rows.set(s.tenantUserId, { ...s }); },
        async touch(id: number, at: Date) { const r = rows.get(id); if (r) r.lastSeenAt = at; },
        async revokeOtherRefreshTokens(id: number, keep: string) { revoked.push({ id, keep }); },
    };
}

function setup(now = { t: Date.UTC(2026, 9, 15, 2) }) {
    const store = fakeStore();
    const ended: Array<{ id: number; keep: string; params: Record<string, string> }> = [];
    const online = new Set<string>();
    const sessions = new LiteSessions(
        store,
        (id, sid) => online.has(`${id}:${sid}`),
        (id, keep, params) => ended.push({ id, keep, params }),
        () => now.t,
    );
    return { store, ended, online, sessions, now };
}

test('first login starts a session, revokes nothing else of value, ends no one', async () => {
    const { sessions, store, ended } = setup();
    const sid = await sessions.start(7, { clientDeviceId: 'A', deviceName: 'Samsung A15' }, false);
    assert.match(sid, /^[0-9a-f]{32}$/);
    assert.equal(store.rows.get(7)?.sessionId, sid);
    assert.equal(store.rows.get(7)?.deviceName, 'Samsung A15');
    assert.deepEqual(store.revoked, [{ id: 7, keep: sid }]);
    assert.equal(ended.length, 1); // endSessions is called; with no other sockets it ends none
});

test('a second phone is told the account is in use, with the first phone named', async () => {
    const { sessions, online } = setup();
    const a = await sessions.start(7, { clientDeviceId: 'A', deviceName: 'Samsung A15' }, false);
    online.add(`7:${a}`);
    await assert.rejects(
        sessions.start(7, { clientDeviceId: 'B', deviceName: 'Redmi 13' }, false),
        (e: any) => {
            assert.ok(e instanceof DeviceInUseError);
            assert.equal(e.statusCode, 409);
            assert.equal(e.errorCode, 'LITE_DEVICE_IN_USE');
            assert.equal(e.params?.deviceName, 'Samsung A15');
            assert.equal(e.params?.online, 'true');
            return true;
        },
    );
});

test('takeover replaces the session and ends the old phone', async () => {
    const { sessions, ended } = setup();
    const a = await sessions.start(7, { clientDeviceId: 'A', deviceName: 'Samsung A15' }, false);
    const b = await sessions.start(7, { clientDeviceId: 'B', deviceName: 'Redmi 13' }, true);
    assert.notEqual(a, b);
    assert.equal(ended.at(-1)?.keep, b);
    assert.equal(ended.at(-1)?.params.deviceName, 'Redmi 13');
    assert.equal(ended.at(-1)?.params.online, 'true', 'the device taking over is online even before its socket connects');
    await assert.rejects(sessions.assertCurrent(7, a), (e: any) => {
        assert.ok(e instanceof SessionReplacedError);
        assert.equal(e.statusCode, 401);
        assert.equal(e.errorCode, 'SESSION_REPLACED');
        assert.equal(e.params?.deviceName, 'Redmi 13');
        return true;
    });
    await sessions.assertCurrent(7, b);
});

test('logging in again on the same phone never prompts', async () => {
    const { sessions } = setup();
    await sessions.start(7, { clientDeviceId: 'A' }, false);
    await sessions.start(7, { clientDeviceId: 'A' }, false);
});

test('a phone silent for over 7 days no longer blocks a login elsewhere', async () => {
    const { sessions, now } = setup();
    await sessions.start(7, { clientDeviceId: 'A' }, false);
    now.t += 7 * 24 * HOUR + HOUR;
    await sessions.start(7, { clientDeviceId: 'B' }, false);
});

test('an app that sends no device id (from before the rule) takes over silently', async () => {
    const { sessions } = setup();
    await sessions.start(7, { clientDeviceId: 'A' }, false);
    await sessions.start(7, {}, false);
});

test('the guard: Lite token on a replaced session → 401; other plans and old tokens pass', async () => {
    const { sessions } = setup();
    const old = await sessions.start(7, { clientDeviceId: 'A' }, false);
    await sessions.start(7, { clientDeviceId: 'B' }, true);
    const guard = liteSessionGuard(sessions);
    const run = (user: Partial<UserInfo>) => new Promise<any>((resolve) => guard({ user } as any, {} as any, resolve));

    const replaced = await run({ tenantUserId: 7, planName: 'Lite', sid: old });
    assert.ok(replaced instanceof SessionReplacedError);
    assert.equal(await run({ tenantUserId: 7, planName: 'Basic', sid: old }), undefined, 'Basic is never limited');
    assert.equal(await run({ tenantUserId: 7, planName: 'Lite' }), undefined, 'a token from before the rule passes');
});

test('lastSeenAt moves on use, at most every 5 minutes', async () => {
    const { sessions, store, now } = setup();
    const sid = await sessions.start(7, { clientDeviceId: 'A' }, false);
    const start = store.rows.get(7)!.lastSeenAt!.getTime();
    now.t += 2 * 60_000;
    await sessions.assertCurrent(7, sid);
    assert.equal(store.rows.get(7)!.lastSeenAt!.getTime(), start);
    now.t += 4 * 60_000;
    await sessions.assertCurrent(7, sid);
    await new Promise((r) => setImmediate(r));
    assert.equal(store.rows.get(7)!.lastSeenAt!.getTime(), now.t);
});

test('the hub tells the old phone where the account went, then closes it with 4409', async () => {
    const user = (sid: string): UserInfo => ({ tenantUserId: 7, userId: 1, username: 'u', databaseName: 'db', tenantId: 5, role: 'user', planName: 'Lite', sid });
    const tokens: Record<string, { user: UserInfo }> = { old: { user: user('s1') }, now: { user: user('s2') } };
    const hub = new LiveNotificationHub((t) => tokens[t], Date.now, async () => [1]);
    const server = http.createServer();
    hub.attach(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const open = (token: string) => new Promise<WebSocket>((res) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${LIVE_NOTIFICATIONS_PATH}`, { headers: { token } });
        ws.once('open', () => res(ws));
    });
    try {
        const oldWs = await open('old');
        const newWs = await open('now');
        assert.equal(hub.hasSession(7, 's1'), true);
        const frame = new Promise<any>((r) => oldWs.once('message', (m) => r(JSON.parse(m.toString()))));
        const closed = new Promise<number>((r) => oldWs.once('close', (c) => r(c)));
        assert.equal(hub.endSessions(7, 's2', { deviceName: 'Redmi 13' }), 1);
        assert.deepEqual(await frame, { type: 'session_replaced', data: { deviceName: 'Redmi 13' } });
        assert.equal(await closed, CLOSE_SESSION_REPLACED);
        assert.equal(hub.hasSession(7, 's2'), true);
        newWs.close();
    } finally {
        hub.closeAll();
        await new Promise<void>((r) => server.close(() => r()));
    }
});
