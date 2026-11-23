# Source backup integrity (read-only audit)

**File path:** `/var/www/DRM_raya/old_drm_database.sql`  
**Audit date:** 2026-11-04 (Phase 2B pre-import)

## File checks

| Check | Result |
|-------|--------|
| Exists | Yes |
| Readable | Yes |
| Modified in Phase 2B | **No** (read-only operations only) |
| Size | **944,506,447 bytes** (~901 MiB) |
| Permissions | `-rw-r--r--` root:root |

## SHA-256 checksum (baseline)

```
09e81ddbfb663e1ddc37a913d41cd656a78fa849b959f295836fca0df25102ba
```

Re-verify after Phase 2B:

```bash
sha256sum /var/www/DRM_raya/old_drm_database.sql
```

## Header metadata (from file head)

| Field | Value |
|-------|--------|
| Format | phpMyAdmin SQL dump 5.2.1 |
| Server | MariaDB **10.3.39** |
| Database name | **`ndrm`** |
| Charset | utf8mb4 |
| Generation | 2026-11-03 |

## Table inventory

- **166** `CREATE TABLE` statements (see Phase 1A audit).
- **18,904** `INSERT INTO` statements (not equal to row counts).

## Disk capacity (pre-import)

| Mount | Available |
|-------|-----------|
| `/` | ~54 GiB free (sufficient for MariaDB temp + PostgreSQL archive growth) |

## Estimated archive storage

Order-of-magnitude: source **~0.9 GiB** SQL text → PostgreSQL TEXT archive often **1–3×** depending on expansion; well within free space.

## Import mechanism selected

See [`18-archive-import-execution.md`](./18-archive-import-execution.md): **temporary MariaDB 10.x on localhost** (no Docker on host) → Python stream to `legacy_archive` on **`drm_legacy_stage` only**.
