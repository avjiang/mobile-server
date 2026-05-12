// Unit tests for the idempotency middleware. No real Prisma client, no real
// HTTP — pure logic verification with hand-rolled fakes.
//
// Run with:  npm test
// (or directly: npx tsx --test src/middleware/__tests__/*.test.ts)

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    createIdempotencyMiddleware,
    IdempotencyDb,
} from "../idempotency-middleware";
import { Prisma } from "../../../prisma/client/generated/client";

// ── Fakes ────────────────────────────────────────────────────────────────

interface FakeReqOpts {
    method?: string;
    headerKey?: string;
    body?: any;
    user?: { userId: number; databaseName: string } | null;
    baseUrl?: string;
    path?: string;
}

function fakeReq(opts: FakeReqOpts = {}): any {
    const headers: Record<string, string | undefined> = {};
    if (opts.headerKey !== undefined) {
        headers["x-idempotency-key"] = opts.headerKey;
    }
    return {
        method: opts.method ?? "POST",
        baseUrl: opts.baseUrl ?? "/customer",
        path: opts.path ?? "/create",
        body: opts.body,
        user:
            opts.user === undefined
                ? { userId: 1, databaseName: "tenant_test_db" }
                : opts.user,
        header: (name: string) => headers[name.toLowerCase()],
    };
}

interface CapturedResponse {
    status?: number;
    contentType?: string;
    sent?: string;
    jsonBody?: any;
}

function fakeRes(): { res: any; captured: CapturedResponse } {
    const captured: CapturedResponse = {};
    const res: any = {
        statusCode: 200,
        status(code: number) {
            captured.status = code;
            res.statusCode = code;
            return res;
        },
        type(t: string) {
            captured.contentType = t;
            return res;
        },
        send(body: string) {
            captured.sent = body;
            return res;
        },
        json(body: any) {
            captured.jsonBody = body;
            return res;
        },
    };
    return { res, captured };
}

function fakeNext(): {
    next: () => void;
    called: () => boolean;
    callCount: () => number;
} {
    let count = 0;
    return {
        next: () => {
            count += 1;
        },
        called: () => count > 0,
        callCount: () => count,
    };
}

type FindUniqueImpl = (...args: any[]) => Promise<any>;
type CreateImpl = (...args: any[]) => Promise<any>;

function fakeDb(opts: {
    findUnique?: FindUniqueImpl;
    create?: CreateImpl;
}): IdempotencyDb {
    return {
        idempotencyRecord: {
            findUnique: (opts.findUnique ?? (async () => null)) as any,
            create: (opts.create ?? (async (args: any) => args.data)) as any,
        },
    };
}

/** Wait for fire-and-forget microtasks to settle. */
const flushMicrotasks = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

// ── Tests ────────────────────────────────────────────────────────────────

