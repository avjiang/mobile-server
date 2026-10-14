import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import jwt, { MyJwtPayload } from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { jwt_token_secret } from '../../config.json';
import type { UserInfo } from '../middleware/authorize-middleware';

/**
 * Live notifications over a WebSocket, for clients FCM can't reach (the Windows
 * app). Every topic push (`PushyService.sendToTopic`) is also published here,
 * with the same flat payload FCM carries, so the app handles both identically.
 *
 *   GET /live/notifications   (Upgrade: websocket, header `token: <JWT>`)
 *   client → { "type": "subscribe", "topics": ["tenant_5_outlet_1_sales", …], "since": 1760400000000 }
 *   server → { "type": "notification", "topic": "…", "at": 1760400123456, "data": { title, message, … } }
 *            (+ "replay": true on frames sent because of `since`)
 *
 * Authorization: a socket only ever receives topics that are BOTH requested by
 * the client and listed in its signed JWT (`notificationTopics`, Pro only), so a
 * client can't listen to another tenant or to a permission it doesn't hold.
 * Topics added after login arrive with the next token (≤ 1 day).
 *
 * One process (systemd on the Oracle VM, no cluster), so the registry is in
 * memory. Cloudflare Tunnel passes WebSockets through; a 30 s ping keeps the
 * socket under its ~100 s idle cut and drops dead peers. A deploy restarts the
 * process and the app reconnects with backoff.
 *
 * Catch-up: a closed app misses pushes (phones don't — FCM holds them). The hub
 * keeps the last [REPLAY_WINDOW_MS] of every topic in memory (≤ [REPLAY_PER_TOPIC]
 * each); a subscribe carrying `since` (the newest `at` the app has seen, server
 * clock) gets every later one first, marked `replay`. Nothing is persisted, so a
 * restart (deploy) forgets the window.
 */

export const LIVE_NOTIFICATIONS_PATH = '/live/notifications';

/** Close codes the app acts on (see FE `LiveNotificationSocket`). */
export const CLOSE_TOKEN_EXPIRED = 4001;
export const CLOSE_SERVER_RESTART = 1012;

const PING_INTERVAL_MS = 30_000;
const MAX_TOPICS = 200;
export const REPLAY_WINDOW_MS = 48 * 60 * 60 * 1000;
export const REPLAY_PER_TOPIC = 100;
const MAX_REPLAY_FRAMES = 200;

interface RecentPush {
    at: number;
    payload: Record<string, unknown>;
}

interface LiveClient {
    socket: WebSocket;
    user: UserInfo;
    /** Topics the JWT allows — the ceiling for subscriptions. */
    allowed: Set<string>;
    subscribed: Set<string>;
    alive: boolean;
    expiryTimer?: NodeJS.Timeout;
}

type VerifyToken = (token: string) => { user: UserInfo; exp?: number };

const defaultVerify: VerifyToken = (token) => {
    const payload = jwt.verify(token, jwt_token_secret) as MyJwtPayload;
    return { user: payload.user, exp: payload.exp };
};

export class LiveNotificationHub {
    private wss?: WebSocketServer;
    private readonly clients = new Set<LiveClient>();
    /** topic → its pushes of the last [REPLAY_WINDOW_MS], oldest first. */
    private readonly recent = new Map<string, RecentPush[]>();
    private lastAt = 0;
    private pingTimer?: NodeJS.Timeout;

    constructor(
        private readonly verify: VerifyToken = defaultVerify,
        private readonly now: () => number = Date.now,
    ) {}

    /** Accept upgrades on [LIVE_NOTIFICATIONS_PATH]; other upgrade paths are refused. */
    attach(server: Server): void {
        if (this.wss) return;
        this.wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
        server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
        this.pingTimer = setInterval(() => this.pingAll(), PING_INTERVAL_MS);
        this.pingTimer.unref();
    }

    /** Sends [payload] to every socket subscribed to [topic]. Returns how many. */
    publish(topic: string, payload: Record<string, unknown>): number {
        // Strictly increasing, so `since` never skips a push sent in the same millisecond.
        const at = Math.max(this.now(), this.lastAt + 1);
        this.lastAt = at;
        this.remember(topic, { at, payload });

        if (this.clients.size === 0) return 0;
        const frame = JSON.stringify({ type: 'notification', topic, at, data: payload });
        let sent = 0;
        for (const client of this.clients) {
            if (client.subscribed.has(topic) && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(frame);
                sent++;
            }
        }
        return sent;
    }

