# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Place this file at `.claude/CLAUDE.md` in the project root.

## Common Commands

```bash
npm run dev                        # Start dev server (PM2 + tsx, port 8080, watches ./src)
npm run build                      # TypeScript compilation (tsc → ./dist)
npm start                          # Production mode (node dist/index.js)
npm run generate_prisma            # Generate Prisma clients for both global and tenant schemas
npm run upgrade_db                 # Run Prisma migrations on all databases
npm run seed_permissions           # Seed permission definitions
npm run seed_settings_definitions  # Seed settings
npm run seed_subscription_plans    # Seed subscription plans
npm run seed_subscription_add_ons  # Seed subscription add-ons
```

> **Note**: The project owner runs all terminal commands manually. Do not execute npm, prisma, or any shell commands. In the end of implementation, list down all the required commands to run.

## Architecture

**Multi-tenant Express.js REST API** with MySQL via Prisma ORM.

### Two-Database Pattern

- **Global DB** (`prisma/global-client/schema.prisma`): Tenants, users, subscriptions, add-ons, payments, outlets, warehouses, push device allocations
- **Tenant DB** (`prisma/client/schema.prisma`): Each tenant gets its own database with items, categories, customers, sales, inventory, loyalty, roles, permissions, etc.

Connection management in `src/db.ts`:

- `getGlobalPrisma()` — single global instance
- `getTenantPrisma(dbName)` — cached per-tenant instances (Map)
- `initializeTenantDatabase(dbName)` — creates DB and runs migrations for new tenants

### Module Structure

Each module follows: `controller.ts` (routes + validation) → `service.ts` (business logic) → `request.ts` / `response.ts` (DTOs).

Routes registered in `src/index.ts` after `authorizeMiddleware` (JWT verification). The `/auth` route is the only unauthenticated route.

When adding a new module:

1. Create `controller.ts`, `service.ts`, `request.ts`, `response.ts` under `src/<module>/`
2. Register routes in `src/index.ts`
3. Follow the controller pattern: validate auth → validate params → call service → `sendResponse(res, result)` / `.catch(next)`
4. For admin endpoints, follow the `addDeviceQuota`/`reduceDeviceQuota` pattern in `admin.service.ts`

### Authentication

JWT-based. Token read from `token` header. `UserInfo` attached to `req.user` with: `tenantUserId`, `userId`, `username`, `databaseName`, `tenantId`, `role`, `planName`, `loyaltyTier`.

Admin routes (`/admin`) require `role === 'Provider' || role === 'Owner'`.

### Error Handling

Custom error classes in `src/api-helpers/error.ts`:

- `RequestValidateError` (400), `NotFoundError` (404), `BusinessLogicError` (400), `AuthenticationError` (configurable status), `VersionMismatchError` (409)
- Error middleware in `src/middleware/error-middleware.ts` converts to `{ success: false, error: { errorType, errorMessage } }`
- Always throw typed errors from service layer — never return raw error objects or generic `Error`

### Response Pattern

All responses wrapped via `sendResponse()` from `src/api-helpers/network.ts`:

```typescript
{ success: true, data: T, total?: number, serverTimestamp?: string, notificationTopics?: string[] }
```

Never return raw data outside `sendResponse()`.

### Optimistic Concurrency

Prisma extension in `db.ts` auto-increments `version` field on updates. Mobile clients send version for conflict detection (409 on mismatch).

### Sync Pattern

Many endpoints accept `SyncRequest` (`lastSyncTimestamp`, `lastVersion`, `skip`, `take`) for delta sync with mobile clients. Returns `{ data, total, serverTimestamp }`.

## Key Subsystems

### Subscription & Add-Ons

- Plans: Basic, Pro (defined in `SubscriptionPlan`)
- Add-ons tracked in `TenantAddOn` with composite key `tenantId_addOnId`
- `ADD_ON_IDS` constant in `src/constants/add-on-ids.ts`: `EXTRA_USER: 1, EXTRA_DEVICE: 2, EXTRA_WAREHOUSE: 3, ADVANCED_LOYALTY: 4`
- Downgrade from Pro→Basic auto-removes all add-ons (`handleDowngradeToBasic` in `admin.service.ts`)

