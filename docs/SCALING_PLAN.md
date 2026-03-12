# Azure MySQL Scaling & Performance Optimization Plan

**Goal:** Improve performance with cost optimization on Azure. Plan for 100+ tenants. Add Redis cache and CDN when ready.

**Last updated:** March 2026

---

## 1. Current Setup

| Component | Spec | Est. Monthly Cost |
|---|---|---|
| **Azure Web App** | B1 (1 core, 1.75 GiB) | ~$14 |
| **Azure MySQL Flexible Server** | B1ms (1 vCore, 2 GiB) | ~$22 |
| **Storage** | ~20 GiB | ~$3 |
| **Total** | | **~$39/mo** |

All databases (1 global + N tenant) run on the single B1ms instance.

### Current Performance Bottlenecks

1. **B1ms CPU baseline is only 20%** — under sustained POS load, CPU credits deplete and you throttle to 0.2 vCore effective
2. **640 IOPS cap** — will bottleneck as tenants/transactions grow
3. **341 max connections** — enough for now, but at 5 connections per Prisma tenant client, you hit the limit at ~60 tenants
4. **2 GiB RAM** — limited MySQL buffer pool for query caching
5. **No connection pooling** — each tenant Prisma client opens ~5 connections by default (`src/db.ts:28`)
6. **No client eviction** — tenant Prisma clients are cached forever in a Map, never disconnected (`src/db.ts:12`)

---

## 2. Azure MySQL Upgrade Path

### Burstable Tier Options (Cost-Optimized)

| Tier | vCores | RAM | Max Conn | Max IOPS | Est. $/mo | Good For |
|---|---|---|---|---|---|---|
| **B1ms** (current) | 1 | 2 GiB | 341 | 640 | ~$22 | 1-10 tenants |
| **B2ms** | 2 | 4 GiB | 683 | 1,280 | ~$44 | 10-50 tenants |
| **B4ms** | 4 | 8 GiB | 1,365 | 2,560 | ~$88 | 50-100 tenants |
| **B8ms** | 8 | 16 GiB | 2,730 | 5,120 | ~$176 | 100-200 tenants |

### General Purpose Tier (Sustained Performance, No Throttling)

| Tier | vCores | RAM | Max Conn | Max IOPS | Est. $/mo | Good For |
|---|---|---|---|---|---|---|
| **D2ds v4** | 2 | 8 GiB | 683 | 3,200 | ~$99 | 50-100 tenants (steady load) |
| **D4ds v4** | 4 | 16 GiB | 1,365 | 6,400 | ~$198 | 100-200 tenants |

**Key difference:** Burstable tiers throttle under sustained load (20-40% CPU baseline). General Purpose gives you full CPU all the time. For a POS system with predictable meal-time peaks, burstable works well. If you see frequent CPU credit depletion, move to General Purpose.

### Recommended Upgrade Timeline

| Scale | MySQL Tier | Monthly DB Cost | Why |
|---|---|---|---|
| **Now (1-10 tenants)** | Stay on B1ms | ~$22 | Sufficient, add `connection_limit=2` |
| **10-30 tenants** | Upgrade to B2ms | ~$44 | 2x connections, 2x IOPS |
| **30-60 tenants** | Upgrade to B4ms | ~$88 | 4x everything |
| **60-100 tenants** | B8ms or D2ds v4 | ~$99-176 | Need 1000+ connections |
| **100-200 tenants** | D4ds v4 | ~$198 | Sustained performance, no throttling |

---

## 3. Code Changes for Performance & Scaling

All changes are in `src/db.ts`. No Prisma schema changes needed.

### 3.1 Add `connection_limit=2` to Tenant URLs (Immediate, Free)

**Why:** Default Prisma pool is ~5 connections per client. Most POS tenants need max 2 concurrent queries. This alone cuts your connection usage by 60%.

