# PATCH 6 — Production Readiness Checklist (Stage 10, Section F)

Date: 2026-06-22. Status: ✅ verified (executed) · 🟡 partial / code-verified, UAT or
follow-up pending · 🔵 management decision required · ❌ open/blocking.

| # | Checklist item | Status | Evidence / note |
|---|---|---|---|
| 1 | Secrets validated (no hardcoded secrets) | 🟡 | `JWT_SECRET` present in Replit env (len 96), not in source; `DATABASE_URL` injected. **Risk:** `auth.service.ts:6` keeps a `dev-secret` fallback string — recommend hard fail-fast if `JWT_SECRET` unset in prod (SEC-002). |
| 2 | MOCK_AUTH blocked in production | ✅ | `routes.ts:109–115` throws FATAL at boot when `NODE_ENV=production && MOCK_AUTH=true`. |
| 3 | Attributes API protected | ✅ | **EXEC**: anon→401; wrong-role→403; create/delete = FULL_ACCESS (`admin`/`super_hod`). Mounted after global auth. |
| 4 | Action permissions enforced | 🟡 | **EXEC** for `attributes.*` + `gm.create` (14-role matrix). Broader per-mutation adoption not universally verified (SEC-003). |
| 5 | Raw `req.body` removed from critical routes | 🟡 | zod adopted on many handlers; some still raw (VAL-001). |
| 6 | SQL hardened | 🟡 | Values parameterized; dynamic identifier whitelisting incomplete (SQL-001). |
| 7 | Direct `fetch` migrated to shared client | 🟡 | Mostly `apiRequest`/`useQuery`; a few named pages still raw `fetch` (API-001). |
| 8 | Audit / notifications enabled | 🟡 | `AuditLogService`/`ActivityLogService`/domain audit present; some flows fire-and-forget (COM-001) and INV-001 status route **unaudited**. |
| 9 | Support disabled if out of scope | ✅ / 🔵 | **EXEC**: `/api/support/tickets`→404. CODE: nav hidden + `SupportInactive`. 🔵 Mgmt item I: confirm remove vs keep soft-disabled. |
| 10 | Social posting persistent | 🟡 | `drm.social_media_posts`, DRAFT→PENDING→APPROVED; internal/manual; live UAT pending (SOC-001). |
| 11 | Office Accounts real data (no mock/console-only) | 🟡 | All submodules backend-backed; Old Account Head redirected; Trial Balance de-mocked. 🔵 VAS source (item J). UAT pending. |
| 12 | Report export parity verified | 🟡 | `PATCH6_REPORT_EXPORT_PARITY_RESULTS.md` confirms parity. 🔵 source/formula/basis/migration items E/F/K/L. |
| 13 | GM / invoice / project workflow verified | 🟡 / 🔵 | Type routing, partial/loan gates, idempotent project link — code-verified; **EXEC** gm.create RBAC. 🔵 thresholds/timing (A/B). ❌ INV-001 raw status route Open. |
| 14 | Service lifecycle verified | 🟡 / 🔵 | Validators + lifecycle/cross-dept transitions present; SRV-002 partial; 🔵 SRV-001 bridge (item H). |
| 15 | No active mock / no-op screens | 🟡 | Mock/no-op screens addressed; a few "no source" screens render **zero rows** (not mock) — acceptable, but flagged in `REPORT_CATALOG.md`. |
| 16 | Build / type-check pass | ✅ | `npm ci` 0, `npm run check` 0 errors, `npm run build` 0 (chunk advisory only). |
| 17 | Tests pass | ✅ | `npm test` → 219/219 (14 files). |
| 18 | UAT pass | 🟡 | **Direct-API permission UAT executed** (anon 401, cross-role 403/allow). Full **role-based browser UAT PENDING** (no seeded per-role accounts). |
| 19 | Management confirmations recorded | 🔵 | **12 decision items (A–L)** documented in `PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`, gating 8 requirement entries; **none yet confirmed**. |
| 20 | DB schema verified (non-destructive) | ✅ | `drm` present, 508 base tables via `information_schema`; `db:push` known FK issue documented; no destructive ops. |
| 21 | Dependency vulnerabilities | 🟡 | 16 npm-audit (1 low/8 mod/7 high, transitive) — hardening pass recommended. |

## Overall recommendation

**NOT READY for full production sign-off — conditionally ready for a controlled/UAT
environment.**

**Green (executed & passing):** build, type-check, tests, DB schema verification,
MOCK_AUTH production block, attributes API protection, anonymous-access rejection, and
the cross-role action-permission layer (attributes + GM creation).

**Blocking before production sign-off:**
1. **INV-001 (Open)** — route the raw invoice-status PATCH through the workflow service
   with validation + audit.
2. **Management confirmations A–L** — especially **E (salary formula/freeze)** and
   **A (GM thresholds)**; payroll and GM correctness cannot be signed off without them.
3. **Live role-based browser UAT** — execute the per-role walkthroughs (create/approve/
   finalize/export, console-clean check) with seeded accounts; record results.

**Recommended (non-blocking) hardening:** SEC-002 prod fail-fast on missing `JWT_SECRET`;
finish SEC-003/VAL-001/SQL-001/API-001 adoption; dependency-audit remediation; client
bundle code-splitting.
