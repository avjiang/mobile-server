/**
 * Smoke test: server-assigned procurement numbers under concurrency.
 *
 * Fires N purchase-order creates and N quotation creates AT THE SAME TIME against a
 * running LOCAL server (each request a separate HTTP call, so they race on separate
 * DB connections), then asserts that within each type every number is unique, has
 * the {PREFIX}-OUT{outlet}-{yyyyMMdd}-{seq} shape and that the sequences form one
 * contiguous run. Leaves the created test documents behind (use a scratch tenant).
 *
 * NEVER runs against anything but localhost (guard below).
 *
 *   BASE_URL=http://localhost:8093 SMOKE_USER=<user> SMOKE_PASSWORD=<password> \
 *   OUTLET_ID=1 SUPPLIER_ID=1 N=20 npx tsx src/script/smoke_document_number_concurrency.ts
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:8081";
const USERNAME = process.env.SMOKE_USER || "";
const PASSWORD = process.env.SMOKE_PASSWORD || "";
const OUTLET_ID = Number(process.env.OUTLET_ID || 1);
const SUPPLIER_ID = Number(process.env.SUPPLIER_ID || 1);
const N = Number(process.env.N || 20);

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
    console.error(`Refusing to run against ${BASE_URL} — local servers only.`);
    process.exit(1);
}

async function call(path: string, body: unknown, token?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Outlet-ID": String(OUTLET_ID),
            ...(token ? { token } : {}),
        },
        body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok || !json.success) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(json.error ?? json)}`);
    return json.data;
}

function check(label: string, numbers: string[], prefix: string): boolean {
    const re = new RegExp(`^${prefix}-OUT${OUTLET_ID}-(\\d{8})-(\\d{4,})$`);
    const bad = numbers.filter((n) => !re.test(n));
    const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    const seqs = numbers.map((n) => Number(n.split("-").pop())).sort((a, b) => a - b);
    const contiguous = seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1);
    const ok = numbers.length === N && bad.length === 0 && dupes.length === 0 && contiguous;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${numbers.length} created, ${new Set(numbers).size} unique, ` +
        `seq ${seqs[0]}..${seqs[seqs.length - 1]}${contiguous ? " contiguous" : " GAPPED"}` +
        (bad.length ? `, malformed: ${bad.join(", ")}` : "") + (dupes.length ? `, DUPLICATES: ${dupes.join(", ")}` : ""));
    return ok;
}

async function main() {
    const login = await call("/auth/login", { username: USERNAME, password: PASSWORD });
    const token: string = login.token;

    const po = (i: number) => ({
        utcOffsetMinutes: 420,
        purchaseOrders: [{
            purchaseOrderNumber: "CLIENT-SENT-IGNORED", // must be ignored by the server
            outletId: OUTLET_ID, supplierId: SUPPLIER_ID, subtotalAmount: 1000 + i, totalAmount: 1000 + i,
            remark: `smoke_document_number_concurrency #${i}`,
        }],
    });
    const qt = (i: number) => ({
        utcOffsetMinutes: 420,
        quotations: [{
            quotationNumber: "CLIENT-SENT-IGNORED",
            outletId: OUTLET_ID, supplierId: SUPPLIER_ID, subtotalAmount: 1000 + i, totalAmount: 1000 + i,
            status: "DRAFT", remark: `smoke_document_number_concurrency #${i}`,
        }],
    });

    const started = Date.now();
    const [pos, qts] = await Promise.all([
        Promise.all(Array.from({ length: N }, (_, i) => call("/purchaseOrder/create", po(i), token))),
        Promise.all(Array.from({ length: N }, (_, i) => call("/quotation/create", qt(i), token))),
    ]);
    console.log(`${2 * N} concurrent creates in ${Date.now() - started} ms`);

    const okPo = check("purchase orders", pos.map((d: any[]) => d[0].purchaseOrderNumber), "PO");
    const okQt = check("quotations", qts.map((d: any[]) => d[0].quotationNumber), "QT");
    process.exit(okPo && okQt ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
