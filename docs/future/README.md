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
| [APP_SERVER_MACMINI.md](APP_SERVER_MACMINI.md) | POC now: office Mac mini as a **standby** backend behind a Cloudflare Tunnel (`api-standby.bayaryuk.net`). Promote only after a clean standby week, the `api.bayaryuk.net` APK adoption, and IT permission for the office network. | 🟡 2026-09-28: code switches (`DISABLE_CRONS`, `HOST`) + `deploy/macmini/` scripts written; Mac mini not set up yet. |
| [MULTI_OUTLET_NEXT.md](MULTI_OUTLET_NEXT.md) — multi-outlet work still unbuilt: account owner outlet-unrestricted (Set A), owner assigns staff to outlets (Set B), BE-2 header-less request → 400, 2-outlet fixture + E2E, merge-audit backlog | Set A/B + E2E: before the first tenant with more than one outlet. BE-2: before any tenant runs more than one outlet (needs an app that always sends `X-Outlet-ID`). | 📋 2026-10-14: split from the retired `MULTI_OUTLET.md` (multi-outlet live on prod since 2026-10-13; as built in FE `docs/modules/OUTLET.md`). Not started. |

---

## Conventions

- **One file per initiative.** Don't bundle unrelated plans.
- **Always include a "Status" section at the top** showing which phases are done.
- **Always include trigger conditions** — date, count, signal — so future-you knows when to act.
- **Always include rollback plan** for anything destructive.
- **Date the doc** in YYYY-MM-DD format somewhere prominent so stale plans are easy to spot.

When you spot a plan in here whose trigger has passed without execution, raise it — it's either overdue or no longer needed.