describe("idempotency middleware", () => {
    test("GET request passes through without DB lookup", async () => {
        let lookupCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => {
                        lookupCalled = true;
                        return null;
                    },
                }),
        });
        const req = fakeReq({ method: "GET", headerKey: "any-key" });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1, "next must be called exactly once");
        assert.equal(lookupCalled, false, "GET must not hit the DB");
    });

    test("POST without authenticated user passes through (auth handles)", async () => {
        let lookupCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => {
                        lookupCalled = true;
                        return null;
                    },
                }),
        });
        const req = fakeReq({
            user: null,
            headerKey: "some-key",
        });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1);
        assert.equal(
            lookupCalled,
            false,
            "no DB lookup without a user (and thus no tenant)"
        );
    });

    test("POST without idempotency key passes through", async () => {
        let lookupCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => {
                        lookupCalled = true;
                        return null;
                    },
                }),
        });
        const req = fakeReq({ body: { foo: "bar" } });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1);
        assert.equal(lookupCalled, false);
    });

    test("key longer than 64 chars is rejected (defensive)", async () => {
        let lookupCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => {
                        lookupCalled = true;
                        return null;
                    },
                }),
        });
        const tooLong = "x".repeat(65);
        const req = fakeReq({ headerKey: tooLong });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1);
        assert.equal(lookupCalled, false);
    });

    test("existing record replays stored response (no route execution)", async () => {
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => ({
                        id: 7,
                        endpoint: "POST /customer/create",
                        key: "abc",
                        userId: 1,
                        responseStatus: 200,
                        responseBody: '{"id":42,"name":"Alice"}',
                        createdAt: new Date(),
                    }),
                }),
        });
        const req = fakeReq({ headerKey: "abc" });
        const { res, captured } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(
            n.callCount(),
            0,
            "next must NOT be called when a record is replayed"
        );
        assert.equal(captured.status, 200);
        assert.equal(captured.contentType, "application/json");
        assert.equal(captured.sent, '{"id":42,"name":"Alice"}');
    });

    test("body field is ignored — only header drives dedup", async () => {
        let lookupCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => {
                        lookupCalled = true;
                        return null;
                    },
                }),
        });
        const req = fakeReq({
            // Key only in body, not header. Must NOT trigger a lookup.
            body: { clientIdempotencyKey: "legacy-key", name: "Bob" },
        });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1);
        assert.equal(
            lookupCalled,
            false,
            "post-migration: body field must be ignored"
        );
    });

    test("new key: route runs then 2xx response is stored", async () => {
        let createCall: any = null;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => null,
                    create: async (args: any) => {
                        createCall = args;
                        return args.data;
                    },
                }),
        });
        const req = fakeReq({
            method: "POST",
            baseUrl: "/sales",
            path: "/create",
            headerKey: "fresh-key",
        });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(n.callCount(), 1, "route handler must run");
        // Simulate the route writing its response:
        res.statusCode = 200;
        res.json({ saleId: 99 });
        await flushMicrotasks();

        assert.ok(createCall, "create must be called after the route responds");
        assert.equal(
            createCall.data.endpoint,
            "POST /sales/create",
            "endpoint string is method + baseUrl + path"
        );
        assert.equal(createCall.data.key, "fresh-key");
        assert.equal(createCall.data.userId, 1);
        assert.equal(createCall.data.responseStatus, 200);
        assert.equal(createCall.data.responseBody, '{"saleId":99}');
    });

    test("5xx response is NOT stored (treated as transient)", async () => {
        let createCalled = false;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async () => null,
                    create: async () => {
                        createCalled = true;
                        return {};
                    },
                }),
        });
        const req = fakeReq({ headerKey: "transient-key" });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);
        // Route fails with 500:
        res.statusCode = 500;
        res.json({ error: "internal" });
        await flushMicrotasks();

        assert.equal(
            createCalled,
            false,
            "5xx must NOT be cached — client's retry should get a fresh attempt"
        );
    });

    test("P2002 unique-violation on concurrent insert is swallowed", async () => {
        const p2002 = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
                code: "P2002",
                clientVersion: "test",
                meta: { target: ["endpoint", "key"] },
            }
        );
        const originalError = console.error;
        let errorLogged = false;
        console.error = () => {
            errorLogged = true;
        };
        try {
            const mw = createIdempotencyMiddleware({
                prismaFactory: () =>
                    fakeDb({
                        findUnique: async () => null,
                        create: async () => {
                            throw p2002;
                        },
                    }),
            });
            const req = fakeReq({ headerKey: "race-key" });
            const { res } = fakeRes();
            const n = fakeNext();

            await mw(req, res, n.next);
            res.statusCode = 200;
            res.json({ ok: true });
            // Let the fire-and-forget catch handler run.
            await flushMicrotasks();
            await flushMicrotasks();

            assert.equal(
                errorLogged,
                false,
                "P2002 is the expected race — must not be logged as an error"
            );
        } finally {
            console.error = originalError;
        }
    });

    test("lookup failure passes through to next (DB hiccup is non-fatal)", async () => {
        // Silence the expected error log so test output is clean.
        const originalError = console.error;
        console.error = () => {};
        try {
            const mw = createIdempotencyMiddleware({
                prismaFactory: () =>
                    fakeDb({
                        findUnique: async () => {
                            throw new Error("DB unreachable");
                        },
                    }),
            });
            const req = fakeReq({ headerKey: "any-key" });
            const { res } = fakeRes();
            const n = fakeNext();

            await mw(req, res, n.next);

            assert.equal(
                n.callCount(),
                1,
                "request must proceed even if dedup lookup throws"
            );
        } finally {
            console.error = originalError;
        }
    });

    test("endpoint string composes method + baseUrl + path", async () => {
        let captured: any = null;
        const mw = createIdempotencyMiddleware({
            prismaFactory: () =>
                fakeDb({
                    findUnique: async (args: any) => {
                        captured = args;
                        return null;
                    },
                }),
        });
        const req = fakeReq({
            method: "PUT",
            baseUrl: "/sales",
            path: "/void/42",
            headerKey: "k",
        });
        const { res } = fakeRes();
        const n = fakeNext();

        await mw(req, res, n.next);

        assert.equal(
            captured.where.endpoint_key.endpoint,
            "PUT /sales/void/42"
        );
        assert.equal(captured.where.endpoint_key.key, "k");
    });
});
