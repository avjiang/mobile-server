import express, { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { sendResponse } from "../api-helpers/network";
import { getPublicCatalogue, CataloguePausedError } from "./public.service";
import { renderCataloguePage, renderNotFoundPage, renderPausedPage } from "./catalogue-page";
import { renderQrInvalidPage, renderQrOrderPage } from "./qr-order-page";
import { getTenantPrisma } from "../db";
import { loadMenu, resolveShop, resolveToken, status as qrStatus, submit as qrSubmit, TOKEN_RE } from "../qr-order/qr-order.service";

/**
 * PUBLIC (tokenless) routes — MUST be mounted ABOVE authorizeMiddleware in index.ts.
 *
 * GET /public/catalogue/:slug
 *   Returns a tenant's public online catalogue (in-stock items + variants) with
 *   no login. Resolves slug → tenant in the global db. Read-only, field-whitelisted.
 *
 * Defense: (1) strict slug validation + catalogueEnabled gate in the service,
 * (2) Cache-Control so Cloudflare's edge absorbs repeat reads (App Service hit
 * ~once per window per tenant), (3) a lightweight in-memory per-IP limiter as
 * defense-in-depth — Cloudflare's edge is the primary rate-limit/WAF layer.
 */

const router = express.Router();

const WINDOW_MS = 60_000;
const MAX_REQ_PER_WINDOW = 60;
const hits = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Unbounded-growth guard: evict only entries whose window has already expired,
  // instead of clearing the whole map (a full clear would let an attacker reset
  // every IP's counter — including active abusers — by inflating the map size).
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (now > v.reset) hits.delete(k);
    }
  }
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQ_PER_WINDOW;
}

const getCatalogue = (req: Request, res: Response, next: NextFunction) => {
  // `req.ip` is trustworthy because `trust proxy` is pinned to Cloudflare ranges
  // (see index.ts): forwarded headers are only honoured for genuine CF traffic,
  // and a direct caller cannot forge its TCP source. Do NOT read CF-Connecting-IP
  // directly — that header is attacker-controllable on a direct origin hit.
  const ip = req.ip || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, message: "Too many requests" });
  }

  getPublicCatalogue(req.params.slug)
    .then((data) => {
      // Let Cloudflare cache the catalogue at the edge (cost model: see doc §7.3).
      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      sendResponse(res, data);
    })
    .catch((err) => {
      // Typed errors (NotFoundError etc.) are safe to surface. For anything else
      // (e.g. a Prisma init error whose message contains the DB host:port), strip
      // the raw message before it reaches the error middleware — this endpoint is
      // tokenless, so it must never leak infrastructure details.
      if (typeof err?.statusCode === "number") return next(err);
      next(new Error("Internal error"));
    });
};