**Change:** In the environment variable:
```
TENANT_DATABASE_URL="mysql://user:pass@host:3306/{tenant_db_name}?sslaccept=strict&connection_limit=2"
```

**Impact at scale:**

| Tenants | Default (5 conn) | With limit=2 |
|---|---|---|
| 10 | 55 | 25 |
| 50 | 255 | 105 |
| 100 | 505 | 205 |
| 200 | 1,005 | 405 |

### 3.2 Implement TTL-Based Client Eviction (High Priority)

**Why:** `src/db.ts:12` — the `tenantPrismaInstances` Map grows forever. At 100 tenants, all 100 clients stay loaded consuming ~15-30MB RAM each (1.5-3GB total). In a POS system, only ~20-30 tenants are active at any given time.

**What to do:** Track `lastAccessed` per tenant client. Disconnect and remove clients idle for >15 minutes. Recreate on demand (~200-500ms cold start).

**Impact:** Keeps memory under 1GB and connections under 100 even at 500 total tenants.

### 3.3 Set Node.js Heap Limit (Before 50+ Tenants)

**Why:** Node.js default heap is ~1.7GB. Without client eviction, 100 loaded Prisma clients (64 models each) = 1.5-3GB heap usage, causing OOM crash.

**Change:** Set in Azure Web App configuration:
```
NODE_OPTIONS=--max-old-space-size=4096
```

### 3.4 Parallelize Migration Scripts (Before 100+ Tenants)

**Why:** `src/db.ts:82-111` runs `prisma migrate deploy` sequentially. At 100 tenants, this takes 8-17 minutes.

**What to do:** Batch with `Promise.all()`, batch size 5-10. Cuts 100-tenant migration from ~13min to ~1.5min.

---

## 4. Redis Cache Plan

### What to Cache (Priority Order)

**Priority 1 — Highest Impact:**

| Data | File | Queries Saved | Redis TTL | Invalidation Trigger |
|---|---|---|---|---|
| Session report aggregations | `src/report/report.service.ts` | 16+ queries per call | 30 min | New sale/return/payment |
| Menu profiles by outlet | `src/menu/menu.service.ts` | Deep 4-level nested include | 60 min | Menu update |
| Admin billing dashboard | `src/admin/admin.service.ts` | Multi-query aggregation | 60 min | Payment/subscription change |

**Priority 2 — Medium Impact:**

| Data | Redis TTL | Invalidation |
|---|---|---|
| Stock balances per outlet | 5 min | Stock movement |
| Variant attributes (currently in-memory cached) | 15 min | Attribute creation |
| Customer/supplier lists | 30-60 min | CRUD operations |
| Category lists | 60 min | Category CRUD |

**Priority 3 — Required for Multi-Instance Scaling:**

| Data | TTL | Notes |
|---|---|---|
| User sessions / refresh tokens | Match JWT expiry | Needed when running 2+ Web App instances |
| Rate limiting counters | 1-15 min | Per-tenant/per-IP |
| Permission/role lookups | 5 min | Saves 1 DB query per authenticated request |

### Redis Key Schema (Multi-Tenant Safe)

```
cache:{tenantDbName}:{entity}:{id}
```

Examples:
- `cache:restaurant_a_db:menu:outlet:1`
- `cache:restaurant_a_db:report:session:123`
- `cache:global:settings:definitions`
- `session:user:{userId}`
- `ratelimit:{tenantId}:{ip}`

### Azure Redis Options

| Option | Spec | Monthly Cost | Best For |
|---|---|---|---|
| **Azure Cache for Redis Basic C0** | 250MB | ~$17 | 1-50 tenants |
| **Azure Cache for Redis Basic C1** | 1GB | ~$42 | 50-200 tenants |
| **Azure Cache for Redis Standard C0** | 250MB, replicated | ~$52 | Production HA |
| **Self-managed on VM (B1s)** | 1GB RAM VM | ~$10-15 | Budget option, you manage it |

### Implementation Approach

**Package:** `ioredis` (best TypeScript support, cluster-ready)

