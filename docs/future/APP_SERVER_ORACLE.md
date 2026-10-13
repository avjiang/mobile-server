# App server → Oracle Always Free VM (plan, 2026-09-27)

Move the **Node backend only** off Azure App Service B1 ($13.14/mo) onto an Oracle Cloud Always Free
Ampere A1 VM. **The database stays on Azure** (`bayaryuk-db-v2`, free until ~2026-09-26 + 12 months).

## Status

> ✅ **CUTOVER DONE 2026-10-13 ~21:50 MYT.** The VM runs `95f7834` and serves `api.bayaryuk.net` through tunnel
> `bayaryuk-oracle`; crons run on the VM; App Service stays up with `DISABLE_CRONS=true` for the old app's forced
> update and as the rollback. Open: cutover checklist steps 7–9 below. The table and notes underneath are the
> build-up history (the "standby" wording there is no longer current).

| Step | State |
|---|---|
| Oracle account (`alvinn.jiang@gmail.com`, tenancy `avjiang`, home region **`ap-singapore-2` Singapore West**) | ✅ created 2026-09-27 |
| OCI CLI on the Mac (`brew install oci-cli`, `oci setup bootstrap`, profile DEFAULT) | ✅ |
| Pay-as-you-go upgrade | ✅ **`PAYG` / `UPGRADED` at 2026-10-01 14:18 UTC** (plan `OCS-10204310`). Check with `oci osp-gateway subscription-service subscription list -c <tenancy> --osp-home-region ap-singapore-2` (`plan-type`, `upgrade-state`); the compute limits look the same on either plan. Paid usage is now possible → the `bayaryuk-any-spend` alert is the guard. Audit 2026-10-02: 1 instance (A1 1/6), 50 GB boot volume, no block volumes, no reserved IPs, spend $0.00 / forecast $0.00 |
| Budget alert `bayaryuk-any-spend` ($1/mo; ACTUAL ≥1% + FORECAST ≥100% → `alvinn.jiang@gmail.com`) | ✅ |
| Compartment `bayaryuk` + VCN `bayaryuk-vcn` (10.0.0.0/16) + IGW + route table + subnet `bayaryuk-public` (10.0.1.0/24) + security list `bayaryuk-sl` | ✅ |
| SSH key `~/.ssh/bayaryuk_oci` (ed25519, Mac-local) | ✅ |
| **VM `bayaryuk-app`** | ✅ **launched 2026-10-01 22:13** (4th attempt that evening; 164 "Out of host capacity" failures on 2026-09-27) — **1 OCPU / 6 GB** A1, Ubuntu 24.04, public IP `140.245.56.85`, private `10.0.1.111`. SSH: `bayaryuk-sl` allows port 22 from `161.142.138.37/32` + `60.54.81.81/32` + `161.142.156.6/32` (added 2026-10-12 for the perf test; keep) (a temporary `161.142.171.233/32` was added and removed again on 2026-10-12) (add the Mac's IP again whenever it changes) |
| `setup_vm.sh` | ✅ run 2026-10-02 — Node v22.23.3, cloudflared 2026.9.3, UTC, keys-only SSH, `bayaryuk.service` enabled (not started) |
| `/etc/bayaryuk/env` | ✅ 2026-10-02 — the 8 App Service settings (copied Azure → VM over SSH, never printed) + `DISABLE_CRONS=true` + `HOST=127.0.0.1` |
| Azure MySQL firewall rule `oracle-vm` (`140.245.56.85`) on `bayaryuk-db-v2` | ✅ 2026-10-02 |
| **Backend running on the VM** | ✅ 2026-10-02 release `20261002031312-83d63b8` — `bayaryuk.service` active, bound to `127.0.0.1:8080` (unreachable from outside: iptables allows only SSH), log confirms `DISABLE_CRONS=true`. `/health` ok; a login probe reads the prod global DB in **~10 ms** warm (119 ms first call); node RSS 114 MB; disk 13% |
| Code to run | Prod (`main`) has **no `DISABLE_CRONS`** → a second host on the prod DB would run the nightly jobs twice. Until sprint-008 is on `main`, deploy local branch **`oracle/standby-main`** (`cf67c45` + only the `index.ts` `DISABLE_CRONS`/`HOST`/loopback hunks + `deploy.sh`; head `eda10b7`; not pushed, not for merge; worktree was in a session scratchpad, so recreate it the same way if gone). After sprint-008 is on `main`, deploy `main` and delete this branch |
| Scripts: `deploy/oracle/setup_vm.sh` (one-time VM setup), `deploy/oracle/deploy.sh` (build on VM, health-checked switch, auto-rollback) | ✅ written 2026-09-28, not yet run (no VM) |
| `trust proxy` + `'loopback'` (`src/index.ts`) | ✅ code, not deployed |
| `api.bayaryuk.net` → App Service (DNS-only CNAME + `TXT asuid.api`, custom domain, managed cert GeoTrust exp 2027-03-28) | ✅ 2026-09-28, verified live |
| FE `_releaseBaseURL = "api.bayaryuk.net"` | ✅ code 2026-09-28 — ships with the next APK (SPRINT_008) |
| **Perf test 2026-10-12** (reads only, `web_bytes` on the prod DB, VM via SSH tunnel vs Azure over HTTPS, both measured from the Mac) | ✅ **VM faster everywhere, no errors.** App launch on a headless emulator (FE `main` profile build through a timing proxy): fresh login + first sync network time **4.5 s vs 10–13 s**, warm relaunch **3.8 s vs 8–12 s**; login **0.55 s vs 2.7 s**, refresh-token **0.37 s vs 2.4 s** (CPU-bound → the A1 core is ~5× the B1). Simple DB reads one at a time are a tie (~same p50, same DB), but 6 parallel reads: **120 ms vs 346 ms** p50, and Azure tails hit 0.6–7 s plus one HTTP 500 (counted in Azure's own `Http5xx`). VM peak during the test: node ~166 MB RSS, ≤80 % of 1 OCPU. Not yet measured: real load, a checkout write |
| **Perf test 2026-10-12 #2 — through Cloudflare** (quick tunnel `*.trycloudflare.com` from `cloudflared` on the VM, stopped afterwards; client in Malaysia enters at Cloudflare `KUL`, tunnel at `sin12`) | ✅ **VM still faster than Azure, but most of the lead goes.** App (same emulator method): fresh login + first sync **9.6 s vs Azure 11.2 s** (VM via SSH 4.6 s), warm relaunch **6.6–7.6 s vs 9.0 s** (SSH 4.0 s); login in the app ~1.0 s vs 2.3–3.6 s. API: login 0.45 s vs 1.9 s, 6 parallel reads 193 ms vs 418 ms, sequential reads ≈ Azure. **Cause of the loss:** through the quick tunnel the first request to a URL Cloudflare hasn't seen recently costs **~+190 ms** (`cf-cache-status: DYNAMIC`, 255–265 ms vs ~70 ms on repeat), and the app's delta-sync URLs carry a fresh `lastSyncTimestamp` every launch, run one after another → ~2–2.5 s per launch. **Before the move:** set up the named tunnel on our own hostname with a Cloudflare **Cache Rule "Bypass cache"** for it, then re-measure first-seen URLs (`curl …/health?x=$RANDOM`, twice) — if the ~190 ms is gone, expect close to the SSH numbers. Independent of hosting: FE creates a new `http.Client` per `API()` (43 call sites, still so on sprint-008), so every repository's first call opens a new TCP+TLS connection — a shared client would save a handshake per call on mobile networks |
| **Named tunnel `bayaryuk-oracle`** (id `09c2860b-518f-4313-9654-e8f6e52d4859`, remote-managed) | ✅ 2026-10-12 — ingress **`oracle-test.bayaryuk.net` → `http://127.0.0.1:8080`** (catch-all 404), proxied CNAME `oracle-test` → `<id>.cfargotunnel.com`, **no-Worker route `oracle-test.bayaryuk.net/*`** (keeps `catalogue-subdomain` off it), `cloudflared` systemd service on the VM (enabled; 4 connections to SIN colos). Created with `CLOUDFLARE_TEMP_TOKEN` (`flutter-server/.env`: Tunnel + DNS + Workers Routes edit; no cache-rule/bot read). Left running as the cutover host — $0. Remove: delete the DNS record + route + tunnel, `sudo cloudflared service uninstall` |
| **Perf test 2026-10-12 #3 — the production path** (real app, HTTPS, named tunnel; same app build with only the host changed, timed by the app itself on a headless emulator; client in Malaysia) | ✅ **VM ~2× faster than Azure, no errors.** Warm relaunch network time **4.2–4.5 s vs 8.6–16.6 s**; fresh login + first sync **5.0 s vs 10.1–12.9 s** (one Oracle outlier 15.4 s: two calls ~4.5 s, unexplained, 1 of 9 runs); launch→last response **~9.5 s vs 14–22 s**. The quick-tunnel first-URL penalty (#2) **does not exist on the named tunnel** (first-seen URL 60–75 ms = repeat) → no cache rule needed. Load, 5/10/20 simulated cashiers (reads, ~1 req/s each): **Oracle p50 41–44 ms, p95 ≤ 97 ms at every step; Azure p95 137 → 199 → 1,478 ms and only 8.9 of ~18 req/s served at 20**; 20 simultaneous logins 2.9 s vs 13.5 s. VM at 20 cashiers: CPU p90 40 % (peak 91 % during the login burst), node 197 MB. One test sale via Oracle (`web_bytes`, Coke Rp 2,000, cash) saved in **294 ms**; the Azure sale was not run (blocked as a prod write) |
| APK adoption → VM live → tunnel → DNS flip → App Service plan to F1/deleted | not started — ordered checklist in **§ Cutover checklist** |

**Everything created so far is free** (verified with a tenancy-wide `structured-search`): networking,
compartment, budget, private DNS zones, and the IAM defaults created at sign-up. Nothing else exists.

## Why only the app server, and why this order

- The whole saving is the App Service bill (~Rp 215k/mo). With one paying tenant that is a large share of
  revenue; it shrinks to ~1% per tenant at 50 tenants, while outage risk grows. Take the saving now.
- The app server is **stateless**: if Oracle reclaims the VM or terminates the account, flip DNS back to
  App Service within the hour. The DB is the part where a free-account termination would lose data, so it
  stays managed on Azure.
- A bigger VM does **not** raise the first capacity ceilings — those are MySQL connections and IOPS
  (see `SCALING_PLAN.md`, FE memory `reference_infra_capacity.md`). Node runs one process on one core.

## Next steps

1. **Confirm PAYG** in the console (☰ → Billing & Cost Management → Upgrade and Manage Payment). PAYG
   is the usual fix for A1 capacity and removes idle-instance reclamation.
2. **Launch the VM**: `deploy/oracle/launch_vm_retry.sh` (run in the background; stops at first success,
   never creates a second VM). Shapes tried: 2 OCPU/12 GB, then 1 OCPU/6 GB — both Always Free; the app
   uses ~165 MB. **Never exceed 2 OCPU / 12 GB total** — Oracle halved the Always Free A1 allowance on
   2026-06-15 and disables over-limit free instances.
3. **Server setup** (Ubuntu 24.04 aarch64): `deploy/oracle/setup_vm.sh` — unattended-upgrades (auto-reboot
   03:30 UTC), fail2ban, SSH key only, 2 GB swap, Node 22, cloudflared, `bayaryuk` systemd service,
   **clock stays UTC**. Oracle's image already firewalls everything but SSH (kept as-is). Then
   `deploy/oracle/deploy.sh <VM_IP>`.
4. **HTTPS via Cloudflare Tunnel** (`cloudflared`) — no inbound web port at all. Needs a short-lived
   Cloudflare token with Tunnel + DNS edit.
5. **Azure MySQL firewall**: add the VM's public IP on `bayaryuk-db-v2` (sub `3bbc4892-…`).
6. **`api.bayaryuk.net`**: first point it at App Service (DNS-only/grey cloud + App Service custom domain +
   free managed certificate), ship an FE release with `_releaseBaseURL = api.bayaryuk.net`, wait for
   adoption. Only then flip the record to the tunnel. Without this, installed apps keep calling
   `…azurewebsites.net`.
7. **Deploy pipeline** for the VM (manual trigger first); keep App Service until traffic has moved.

## Gotchas found while preparing (must handle before cutover)

- **CI deletes the Arm Prisma engine.** `main_bayaryuk.yml` removes `libquery_engine-linux-arm64*`. The
  VM is Arm, so a VM deploy must keep it (both schemas already list `linux-arm64-openssl-3.0.x`).
- **Crons follow the server clock.** `cron-manager.ts` schedules 02:00 / 02:30 / 03:00 with no timezone;
  App Service is UTC (= 09:00–10:00 WIB). Setting the VM to Asia/Jakarta would shift every job by 7 h.
- **`trust proxy` is pinned to Cloudflare ranges only** (`src/index.ts:20`). Behind a local proxy/tunnel
  every request arrives from 127.0.0.1 → the public catalogue rate limit would see one client. Add
  `'loopback'` to the list.
- **JWT secret is committed** in `config.json` (tracked by git). Move it to an env var during this move;
  rotating it logs every device out once.
- App settings the VM needs (names only): `GLOBAL_DB_URL`, `TENANT_DATABASE_URL`, `PUSHY_SECRET_API_KEY`,
  `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL`, `R2_SECRET_ACCESS_KEY`; plus `PORT`.
  App Service also provides `/health` checks, AlwaysOn, HTTP/2, TLS 1.2 min.
- OCI CLI: the launch API rate-limits (`TooManyRequests`) when retried every ~45 s — use ≥ 2 min.
- `~/.oci/config` stores the key passphrase in plain text — keep that folder on this Mac only.

## Cloudflare facts that shape the cutover (checked 2026-09-28)

- `*.bayaryuk.net` is a **proxied wildcard CNAME → the Azure origin**, and the Worker route
  `*.bayaryuk.net/*` sends it to **`catalogue-subdomain`**. Before 2026-09-28 `api.bayaryuk.net` resolved via the
  wildcard; the Worker has `api` in its `RESERVED` set and passed it straight through to Azure, which 404'd because
  the hostname wasn't bound yet. A **proxied** `api` record still matches the Worker route (it would pass through,
  but costs a hop + Worker quota) → add a no-Worker route **`api.bayaryuk.net/*`** (same trick as
  `images.bayaryuk.net/*`) before the tunnel goes live. Phase 1 is **DNS-only** because Azure's managed cert is
  issued/renewed only while `api` CNAMEs straight at App Service.
- ⚠️ **The Worker hard-codes the Azure origin** (`ORIGIN` in `workers/catalogue-subdomain/src/index.js`). At cutover,
  point it at `https://api.bayaryuk.net` (or the tunnel host) and `npx wrangler deploy`, or catalogue pages keep
  coming from App Service — and break once App Service is deleted.
- Phase 1 records (Azure custom domain): `CNAME api → bayaryuk-c2c8d5acg8chaqfm.southeastasia-01.azurewebsites.net`
  (DNS only) + `TXT asuid.api → <App Service customDomainVerificationId>`
  (`az webapp show … --query customDomainVerificationId`).
- Token needed (one, scoped to account + zone `bayaryuk.net`): **Zone › DNS › Edit**, **Zone › Workers Routes › Edit**,
  **Account › Cloudflare Tunnel › Edit**.
- Native module: `lzo` (via `parquetjs`) → the app **must be built on the VM**, never shipped from the Mac.

### Found in the 2026-10-12 tests

- **Bot Fight Mode is OFF** on the zone (`fight_mode: false`, read-only token) → the app's `Dart/3.13 (dart:io)`
  client is not challenged behind Cloudflare. Keep it off for the API host.
- ⚠️ **The R2 rate-limit rule is not host-scoped**: `/receipts/`, `/laundry/`, `/fonts/`, paths containing
  `/items/`, `/variants/`, `/branding/` → 300 req / 10 s per IP+colo → block 10 s. Behind the tunnel it would also
  count API calls (e.g. `/laundry/...`). Add `http.host eq "images.bayaryuk.net" and (…)` before the DNS flip
  (dashboard: Security → WAF → Rate limiting rules; needs a token with zone rulesets edit for the API).
- FE: every `API()` creates its own `http.Client` (43 call sites, still so on sprint-008) → each repository's first
  call opens a new TCP+TLS connection. A shared client saves a handshake per call on mobile networks, on any host.
- FE `main`: `/version/check` answers 400 and `_executeRequest` treats any 400 as "token expired" → every launch
  does a token refresh + retry (~0.6 s on the VM, 2–5 s on Azure). Check whether sprint-008 still does this.

## Cutover checklist (in order)

1. Sprint-008 on `main` (brings `DISABLE_CRONS`/`HOST`, the `'loopback'` trust-proxy fix) and **deployed to the VM**
   with `deploy/oracle/deploy.sh`; the DB migrations of the release run first as usual.
2. ✅ **Done 2026-10-13** — the R2 rate-limit rule is scoped to `images.bayaryuk.net` (`http.host eq "images.bayaryuk.net" and (…)`, ruleset `653465c014e74795bfad9f67996e4e09` v2, same 300 req / 10 s limit).
3. Release the sprint-008 APK (`_releaseBaseURL = api.bayaryuk.net`) and get **every `audio_technic` device**
   on it — old APKs call `…azurewebsites.net` directly and will break once App Service is gone. FE SPRINT_008 §3
   step 10 (`minVersion 1.3.0`) forces this with the non-dismissible update dialog; prod had no `app_version` rows
   before (checked 2026-10-12), so that step creates them.
4. Add ingress `api.bayaryuk.net → http://127.0.0.1:8080` to tunnel `bayaryuk-oracle` + a no-Worker route
   `api.bayaryuk.net/*`; then switch the `api` record from the DNS-only App Service CNAME to a **proxied** CNAME →
   `09c2860b-518f-4313-9654-e8f6e52d4859.cfargotunnel.com` (remove `TXT asuid.api` later).
5. **Crons hand-over, same minute:** VM `/etc/bayaryuk/env` drop `DISABLE_CRONS=true` + restart; set
   `DISABLE_CRONS=true` on App Service (or stop it) — never both running crons on the prod DB.
6. Repoint the catalogue Worker `ORIGIN` to `https://api.bayaryuk.net` and `npx wrangler deploy`.
7. Watch a few days (VM `journalctl -u bayaryuk`, Azure `Requests` should fall to ~0), keep App Service as the
   rollback.
8. **Stop paying:** a *stopped* App Service on B1 **still bills** (the plan is what costs money) → delete the web
   app **and** the App Service plan (or scale the plan to F1 if a free warm rollback is wanted). Then remove the
   `api` custom domain/cert on Azure and the Azure-origin wildcard if nothing else uses it.
   ⚠️ **Before deleting, repoint the proxied wildcard `*.bayaryuk.net` CNAME** (record `5370df2c0d298c3227112921dd467ffe`, still → the Azure hostname) to the tunnel hostname: the catalogue Worker answers every shop subdomain, but the record must keep resolving for Cloudflare to route the request at all. Also remove `TXT asuid.api`.
9. **CI/CD (noted 2026-10-13, owner).** `.github/workflows/main_bayaryuk.yml` deploys every push to `main` to
   **Azure only**; the VM is deployed by hand with `deploy/oracle/deploy.sh <VM_IP> origin/main`.
   - **Tonight and during step 7: no change.** Azure must still receive the new code (it answers the old app with
     the forced update, and it is the rollback), so the workflow stays. **Every push to `main` needs the VM deploy
     right after it**, or the two servers run different code.
   - **With step 8: the workflow must change in the same commit that removes App Service**, otherwise every push to
     `main` fails at "Login to Azure". Replace the Azure steps with a VM deploy. GitHub's runners cannot SSH in (the
     OCI SSH list is three fixed IPs), so the choices are: (a) a **self-hosted runner on the VM** (free, arm64, no
     inbound port; the job runs the same build-then-switch steps as `deploy.sh`), (b) SSH through the Cloudflare
     tunnel with an Access service token, or (c) keep `deploy.sh` manual and reduce the workflow to tests on `main`.
     **Decided 2026-10-13 (owner): (c)** — one person deploys, so no automation: `deploy.sh` stays the deploy, and
     the workflow becomes tests-only on `main`. It needs a network on the OCI SSH list. Also drop the workflow's "delete `libquery_engine-linux-arm64*`" step then (§ gotchas).

