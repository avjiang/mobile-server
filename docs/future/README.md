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
| [DB_MIGRATION_2026.md](DB_MIGRATION_2026.md) | New Azure account created; cutover window late August 2026 (must complete before Fri 4 Sep 2026 when current free tier expires) | Plan drafted 2026-05-25, awaiting Phase 0 (tooling) trigger |
| [MULTI_OUTLET.md](MULTI_OUTLET.md) — single source of truth for all multi-outlet work | Super-admin change: before first multi-outlet tenant / owner self-service (safe anytime). Migration deploy: run when deploying to prod. | Drafted 2026-07-07: P0+P1 done, migration dry-run done; prod deploy + Set A/B + backlog pending |

---

## Conventions

- **One file per initiative.** Don't bundle unrelated plans.
- **Always include a "Status" section at the top** showing which phases are done.
- **Always include trigger conditions** — date, count, signal — so future-you knows when to act.
- **Always include rollback plan** for anything destructive.
- **Date the doc** in YYYY-MM-DD format somewhere prominent so stale plans are easy to spot.

When you spot a plan in here whose trigger has passed without execution, raise it — it's either overdue or no longer needed.
