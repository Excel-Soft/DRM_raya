# PostgreSQL Phase 1 — Production Readiness & Backup Configuration

**Date:** 2026-11-04 (UTC)  
**Target:** Local VPS PostgreSQL 16.15 — database **`drm_postgres`**, role **`drm_app`**  
**Scope:** Prepare for upcoming **1GB+ MySQL → PostgreSQL** migration  
**Out of scope:** Supabase production `DATABASE_URL`, MySQL data, application `.env`, backend restart

---

## Executive summary

| Area | Status |
|------|--------|
| PostgreSQL service & security baseline | **Pass** |
| `drm_app` / `drm_postgres` ownership & privileges | **Pass** |
| Automated daily backups (custom format, 7-day retention) | **Configured & tested** |
| Restore drill (temporary DB) | **Pass** |
| Performance tuning for migration | **Documented only** (not applied — avoids restart/disruption) |
| Off-server DR | **Documented** (required before relying on backups alone) |

---

## 1. Configuration audit

### 1.1 Version & service

| Item | Value |
|------|--------|
| Version | PostgreSQL **16.15** (Ubuntu / PGDG) |
| Cluster | `16/main`, port **5432** |
| Service | `active`, **enabled** on boot |
| Data directory | `/var/lib/postgresql/16/main` |
| Current DB size (`drm_postgres`) | ~**7.5 MB** (pre-migration) |

### 1.2 Ownership & privileges

| Object | Owner | Notes |
|--------|--------|--------|
| Database `drm_postgres` | `drm_app` | Application owns DB |
| Schema `drm` | `drm_app` | Intended app schema |
| Schema `public` | `pg_database_owner` | Standard PG 15+ behavior |

**`drm_app` checks:**

| Privilege | Result |
|-----------|--------|
| CONNECT on `drm_postgres` | Yes |
| USAGE + CREATE on `drm` | Yes |
| Superuser | **No** |
| Connection limit | Unlimited (`-1`) |

### 1.3 Authentication & network

| Setting | Value |
|---------|--------|
| `password_encryption` | **scram-sha-256** |
| `listen_addresses` | **localhost** |
| TCP bind | **127.0.0.1:5432**, **::1:5432** only (not `0.0.0.0`) |
| SSL | **on** (local connections primarily use Unix socket / loopback) |
| `pg_hba.conf` | Default Ubuntu local **peer** for Unix socket; **scram-sha-256** for loopback TCP |

Drop-in: `/etc/postgresql/16/main/conf.d/99-drm-local-only.conf` reinforces localhost listen.

### 1.4 Extensions

Currently installed in `drm_postgres`:

| Extension | Version |
|-----------|---------|
| `plpgsql` | 1.0 |

**Recommendation before migration:** Plan to add commonly needed extensions (e.g. `pgcrypto`, `uuid-ossp` or use built-in `gen_random_uuid()`) during a **maintenance window**, after reviewing MySQL → PG type mapping. Not installed in this phase to avoid unnecessary change.

### 1.5 Connection limits & usage

| Metric | Value |
|--------|--------|
| `max_connections` | **100** |
| Active connections (audit) | **1** |
| PM2 `drm-backend` | **online** (unchanged, not restarted) |

---

## 2. Security audit

| Control | Status |
|---------|--------|
| Port 5432 not public | **Pass** |
| Non-superuser app role | **Pass** |
| Credentials not in Git / report | **Pass** (stored in `/root/.drm-postgres-credentials` only) |
| Supabase production URL | **Not modified** |
| Nginx / UFW / SSH | **Not modified** this phase |
| Backup files permissions | **600**, owner `postgres`, directory **700** |

**Minor note:** `99-drm-local-only.conf` is owned by `root`; PostgreSQL reads it successfully. Optional hardening: `chown postgres:postgres` on that file (cosmetic).

---

## 3. Backup configuration

### 3.1 Strategy

| Requirement | Implementation |
|-------------|----------------|
| Daily automated backup | **Cron** `/etc/cron.d/drm-postgres-backup` — **02:15 UTC** daily |
| Format | **`pg_dump -Fc`** (custom) |
| Naming | `drm_postgres_YYYYMMDD_HHMMSS.dump` |
| Directory | **`/var/backups/postgresql/drm_postgres/`** (mode **700**, owner `postgres`) |
| Retention | **7 days** — deletes only `drm_postgres_*.dump` in that directory |
| Integrity | **`pg_restore -l`** → companion `.list` file; **SHA-256** in `.sha256` |
| Logging | **`/var/log/postgresql/drm-backup.log`** (postgres-owned) |
| Failure reporting | Non-zero exit from cron; failures appended to log with `ERROR:` prefix |

**Script:** `/usr/local/bin/drm-pg-backup-drm_postgres.sh` (mode **755**)

**Explicit:** Does **not** delete or modify backups under `/var/www/DRM_raya/backups/` (manual Supabase export copies).

### 3.2 First automated run (manual trigger)