> **Cutover done 2026-10-13 ~21:50 MYT** — steps 1–6 complete: BE `95f7834` on the VM (release
> `20261013132743-95f7834`) and on Azure; `api.bayaryuk.net` is a proxied CNAME to the tunnel (ingress + no-Worker
> route added); crons run on the VM, Azure has `DISABLE_CRONS=true`; Worker `ORIGIN` = `https://api.bayaryuk.net`;
> `app_version` android min/latest = `1.3.0`. Remaining: step 7 (watch), step 8 (delete App Service + plan),
> step 9 (workflow), delete `CLOUDFLARE_TEMP_TOKEN`. Record: FE `docs/sprints/SPRINT_008.md` §7.

## Rollback

Until DNS moves, nothing to roll back — App Service serves all traffic. After the move: point
`api.bayaryuk.net` back at App Service (keep the plan running until the VM has been stable for weeks).
To remove everything on Oracle: terminate the instance, delete the VCN resources and the `bayaryuk`
compartment, delete the budget.

## Alternatives considered (2026-09-28)

| Option | Result |
|---|---|
| Azure free VM (B2ats v2 / B2pts v2, 12 months) on the DB subscription `3bbc4892-…` | ❌ Not allowed in Southeast Asia (`NotAvailableForSubscription`). Basv2/Bpsv2 quota is 0 in every nearby region; self-service increases in Malaysia West and Indonesia Central were auto-rejected. Only a portal support ticket remains. Malaysia West would also add ~9 ms per DB round trip (~6 per request → ~+55 ms). |
| App Service **F1** (always free, same region as DB) | Fits today's load (5 CPU-min/day median, 26 max vs a 60 min/day cap; 1–4 MB/day vs a 165 MB cap; 244 MB RAM). **Rejected by the user**: more users are planned, so no low-spec hosting. |
| Alibaba Cloud / other VPS | Paid, with no free equivalent; it would have to be in Singapore to stay near the DB. |
| **Oracle A1 (this plan)** | **Chosen.** 2 OCPU / 12 GB is above App Service B1 (1 core / 1.75 GB) at $0. The Singapore-to-Singapore latency to the Azure DB is still to be measured once the VM exists. The A1 limits (16 regional cores) suggest PAYG is active. |

Until the VM exists, **App Service B1 stays** ($13.14/mo). For growth, the first ceiling is MySQL connections and IOPS, not the app server (see FE memory `reference_infra_capacity.md`).
