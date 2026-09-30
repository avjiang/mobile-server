# Future Work — Planned Runbooks & Initiatives

Docs in this folder describe work that has been **planned but not yet executed**. The plan is fully fleshed out — including code diffs, command sequences, rollback paths — but execution is gated on a future trigger (a date, a tenant count, an account being created, etc.).

**Rule:** anything that lands here MUST be added to the index below with its trigger condition. That way nothing gets buried.

When a plan is executed, either:
- Move the doc out of `future/` into the appropriate operational location (e.g. archive a completed migration as a changelog), or
- Delete it if the runbook is single-use and the outcome is documented elsewhere.

---

## Index

| Doc | Trigger to execute | Status |
|---|---|---|
| [DB_MIGRATION_2026.md](DB_MIGRATION_2026.md) | Remaining: confirm `B1MS Compute - Free` on the new bill (2026-09-27/28); delete old `bayaryuk-server` + its alert + `migration_2026-09-26` firewall rule + `OLDPROD_*` on/after 2026-09-29; then retire this doc (fold as-built into a current-state doc). | ✅ **CUTOVER DONE 2026-09-26** 22:33–22:38 (≈5 min). Prod MySQL = `bayaryuk-db-v2` (sub `3bbc4892-…`, RG `bayar-yuk-v2`); scope `global` + `audio_technic_db` + `web_bytes_db`; `db_verify` IDENTICAL (194 tables / 99,637 rows). |
| [APP_SERVER_MACMINI.md](APP_SERVER_MACMINI.md) | POC now: office Mac mini as a **standby** backend behind a Cloudflare Tunnel (`api-standby.bayaryuk.net`). Promote only after a clean standby week, the `api.bayaryuk.net` APK adoption, and IT permission for the office network. | 🟡 2026-09-28: code switches (`DISABLE_CRONS`, `HOST`) + `deploy/macmini/` scripts written; Mac mini not set up yet. |
| [APP_SERVER_ORACLE.md](APP_SERVER_ORACLE.md) | Oracle pay-as-you-go upgrade finished **and** an A1 VM launches (`deploy/oracle/launch_vm_retry.sh`); cutover only after an FE release on `api.bayaryuk.net` is widely adopted. | 🟡 Started 2026-09-27: Oracle account + network + budget alert ready (all free); VM blocked by "Out of host capacity". |

---

## Conventions

- **One file per initiative.** Don't bundle unrelated plans.
- **Always include a "Status" section at the top** showing which phases are done.
- **Always include trigger conditions** — date, count, signal — so future-you knows when to act.
- **Always include rollback plan** for anything destructive.
- **Date the doc** in YYYY-MM-DD format somewhere prominent so stale plans are easy to spot.

When you spot a plan in here whose trigger has passed without execution, raise it — it's either overdue or no longer needed.