    /** Graceful shutdown: tell clients to come back, then stop accepting. */
    closeAll(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        for (const client of this.clients) client.socket.close(CLOSE_SERVER_RESTART, 'server restart');
        this.clients.clear();
        this.wss?.close();
        this.wss = undefined;
    }

    get connectionCount(): number {
        return this.clients.size;
    }

    private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
        const path = (req.url ?? '').split('?')[0];
        if (path !== LIVE_NOTIFICATIONS_PATH || !this.wss) {
            socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }
        const header = req.headers['token'];
        const token = Array.isArray(header) ? header[0] : header;
        let verified: { user: UserInfo; exp?: number };
        try {
            if (!token) throw new Error('missing token');
            verified = this.verify(token);
            if (!verified?.user?.tenantId) throw new Error('token has no tenant');
        } catch {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, verified));
    }

    private onConnection(socket: WebSocket, verified: { user: UserInfo; exp?: number }): void {
        const client: LiveClient = {
            socket,
            user: verified.user,
            allowed: new Set(verified.user.notificationTopics ?? []),
            subscribed: new Set(),
            alive: true,
        };
        this.clients.add(client);

        // The token runs out while the socket is open: close so the app refreshes it.
        if (verified.exp) {
            const ms = verified.exp * 1000 - Date.now();
            client.expiryTimer = setTimeout(() => socket.close(CLOSE_TOKEN_EXPIRED, 'token expired'), Math.max(0, ms));
            client.expiryTimer.unref();
        }

        socket.on('pong', () => { client.alive = true; });
        socket.on('message', (raw) => this.onMessage(client, raw.toString()));
        socket.on('close', () => this.remove(client));
        socket.on('error', () => this.remove(client));
    }

    private onMessage(client: LiveClient, raw: string): void {
        let message: any;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }
        if (message?.type !== 'subscribe' || !Array.isArray(message.topics)) return;
        client.subscribed = new Set(
            message.topics
                .slice(0, MAX_TOPICS)
                .filter((t: unknown): t is string => typeof t === 'string' && client.allowed.has(t)),
        );
        if (typeof message.since === 'number' && Number.isFinite(message.since)) {
            this.replay(client, message.since);
        }
    }

    /** Sends [client] what its topics got after [since] (server ms), oldest first. */
    private replay(client: LiveClient, since: number): void {
        const cutoff = this.now() - REPLAY_WINDOW_MS;
        const missed: Array<RecentPush & { topic: string }> = [];
        for (const topic of client.subscribed) {
            for (const push of this.recent.get(topic) ?? []) {
                if (push.at > since && push.at >= cutoff) missed.push({ topic, ...push });
            }
        }
        missed.sort((a, b) => a.at - b.at);
        for (const push of missed.slice(-MAX_REPLAY_FRAMES)) {
            if (client.socket.readyState !== WebSocket.OPEN) return;
            client.socket.send(JSON.stringify({
                type: 'notification', topic: push.topic, at: push.at, replay: true, data: push.payload,
            }));
        }
    }

    private remember(topic: string, push: RecentPush): void {
        const list = this.recent.get(topic) ?? [];
        list.push(push);
        const cutoff = push.at - REPLAY_WINDOW_MS;
        while (list.length > REPLAY_PER_TOPIC || (list.length > 0 && list[0].at < cutoff)) list.shift();
        this.recent.set(topic, list);
    }

    /** Drops topics whose newest push left the window (a topic only shrinks when it is published to). */
    private pruneRecent(): void {
        const cutoff = this.now() - REPLAY_WINDOW_MS;
        for (const [topic, list] of this.recent) {
            if (list.length === 0 || list[list.length - 1].at < cutoff) this.recent.delete(topic);
        }
    }

    private pingAll(): void {
        this.pruneRecent();
        for (const client of this.clients) {
            if (!client.alive) {
                client.socket.terminate();
                this.remove(client);
                continue;
            }
            client.alive = false;
            client.socket.ping();
        }
    }

    private remove(client: LiveClient): void {
        if (client.expiryTimer) clearTimeout(client.expiryTimer);
        this.clients.delete(client);
    }
}

/** The process-wide hub: attached in `index.ts`, published to by `PushyService`. */
export const liveNotifications = new LiveNotificationHub();