**Files to modify:**
- `src/cache/simple-cache.service.ts` — Create new `redis-cache.service.ts` with same interface
- `src/report/report.service.ts` — Wrap report aggregations with cache
- `src/menu/menu.service.ts` — Cache menu profiles
- `src/item/item.service.ts` — Switch from in-memory to Redis
- `src/admin/admin.service.ts` — Cache billing dashboards

---

## 5. CDN Plan

### Current State

- Pure API server — no static file serving
- Image URL fields exist in DB: `Item.image`, `Category.image`, `MenuItem.imageURL`, `MenuCategory.imageURL`, `ItemVariant.image`
- `@azure/storage-blob` v12.27.0 already installed in package.json but unused
- No upload endpoints implemented yet

### Recommended Setup

```
Mobile App  -->  Azure CDN  -->  Azure Blob Storage (origin)
                                       ^
                              Upload API endpoint (your server)
```

**Azure Blob Storage (Hot tier):** ~$0.02/GB/mo
- 100 tenants x 500 products x 50KB avg = 2.5GB = ~$0.05/mo

**Azure CDN Standard Microsoft:** ~$0.081/GB for first 10TB
- Monthly transfer ~10-50GB = ~$1-4/mo

**Total CDN + storage cost at 100 tenants: ~$2-5/mo**

### Implementation Steps (When You Build Image Upload)

1. Create Azure Blob Storage container for product images
2. Build upload endpoint using already-installed `@azure/storage-blob`
3. Store CDN URLs in existing image fields
4. Configure Azure CDN profile pointing to blob container
5. Set cache headers: `Cache-Control: public, max-age=2592000` (30 days)

---

## 6. Full Cost Projection (Staying on Azure)

### Phase 1: Now (1-10 tenants) — Code Optimizations Only

| Component | Monthly Cost |
|---|---|
| Azure Web App B1 | ~$14 |
| Azure MySQL B1ms | ~$22 |
| Storage | ~$3 |
| **Total** | **~$39/mo** |

**Action:** Add `connection_limit=2`, implement TTL eviction. No infra cost change.

### Phase 2: Growth (10-30 tenants) — Upgrade MySQL

| Component | Monthly Cost |
|---|---|
| Azure Web App B1 | ~$14 |
| Azure MySQL B2ms | ~$44 |
| Storage (50GB) | ~$7 |
| **Total** | **~$65/mo** |

### Phase 3: Scale (30-100 tenants) — Add Redis

| Component | Monthly Cost |
|---|---|
| Azure Web App B2 (2 core, 3.5GB) | ~$28 |
| Azure MySQL B4ms or D2ds v4 | ~$88-99 |
| Storage (100GB) | ~$14 |
| Azure Cache for Redis Basic C0 | ~$17 |
| **Total** | **~$150-160/mo** |

### Phase 4: Enterprise (100-200 tenants) — Multi-Instance + CDN

| Component | Monthly Cost |
|---|---|
| Azure Web App S2 (2 core, 3.5GB, 2+ instances) | ~$100 |
| Azure MySQL D4ds v4 | ~$198 |
| Storage (200GB) | ~$28 |
| Azure Cache for Redis Basic C1 | ~$42 |
| Azure CDN + Blob Storage | ~$5 |
| **Total** | **~$373/mo** |

### With Reserved Capacity (1-year commitment, ~40% off compute)

| Phase | On-Demand | With RI | Savings |
|---|---|---|---|
| Phase 1 (1-10) | $39 | ~$30 | 23% |
| Phase 2 (10-30) | $65 | ~$48 | 26% |
| Phase 3 (30-100) | $155 | ~$110 | 29% |
| Phase 4 (100-200) | $373 | ~$255 | 32% |

---

## 7. Scaling Risks & Mitigations

