# App server → Oracle Always Free VM (plan, 2026-09-27)

Move the **Node backend only** off Azure App Service B1 ($13.14/mo) onto an Oracle Cloud Always Free
Ampere A1 VM. **The database stays on Azure** (`bayaryuk-db-v2`, free until ~2026-09-26 + 12 months).

## Status

| Step | State |
|---|---|
| Oracle account (`alvinn.jiang@gmail.com`, tenancy `avjiang`, home region **`ap-singapore-2` Singapore West**) | ✅ created 2026-09-27 |
| OCI CLI on the Mac (`brew install oci-cli`, `oci setup bootstrap`, profile DEFAULT) | ✅ |
| Pay-as-you-go upgrade | ⏳ user started it; console said "account provisioning in progress" (2026-09-27 evening) |
| Budget alert `bayaryuk-any-spend` ($1/mo; ACTUAL ≥1% + FORECAST ≥100% → `alvinn.jiang@gmail.com`) | ✅ |
| Compartment `bayaryuk` + VCN `bayaryuk-vcn` (10.0.0.0/16) + IGW + route table + subnet `bayaryuk-public` (10.0.1.0/24) + security list `bayaryuk-sl` | ✅ |
| SSH key `~/.ssh/bayaryuk_oci` (ed25519, Mac-local) | ✅ |
| **VM `bayaryuk-app`** | ❌ not yet — **"Out of host capacity"** for 164 attempts, 14:23–21:08 on 2026-09-27 |
| Scripts: `deploy/oracle/setup_vm.sh` (one-time VM setup), `deploy/oracle/deploy.sh` (build on VM, health-checked switch, auto-rollback) | ✅ written 2026-09-28, not yet run (no VM) |
| `trust proxy` + `'loopback'` (`src/index.ts`) | ✅ code, not deployed |
| `api.bayaryuk.net` → App Service (DNS-only CNAME + `TXT asuid.api`, custom domain, managed cert GeoTrust exp 2027-03-28) | ✅ 2026-09-28, verified live |
| FE `_releaseBaseURL = "api.bayaryuk.net"` | ✅ code 2026-09-28 — ships with the next APK (SPRINT_008) |
| APK adoption → VM live → tunnel → DNS flip → App Service plan to F1/deleted | not started |

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
