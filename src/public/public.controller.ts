import express, { Request, Response, NextFunction } from "express";
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
  if (hits.size > 10_000) hits.clear(); // crude unbounded-growth guard
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQ_PER_WINDOW;
}

const getCatalogue = (req: Request, res: Response, next: NextFunction) => {
  const ip =
    (req.headers["cf-connecting-ip"] as string) || req.ip || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, message: "Too many requests" });
  }

  getPublicCatalogue(req.params.slug)
    .then((data) => {
      // Let Cloudflare cache the catalogue at the edge (cost model: see doc §7.3).
      res.set("Cache-Control", "public, max-age=60, s-maxage=120");
      sendResponse(res, data);
    })
    .catch(next);
};

// Server-rendered HTML page (what a buyer opens from the shared link).
const renderPage = (req: Request, res: Response) => {
  const ip = (req.headers["cf-connecting-ip"] as string) || req.ip || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).type("html").send(renderNotFoundPage());
  }
  getPublicCatalogue(req.params.slug)
    .then((catalogue) => {
      res.set("Cache-Control", "public, max-age=60, s-maxage=120");
      res.type("html").send(renderCataloguePage(catalogue));
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
