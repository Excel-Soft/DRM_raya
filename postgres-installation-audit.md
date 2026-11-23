# PostgreSQL Installation Audit — Contabo VPS

**Audit date:** 2026-11-04 (UTC)  
**Host role:** DRM production (Express + Nginx + PM2)  
**Mode:** Read-only inspection before local PostgreSQL install.

---

## 1. Operating system

| Item | Value |
|------|--------|
| OS | Ubuntu 24.04.5 LTS (Noble Numbat) |
| Kernel | Linux (Contabo VPS) |

---

## 2. CPU and memory

| Resource | Value |
|----------|--------|
| CPU cores | 4 |
| RAM total | 7.8 GiB |
| RAM used | ~1.4 GiB |
| RAM available | ~6.4 GiB |
| Swap | 0 B (none configured) |

**Assessment:** Sufficient RAM for a dedicated local PostgreSQL instance alongside the current Node backend.

---

## 3. Disk

| Mount | Size | Used | Available | Use% |
|-------|------|------|-----------|------|
| `/` (`/dev/sda1`) | 72 GB | 17 GB | 55 GB | 24% |

Notable paths:

- `/var/www/DRM_raya` — ~1.3 GB (application codebase + frontend build artifacts)

**Assessment:** Plenty of free space for PostgreSQL data directory and WAL.

---

## 4. Running services (production-relevant)

| Service | Status |
|---------|--------|
| `nginx.service` | **active (running)** — ports 80, 443 |
| `pm2-root.service` | **active (running)** |
| `ssh.service` | **active (running)** — port 22 |
| `drm-backend` (PM2) | **online** — ~22h uptime, port **5001** |
| `mysql.service` / `mariadb.service` | **inactive** (not installed/running on this host) |
| `postgresql.service` | **inactive** (server not installed) |

No separate Next.js process detected; frontend is served via Nginx static build. Backend is Express on port 5001.

---

## 5. MySQL / MariaDB

- **Not running** on this VPS.
- No local MySQL migration risk from installing PostgreSQL.
- Current production app DB (per existing deployment) uses **remote Supabase PostgreSQL** via `DATABASE_URL` in application env — **not** modified by this task.

---

## 6. Existing PostgreSQL

| Component | Status |
|-----------|--------|
| PostgreSQL **server** | **Not installed** |
| `postgresql-client-16`, `postgresql-client-17` | Installed (CLI only, from earlier backup tooling) |
| Port **5432** | **Not listening** |

**Assessment:** No conflicting PostgreSQL server instance. Safe to install fresh server bound to localhost.

---

## 7. Node / application stack

| Process | Notes |
|---------|--------|
| `node .../DRM_raya/backend/dist/index.js` | PM2 `drm-backend`, port 5001 |
| Cursor remote helper processes | IDE only, localhost |

---

## 8. Firewall (UFW)

- **Status:** inactive  
- No UFW rules applied on this host at audit time.

---

## 9. Listening ports (summary)

| Port | Bind | Process / purpose |
|------|------|-------------------|
| 22 | 0.0.0.0 / :: | SSH |
| 80, 443 | 0.0.0.0 | Nginx (HTTP/HTTPS) |
| 5001 | * (all interfaces) | DRM Express API |
| 53 | 127.0.0.53 / 127.0.0.54 | systemd-resolved |
| 5432 | — | **Not in use** |

---

## 10. Safety checklist (pre-install)

| Check | Result |
|-------|--------|
| Sufficient RAM | **Pass** (~6.4 GiB available) |
| Sufficient disk | **Pass** (~55 GiB free) |
| Conflicting PostgreSQL server | **Pass** (none) |
| MySQL running (must not stop) | **N/A** (not present) |
| Risk of port 5432 public conflict | **Low** (port free; will bind localhost only) |

---

## 11. Recommendation

**Proceed** with installation of PostgreSQL **16** (Ubuntu/PGDG stable for Noble), localhost-only, new database `drm_postgres` and role `drm_app`, without changing Nginx, application `.env`, or remote Supabase production connection.

---

## 12. Explicit non-goals (this task)

- No MySQL install/stop/migrate  
- No Nginx config changes  
- No application `.env` changes  
- No UFW rule changes  
- No SSH changes  
- No server reboot  