| File | Size (approx) |
|------|----------------|
| `drm_postgres_20261104_072359.dump` | ~4 KB (empty-ish DB) |
| `drm_postgres_20261104_072359.list` | TOC integrity |
| `drm_postgres_20261104_072359.sha256` | Checksum |

Log excerpt:

```text
[2026-11-04T07:23:59Z] drm-pg-backup: SUCCESS: .../drm_postgres_20261104_072359.dump (4.0K), toc lines: 16
```

### 3.3 Off-server backup (required for real DR)

**On-VPS backups alone are not disaster recovery** if the VPS is lost.

Recommended (pick one or more):

1. **Daily rsync/scp** of `/var/backups/postgresql/drm_postgres/` to another server or S3-compatible storage (encrypted bucket, IAM/scp key restricted).
2. **Restic/Borg** with encryption to remote target, retention aligned with 7+ daily / 4 weekly.
3. After large migration, periodic **encrypted** copy of latest `.dump` to developer secure storage (same policy as manual `.sql` exports).

Document owner, schedule, and restore drill for the off-server copy in Phase 2.

---

## 4. Restore test results

**Pre-check:** ~**55 GB** free on `/` — sufficient for temp restore of current DB and future 1GB+ tests (allow **≥3× dump size** free during migration).

| Step | Result |
|------|--------|
| Create `drm_postgres_restore_test` | **OK** |
| `pg_restore --no-owner --no-acl` from latest `.dump` | **OK** |
| Query schemas `drm`, `public` | **OK** |
| Temp DB size after restore | ~7.6 MB |
| `DROP DATABASE drm_postgres_restore_test` | **OK** (only temp DB removed) |

**Production `drm_postgres` unchanged.**

---

## 5. Resource recommendations (4 vCPU, ~7.8 GiB RAM, ~55 GiB free disk)

**Not applied in this phase** — values below need a **planned PostgreSQL restart** (brief local PG downtime only; does **not** require DRM backend restart if app still uses Supabase).

Assumptions: SSD VPS, single local DB workload, migration batch jobs, `max_connections = 100`.

| Parameter | Current (approx) | Conservative recommendation | Rationale |
|-----------|------------------|----------------------------|-----------|
| `shared_buffers` | 128 MB | **2048 MB** | ~25% of RAM; primary cache |
| `effective_cache_size` | 524288 × 8kB ≈ 4 GB | **6144 MB** | Planner hint ~75% RAM |
| `maintenance_work_mem` | 64 MB | **512 MB** | Index creation / VACUUM during migration |
| `work_mem` | 4 MB | **16 MB** | Sorts/hash per operation; cap concurrent heavy queries during migration |
| `max_connections` | 100 | **100** (keep) | OK; use pooler later if needed |
| `wal_level` | replica | **replica** (keep) | Enables future replication / PITR if needed |
| `max_wal_size` | default | **2 GB** | Reduce checkpoint pressure during bulk load |
| `checkpoint_completion_target` | default | **0.9** | Smoother I/O during migration |
| `random_page_cost` | 4.0 | **1.1** | SSD-appropriate (verify with `rotational` flag on disk) |
| `effective_io_concurrency` | 1 | **200** | SSD parallel read hint |

**Disk for 1GB+ migration:**

- Target data ~**1–2 GB** + indexes/WAL → plan **≥10 GB** headroom on `/var/lib/postgresql` during import.
- Current **~55 GB** free on `/` — **adequate** if logs/dumps monitored.

**Swap:** None configured. For heavy migration, consider **2–4 GB swap file** (optional, low priority) to avoid OOM during peak `COPY` — document before adding.

**Suggested apply method:** New file `/etc/postgresql/16/main/conf.d/99-drm-migration-tuning.conf` + `pg_ctlcluster 16 main restart` in a **scheduled window** (local PG only).

---

## 6. Outstanding risks

| Risk | Mitigation |
|------|------------|
| Backups only on VPS | Implement off-server copy (Section 3.3) |
| No swap | Monitor RAM during migration; optional swap file |
| Single local PostgreSQL instance | No HA; acceptable for staging/migration target until cutover plan exists |
| Two databases (Supabase prod vs local) | Clear env separation; never point production `.env` at local PG until cutover |
| Extension gaps vs MySQL | Extension + type mapping review before import |
| `conf.d` tuning requires restart | Schedule restart; Supabase-backed app keeps running |
| 1GB+ import duration & disk | Pre-flight `df`; run `VACUUM ANALYZE` after import; test restore size on disk |

---

## 7. Verification checklist (this phase)

| Check | Result |
|-------|--------|
| PostgreSQL active | Pass |
| Localhost-only 5432 | Pass |
| `drm_app` privileges | Pass |
| Cron backup installed | Pass |
| Backup + integrity + log | Pass |
| Restore drill | Pass |
| `/var/www/DRM_raya/backups/*` preserved | Pass |
| Supabase / `backend/.env` | Not modified |
| `drm-backend` PM2 | Still online |

---

## 8. Related documents

- [postgres-installation-audit.md](./postgres-installation-audit.md)
- [postgres-installation-report.md](./postgres-installation-report.md)
- Credentials (root only): `/root/.drm-postgres-credentials` — **never commit**
