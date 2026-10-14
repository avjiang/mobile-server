# App server → office Mac mini standby (POC plan, 2026-09-28)

Run the **Node backend** on the spare office **Mac mini (M1, 16 GB)** as a **standby** next to Azure App
Service, reached through a Cloudflare Tunnel. It can be promoted to primary later, which saves the App
Service bill ($13.14/mo). **The database stays on Azure** (`bayaryuk-db`, MySQL 8.4 since 2026-10-14, sub `3bbc4892-…`).
This was the fallback for the Oracle VM move (done 2026-10-13; as built in FE `.claude/memory/reference_oracle_vm_prod_server.md`, plan doc retired 2026-10-14, see git history): Oracle A1 was "Out of host capacity",
and Azure free-VM quota was auto-rejected in Malaysia West and Indonesia Central.

## Status

| Step | State |
|---|---|
| Choice: Mac mini over the spare Ryzen PC (about 6 W idle vs about 50 W, native `launchd` boot without a login, built-in power-loss restart) | ✅ 2026-09-28 |
| Code: `DISABLE_CRONS=true` skips the nightly jobs; `HOST=127.0.0.1` binds loopback only (`src/index.ts`). Both are opt-in: unset = unchanged App Service behaviour (verified locally both ways) | ✅ code, not deployed (needed on the Mac mini only) |
| Scripts: `deploy/macmini/setup_macmini.sh` (one-time, run on the Mac mini), `deploy/macmini/deploy.sh` (from the dev Mac over SSH, health-checked switch, auto-rollback) | ✅ written 2026-09-28, not yet run |
| Office network check (IT permission for an outbound tunnel; ports 3306 + 7844 open) | ⏳ |
| Mac mini set up → DB firewall rule → first deploy → tunnel on `api-standby.bayaryuk.net` | not started |
| One week as standby (uptime, latency) → decide on promotion | not started |

**FileVault:** ignored for the POC (user, 2026-09-28). If it is ON, any unplanned reboot (power cut, update)
waits at the unlock screen and the backend stays down until someone logs in. Decide before promotion.

## POC steps

1. **On the Mac mini** (admin user): copy `deploy/macmini/setup_macmini.sh` over and run `zsh setup_macmini.sh`.
   It prints a network preflight (3306 / 7844 / 443 + DB round trip), installs Node 22 + cloudflared (Homebrew),
   disables sleep, turns on restart after power failure, sets macOS updates to install by hand, and creates
   `/opt/bayaryuk/{env,run.sh,releases,logs}` plus the LaunchDaemon `net.bayaryuk.backend` and a sudoers entry
   limited to loading and restarting that one service.
2. **Remote Login ON** (System Settings → General → Sharing) and add the dev Mac's public key to
   `~/.ssh/authorized_keys`.
3. **Fill `/opt/bayaryuk/env`** from the App Service app settings. Single-quote every value.
   Keep `DISABLE_CRONS='true'`.
4. **Azure MySQL firewall:** allow the office public IP (the setup script prints it). Then re-run step 1's
   preflight: the DB check only passes once the rule exists, because Azure silently drops unknown IPs.
   ```bash
   az mysql flexible-server firewall-rule create --subscription 3bbc4892-5a45-4680-95b3-64bf43d35d4c \
     -g bayar-yuk-v2 -n bayaryuk-db --rule-name office-macmini --start-ip-address <IP> --end-ip-address <IP>
   ```
5. **First deploy** from the dev Mac, while on the office network: `deploy/macmini/deploy.sh <user>@<macmini-ip>`.
6. **Cloudflare:** first add a **no-Worker route `api-standby.bayaryuk.net/*`**. Otherwise the `*.bayaryuk.net/*`
   Worker route sends the hostname to `catalogue-subdomain`, which treats `api-standby` as a shop slug. Then
   Zero Trust → Networks → Tunnels → create `bayaryuk-office`, public hostname `api-standby.bayaryuk.net` →
   `http://127.0.0.1:8080`, and run the given `sudo cloudflared service install <TOKEN>` on the Mac mini.
7. **Prove it:** `curl https://api-standby.bayaryuk.net/health` from outside the office. Then reboot the Mac mini
   and **do not log in**: the URL must answer again within about 2 minutes. Pull the power once as well.

## Promotion (only after the standby week)

- Point `api.bayaryuk.net` at the tunnel. This needs the FE release with `_releaseBaseURL = api.bayaryuk.net`
  to be widely adopted first (see the Oracle doc, step 6), plus the `api.bayaryuk.net/*` no-Worker route and the
  Worker `ORIGIN` repoint.
- Flip `DISABLE_CRONS` → `'false'` on the Mac mini **and** stop App Service in the same window. The jobs must run on
  exactly one host.
- A public-IP updater for the DB firewall, if the office IP turns out not to be static.
- Log rotation for `/opt/bayaryuk/logs/backend.log` (none yet; volume is small).
- Remote access from outside the office (Cloudflare Access SSH over the same tunnel) so deploys don't need
  the office LAN.
- Keep App Service (or a stopped plan) for weeks as the rollback target.

## Capacity (measured 2026-09-28)

Today's traffic is about 2,100 requests/day with a busiest 5-min window of 0.32 req/s. The app host is not
the limit. The first ceiling is **DB connections, at about 50 concurrently active shops** (about 3 each, of 171).
Office-specific points:
- Each request makes about 3.4 queries, so the office→Singapore round trip is added about 3 times per request.
  This affects latency, not capacity.
- Once the app host is outside Azure, DB→app traffic is internet egress. The first 100 GB/mo is free, and the
  app's share is about 5 GiB/mo today (inferred), so that allowance runs out at about 15–20× today's traffic.
- The office uplink and power become production dependencies once the Mac mini is promoted.

## Gotchas

- **Office network ownership:** an outbound tunnel from a company LAN can breach IT policy. Get permission first.
- **Crons follow the process clock.** `run.sh` sets `TZ=UTC` (like App Service) without changing the Mac's own
  clock.
- **Prisma engine:** the build keeps only `darwin-arm64`. It comes from the schemas' `native` target, so no schema
  change is needed.
- **`sudo -n`** in `deploy.sh` works only for the two `launchctl` commands in `/etc/sudoers.d/bayaryuk`.
  Any other sudo over SSH fails by design.
- `HOST=127.0.0.1` keeps port 8080 off the office LAN. `trust proxy` already includes `'loopback'`, so
  `req.ip` stays the real client behind the tunnel.

## Rollback

While standby: nothing points at the Mac mini except `api-standby`. To remove it: delete the tunnel, the DNS
record and the no-Worker route; `sudo launchctl bootout system/net.bayaryuk.backend`; delete the
`office-macmini` DB firewall rule. After promotion: point `api.bayaryuk.net` back at App Service, restart
App Service and flip `DISABLE_CRONS` back.
