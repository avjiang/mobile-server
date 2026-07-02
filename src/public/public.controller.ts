import express, { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { sendResponse } from "../api-helpers/network";
import { getPublicCatalogue } from "./public.service";
import { renderCataloguePage, renderNotFoundPage } from "./catalogue-page";

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
      // Any resolution failure (bad slug, disabled, missing) → friendly 404 HTML.
      const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
      res.status(status === 404 ? 404 : 500).type("html").send(renderNotFoundPage());
    });
};

router.get("/catalogue/:slug", getCatalogue); // JSON API
router.get("/c/:slug", renderPage); // HTML page

export = router;