### Loyalty Program

- Feature-gated via JWT `loyaltyTier`: `'none'` (Basic/Trial), `'basic'` (Pro), `'advanced'` (Pro + ADVANCED_LOYALTY add-on)
- Middleware gate: `requireLoyalty('basic' | 'advanced')` in `src/middleware/loyalty-gate.middleware.ts`
- In-memory cache (`src/cache/simple-cache.service.ts`) for program lookups — always invalidate on mutations
- Points: earn/redeem with FIFO batch deduction, auto tier-upgrade based on `totalSpend`

### Sales Integration

- `processLoyaltyForSale` and `reverseLoyaltyForSale` in `sales.service.ts` handle point earn/redeem during transactions
- Subscription package quota deduction happens at sale time

## Environment

- `.env`: `TENANT_DATABASE_URL`, `GLOBAL_DB_URL`, `PORT`, `PUSHY_SECRET_API_KEY`
- `config.json`: `JWT_TOKEN_SECRET`
- PM2 config in `ecosystem.config.js` (tsx interpreter, watch mode)

## Module Documentation

Module docs are **unified across backend and frontend** and live in the sibling Flutter repo:
`../flutter-front-end/docs/modules/<MODULE>.md`

The unified doc covers business rules, data model, API contract, backend implementation (this repo's `src/<module>/`), and frontend implementation. Structure follows `../flutter-front-end/docs/modules/_TEMPLATE.md`.

### Rules — apply to EVERY module, always (new features, bug fixes, enhancements, amendments)

1. **Before starting any work** on a module (e.g. anything under `src/<module>/`):
   - Look for `../flutter-front-end/docs/modules/<MODULE>.md` (check `../flutter-front-end/docs/modules/README.md` for the index).
   - If it exists → **read it first** to understand contract, business rules, edge cases.
   - If it does not exist → create it as part of the work using `../flutter-front-end/docs/modules/_TEMPLATE.md`.
2. **After finishing the work** → update the module doc to reflect the new behavior (including backend-side changes in the "Backend Implementation" and "API Contract" sections). Undocumented change = incomplete change.
3. **One doc per module.** Never create a BE-only briefing or changelog doc in this repo. Extend the unified module doc instead.
4. **Module name = `src/<module>/` folder name** (UPPER_SNAKE_CASE in the filename, e.g. `LOYALTY.md`).

### BE-only infra docs (not feature docs) — stay in this repo

| File                                          | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `SETUP_GUIDE.md`                              | Environment and database setup        |
| `SUBSCRIPTION_MODEL.md`                       | Subscription & billing architecture   |
| `docs/SCALING_PLAN.md`                        | Scaling strategy                      |
| `docs/ADMIN_ENDPOINT_CHANGES.md`              | Admin API changelog with sample JSON  |
| `src/admin/ADMIN_MODULE_API_DOCUMENTATION.md` | Full admin module docs (legacy)       |
| `src/auth/AUTH_MODULE_API_DOCUMENTATION.md`   | Auth module docs (legacy)             |

## Ground Rules

- **Do not run any terminal commands** — the project owner executes all npm, prisma, and shell commands manually
- Prefer editing existing files over creating new ones
- API contract changes (new fields, endpoints, request/response shape) are captured in the unified module doc at `../flutter-front-end/docs/modules/<MODULE>.md` (API Contract + Backend Implementation sections) — do NOT create a separate briefing file in this repo
- Always update the unified module doc after making changes (see "Module Documentation" section); if none exists, create one from `../flutter-front-end/docs/modules/_TEMPLATE.md`
- Always be thorough — deep dive to check for missing pieces before considering something done
- When compacting, always preserve the full list of modified files
- When updating current endpoints or adding new ones, do not forget to always update the `postman.json`

## Verification Before Done

- Never mark a task complete without demonstrating it works
- Diff behavior between main and your changes when relevant
- Confirm no regressions: trace the full request path (controller → service → DB) for any changed endpoint

## Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky, implement the proper solution instead
- Skip this for simple, obvious fixes — don't over-engineer

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **World-class Performance**: Changes should always implement the best performance and cost optimisations.