| Risk | Severity | When It Hits | Mitigation |
|---|---|---|---|
| Connection explosion | **HIGH** | ~60 tenants (341 max on B1ms) | `connection_limit=2` + TTL eviction keeps it under 100 |
| Node.js OOM | **HIGH** | ~50 tenants without eviction | TTL eviction + `--max-old-space-size=4096` |
| CPU credit depletion (burstable) | **MEDIUM** | Sustained peak hours | Monitor credits, upgrade to General Purpose when frequent |
| Sequential migrations too slow | **MEDIUM** | ~100 tenants (13+ min) | Parallelize with batch `Promise.all()` |
| In-memory cache inconsistent | **MEDIUM** | Multi-instance Web App | Replace with Redis before scaling out |
| Single DB instance bottleneck | **LOW** | ~500 tenants | Read replica for reports, or split into multiple instances |

---

## 8. Implementation Priority

### Immediate (No Cost, Code Only)
1. Add `connection_limit=2` to `TENANT_DATABASE_URL` env var
2. Implement TTL-based client eviction in `src/db.ts`
3. Set `NODE_OPTIONS=--max-old-space-size=4096` in Azure Web App config

### At 10-30 Tenants
4. Upgrade MySQL to B2ms (~$44/mo)
5. Monitor CPU credits via Azure Portal metrics

### At 30-50 Tenants
6. Add Redis (Basic C0, ~$17/mo)
7. Create `RedisCacheService`, cache report aggregations and menu profiles
8. Upgrade MySQL to B4ms (~$88/mo)

### At 50-100 Tenants
9. Upgrade Web App to B2 or S1
10. Parallelize migration scripts
11. Implement CDN + Blob Storage for product images
12. Upgrade MySQL to D2ds v4 if burstable credits deplete frequently

### At 100+ Tenants
13. Scale Web App to 2+ instances with Redis session management
14. Upgrade MySQL to D4ds v4
15. Upgrade Redis to Basic C1 or Standard C0
16. Consider Azure MySQL read replica for reporting queries

### Monitoring Checklist
- Monitor Azure MySQL metrics: CPU %, connection count, IOPS usage, memory %
- Set alerts at 80% of max connections and 80% CPU
- Benchmark query latency before/after each optimization
- Test tenant creation + migration flow at each scale milestone

---

## Appendix A: AWS Aurora MySQL Comparison

This section is for reference only. The decision was made to stay on Azure.

### Why Aurora Was Considered

- AWS Elastic Beanstalk deployment already exists (testing phase)
- Co-locating DB with app server eliminates cross-cloud latency

### Why Azure Was Chosen Over Aurora

| Factor | Azure MySQL | AWS Aurora MySQL |
|---|---|---|
| Comparable tier cost | B1ms ~$22/mo | db.t4g.medium ~$77/mo |
| I/O charges | Included | $0.22 per million requests (extra) |
| Management complexity | Portal-friendly, beginner-friendly | More complex IAM/VPC setup |
| Current infra | Already on Azure Web Apps | Would require full migration |

**Aurora is 3-4x more expensive** at comparable tiers for this workload, with no meaningful performance advantage for a POS system with 1-10 tenants.

### If Migrating to AWS Later

Migration requires only environment variable changes:
```
# Azure
GLOBAL_DB_URL="mysql://user:pass@host.mysql.database.azure.com:3306/global?sslaccept=strict"

# AWS RDS/Aurora
GLOBAL_DB_URL="mysql://user:pass@host.ap-southeast-1.rds.amazonaws.com:3306/global?ssl=true"
```

No code changes, no Prisma schema changes, no application logic changes needed. Aurora MySQL is wire-compatible with standard MySQL. All Prisma features (`CREATE DATABASE`, `$queryRaw`, `prisma migrate deploy`, multi-tenant pattern) work identically.

### Migration Process (If Needed)

1. Provision RDS/Aurora MySQL 8.0 in ap-southeast-1
2. `mysqldump` all databases from Azure
3. Import into AWS
4. Update environment variables
5. Verify and cut over
