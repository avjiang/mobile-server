# Catalogue Subdomain Worker — deploy runbook

Routes `https://<slug>.bayaryuk.net` → `<azure-origin>/public/c/<slug>` so each Pro
tenant gets a pretty public storefront URL. Pure stateless reverse proxy. $0 on the
Cloudflare Workers free tier (100k req/day).

Design rationale + decision record: [`docs/future/ONLINE_CATALOGUE.md` §7.4](../../../bayaryuk-frontend/docs/future/ONLINE_CATALOGUE.md) (frontend repo).

---

## 0. Prerequisites (all must be true before deploying)

- [x] **Catalogue backend deployed to prod** — `GET /public/c/:slug` serves on Azure. (Verified: prod `/health` 200, routes deployed.)
- [x] **Prod global migration applied** — `tenant.slug` / `whatsapp_number` / `catalogue_enabled` exist. (Verified 2026-06-10.)
- [ ] **A WRITE-scoped Cloudflare API token.** The `CLOUDFLARE_API_TOKEN` in `flutter-server/.env` is **read-only** — it can verify/inspect but cannot create DNS records, routes, or Workers. Create a new token (My Profile → API Tokens → Create) with these scopes on the `bayaryuk.net` zone / account:
  - **Account › Workers Scripts › Edit**
  - **Zone › Workers Routes › Edit**
  - **Zone › DNS › Edit**
  - **Zone › SSL and Certificates › Edit** (only if changing TLS mode)
  - Then `export CLOUDFLARE_API_TOKEN=<write-token>` for the wrangler/API steps below. **Do not** persist the write token in `.env` — paste it for the deploy session only, then discard.

Identifiers (not secrets): Account `b03f922eee319a31993cf0a3626a00d8`, Zone `bayaryuk.net` = `3587c2959e3ea7d0e6d51be004d43138`, Azure origin `bayaryuk-c2c8d5acg8chaqfm.southeastasia-01.azurewebsites.net`.

---

## 1. Wildcard DNS — `*.bayaryuk.net` → Azure (proxied)

The record just lets Cloudflare terminate TLS for the hostname; the Worker overrides the actual origin mapping.

**API (write token):**
```bash
ZONE=3587c2959e3ea7d0e6d51be004d43138
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"*","content":"bayaryuk-c2c8d5acg8chaqfm.southeastasia-01.azurewebsites.net","proxied":true}'
```
**Dashboard alternative:** DNS → Add record → CNAME, Name `*`, Target = Azure origin, **Proxied (orange)**.

> Wildcard covers one level only (`shop1.bayaryuk.net` ✅, `a.b.bayaryuk.net` ❌) — fine, one subdomain per tenant. Apex `bayaryuk.net` / `www` are NOT covered by `*` — add separate records only if you want a landing page.

## 2. TLS mode = Full

SSL/TLS → Overview → **Full** (not Strict; Azure presents its own `*.azurewebsites.net` cert). Universal SSL already covers `*.bayaryuk.net`, so no Azure cert is needed. Usually already Full — verify only.

## 3. Deploy the Worker (adds the `*.bayaryuk.net/*` route)

```bash
cd workers/catalogue-subdomain
npx wrangler deploy            # uses wrangler.toml: name, main, route
```
This uploads `src/index.js` and binds route `*.bayaryuk.net/*` on zone `bayaryuk.net` in one step. (First run will `npx` wrangler + prompt OAuth if `CLOUDFLARE_API_TOKEN` isn't exported — prefer the token.)

**Dashboard alternative:** Workers & Pages → Create → paste `src/index.js` → Deploy → Triggers → Add route `*.bayaryuk.net/*`.

## 4. Exclude `images.bayaryuk.net` from the Worker (quota)

Image loads are the bulk of requests; don't let them invoke the Worker. Add a **more-specific route with NO worker** (more-specific wins). This can't live in `wrangler.toml`:

```bash
ZONE=3587c2959e3ea7d0e6d51be004d43138
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"pattern":"images.bayaryuk.net/*"}'   # omit "script" => no worker on this route
```
**Dashboard alternative:** Workers Routes → Add route `images.bayaryuk.net/*` → Worker = *None*.

(The `RESERVED` set in the script is a correctness safety net for the same; this route is the quota optimization.)

## 5. Verify

```bash
# Pick a real Pro tenant that has a slug + catalogue_enabled=1 first.
curl -sI https://<slug>.bayaryuk.net | head -5          # expect 200 + text/html
curl -s  https://<slug>.bayaryuk.net | grep -o '<title>[^<]*'   # storefront title
curl -sI https://images.bayaryuk.net/<tenantId>/items/<id>.webp | head -3  # images still 200, not via worker
```
Browser check: open `https://<slug>.bayaryuk.net` — cards render, images load from `images.bayaryuk.net`, WhatsApp buttons work. Unknown slug → the origin's 404 page.

---

## Rollback

- **Fastest:** Cloudflare → Workers Routes → delete/disable `*.bayaryuk.net/*`. Catalogue subdomains stop resolving; **the POS app/API is unaffected** (never touched the Worker).
- Or `npx wrangler delete` to remove the Worker entirely.
- The wildcard DNS record can stay; with no Worker route it just points at Azure (which 404s bare subdomains) — harmless.

## Notes / catches

- **Blast radius:** a Worker bug breaks only catalogue page views. POS app, API, and image loads are isolated.
- **Quota:** ~1 Worker request per page view (images excluded) — far under 100k/day for SMB traffic.
- **Latency:** ~1–5 ms at the edge.
- **Origin secret:** `ORIGIN` is the Azure hostname (public, not a secret). No bindings/KV/secrets needed.
