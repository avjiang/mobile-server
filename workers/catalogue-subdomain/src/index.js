/**
 * Cloudflare Worker — public online-catalogue subdomain router.
 *
 * Maps  <slug>.bayaryuk.net/<path>  →  <azure-origin>/public/c/<slug><path>
 * via a transparent reverse proxy (the browser keeps the pretty subdomain URL).
 *
 * Why a Worker (not an Azure custom domain): App Service is B1 Basic and Azure's
 * free managed cert doesn't do wildcards → custom-domain binding risks a paid
 * tier/cert bump. The Worker is $0 (100k req/day free) and Cloudflare's Universal
 * SSL already covers *.bayaryuk.net. See docs/future/ONLINE_CATALOGUE.md §7.4.
 *
 * Scope: only *.bayaryuk.net page views hit this Worker. The POS app/API
 * (…azurewebsites.net) never touches it. images.bayaryuk.net (R2) is excluded
 * both by RESERVED below and by a more-specific "no worker" route (see README).
 */

// Azure App Service origin that serves GET /public/c/:slug (server-rendered HTML).
const ORIGIN =
  "https://bayaryuk-c2c8d5acg8chaqfm.southeastasia-01.azurewebsites.net";

// Subdomains that must NEVER be treated as a tenant slug — passed straight
// through to their normal origin. Keep in sync with the backend reserved-slug
// blocklist (catalogue-config.service.ts RESERVED_SLUGS).
const RESERVED = new Set([
  "images", // R2 public image domain
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const sub = url.hostname.split(".")[0].toLowerCase();

    // Reserved / apex / non-slug hosts: do not hijack — let them reach their
    // own origin (or 404 naturally). Never proxy these to /public/c/.
    if (!sub || RESERVED.has(sub)) {
      return fetch(request);
    }

    // Reverse-proxy to the public catalogue page for this slug, preserving the
    // path and query (so /public/c/<slug>?x=1 etc. still work).
    const target = `${ORIGIN}/public/c/${encodeURIComponent(sub)}${url.pathname === "/" ? "" : url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    // CRITICAL: drop the inbound Host (<slug>.bayaryuk.net) so fetch() sets
    // Host=<azure-origin>; otherwise Azure App Service 404s the request.
    headers.delete("host");

    const originResponse = await fetch(
      new Request(target, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        redirect: "manual",
      }),
      // Cache the rendered HTML at Cloudflare's edge so a reshared link does NOT
      // hit Azure + MySQL on every view. Cloudflare does not cache HTML by
      // default; cacheEverything overrides that. TTL 300s keeps merchant edits
      // visible reasonably quickly while collapsing a viral burst to ~1 origin
      // hit per 5 min per edge location. Pages are identical for all visitors
      // (tokenless, no cookies), so edge caching is safe. Only GET/HEAD are ever
      // cached. Keep in sync with the origin s-maxage in public.controller.ts.
      { cf: { cacheEverything: true, cacheTtl: 300 } },
    );

    // Pass the origin response straight back (status, headers, body). The public
    // page already renders its own 404 for unknown slugs.
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: originResponse.headers,
    });
  },
};