// Server-rendered HTML page (what a buyer opens from the shared link).
const renderPage = (req: Request, res: Response) => {
  const ip = req.ip || "unknown"; // trustworthy via CF-pinned trust proxy (see index.ts)
  if (isRateLimited(ip)) {
    return res.status(429).type("html").send(renderNotFoundPage());
  }
  getPublicCatalogue(req.params.slug)
    .then((catalogue) => {
      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      // Per-response nonce authorises ONLY our one inline <script> (search +
      // category filtering). It is cached together with the HTML body, so the
      // CSP header and the <script nonce="…"> always match within a cache entry.
      // All dynamic content is HTML-escaped, so there is no injection point that
      // could borrow the nonce.
      const nonce = randomBytes(16).toString("base64");
      // Hardening headers for the public storefront page. Images come only from
      // images.bayaryuk.net; the only script is our nonce'd inline bundle.
      // frame-ancestors 'none' blocks clickjacking on the WhatsApp button.
      res.set({
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy":
          `default-src 'none'; img-src https://images.bayaryuk.net data:; font-src https://images.bayaryuk.net; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
      });
      res.type("html").send(renderCataloguePage(catalogue, nonce));
    })
    .catch((err) => {
      if (err instanceof CataloguePausedError) {
        return res.status(403).type("html").send(renderPausedPage(err.shopName));
      }
      // Any resolution failure (bad slug, disabled, missing) → friendly 404 HTML.
      const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
      res.status(status === 404 ? 404 : 500).type("html").send(renderNotFoundPage());
    });
};

router.get("/catalogue/:slug", getCatalogue); // JSON API
router.get("/c/:slug", renderPage); // HTML page

// ── F&B QR self-order (docs/modules/FNB.md P6) ─────────────────────────────
// The first public WRITE. Front door: <slug>.bayaryuk.net/q/<token> (the Worker
// maps it to /public/c/<slug>/q/<token>); side door: api.bayaryuk.net/public/
// order/<slug>/… for the free Workers period (QR_ORDER_API_BASE=side). Never
// cached; rate-limited per token first (a café's Wi-Fi shares one IP), with a
// generous per-IP ceiling.

const qrHits = new Map<string, { count: number; reset: number }>();
function qrLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  if (qrHits.size > 20_000) for (const [k, v] of qrHits) if (v.reset <= now) qrHits.delete(k);
  const e = qrHits.get(key);
  if (!e || e.reset <= now) {
    qrHits.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  e.count += 1;
  return e.count > max;
}

const noStore = (res: Response) => res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });

/** Where the page sends submit / status. */
function qrApiBase(req: Request, slug: string): string {
  const mode = (process.env.QR_ORDER_API_BASE || "front").toLowerCase();
  if (mode === "side") return `https://api.bayaryuk.net/public/order/${encodeURIComponent(slug)}`;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  // Behind the Worker the page lives at the shop's root; anywhere else (local,
  // the side door) the page keeps its own /public/... prefix.
  if (/\.bayaryuk\.net$/i.test(host) && !/^api\./i.test(host)) return "";
  return req.baseUrl + (req.path.startsWith("/order/") ? `/order/${encodeURIComponent(slug)}` : `/c/${encodeURIComponent(slug)}`);
}

const renderQrPage = (req: Request, res: Response) => {
  noStore(res);
  const ip = req.ip || "unknown";
  if (qrLimited(`page:${ip}`, 120)) return res.status(429).type("html").send(renderQrInvalidPage(null));
  const token = String(req.params.token || "");
  let shopName: string | null = null;
  resolveShop(req.params.slug)
    .then(async (shop) => {
      shopName = shop.name;
      const prisma = getTenantPrisma(shop.databaseName);
      const ctx = await resolveToken(prisma, token);
      if (!ctx) return res.status(404).type("html").send(renderQrInvalidPage(shop.name));
      const menu = await loadMenu(prisma, ctx.outletId);
      const nonce = randomBytes(16).toString("base64");
      res.set({
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          `default-src 'none'; img-src https://images.bayaryuk.net data:; font-src https://images.bayaryuk.net; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self' https://api.bayaryuk.net; frame-ancestors 'none'`,
      });
      res.type("html").send(renderQrOrderPage({
        shop, token, kind: ctx.kind, tableName: ctx.tableName ?? null, menu, apiBase: qrApiBase(req, shop.slug),
      }, nonce));
    })
    .catch(() => res.status(404).type("html").send(renderQrInvalidPage(shopName)));
};

const submitQrOrder = (req: Request, res: Response, next: NextFunction) => {
  noStore(res);
  const ip = req.ip || "unknown";
  const token = String(req.body?.token || "");
  // Never key the limiter on arbitrary input.
  if (!TOKEN_RE.test(token)) return res.status(404).json({ success: false, error: { errorMessage: "QR tidak berlaku" } });
  if (qrLimited(`submit:${token}`, 6) || qrLimited(`submit-ip:${ip}`, 40)) {
    return res.status(429).json({ success: false, error: { errorMessage: "Terlalu banyak pesanan — tunggu sebentar" } });
  }
  resolveShop(req.params.slug)
    .then((shop) => qrSubmit(shop, token, req.body))
    .then((r) => sendResponse(res, r))
    .catch((err) => (typeof err?.statusCode === "number" ? next(err) : next(new Error("Internal error"))));
};

const qrOrderStatus = (req: Request, res: Response, next: NextFunction) => {
  noStore(res);
  if (qrLimited(`status:${req.ip || "unknown"}`, 240)) return res.status(429).json({ success: false });
  resolveShop(req.params.slug)
    .then((shop) => qrStatus(shop, String(req.params.orderRef || ""), req.query.round))
    .then((r) => sendResponse(res, r))
    .catch((err) => (typeof err?.statusCode === "number" ? next(err) : next(new Error("Internal error"))));
};

router.get("/c/:slug/q/:token", renderQrPage); // front door (via the Worker) + local
router.post("/c/:slug/order", submitQrOrder);
router.get("/c/:slug/order/:orderRef/status", qrOrderStatus);
router.get("/order/:slug/q/:token", renderQrPage); // side door
router.post("/order/:slug/order", submitQrOrder);
router.get("/order/:slug/order/:orderRef/status", qrOrderStatus);

export = router;
