# Patch 4 — Domain Hosting / Server Names QA Matrix (ISS-01 / ISS-01b)

Stage 7 QA for the Domain Hosting / Server Names module. Verification +
documentation only — no logic changed.

- **Frontend:** `client/src/pages/it-servers.tsx` (`/it/servers`,
  `/it/server-names` alias), `client/src/pages/it-domains.tsx` (`/it/domains`).
- **Backend:** `server/it-assets-routes.ts` (mounted at `/api/it`).

## ⚠️ Important: guard coverage is NOT uniform across this module
Only the **Server Names** routes (`/api/it/servers`, `/api/it/server-names`) are
role-guarded with `requireRole(...)` and audited. The **secondary IT surfaces**
(`/domains`, `/registries`, `/hosting-packages`, `/backups`, `/system-report`)
have **no `requireRole` guard and no audit** — they enforce only global
authentication (verified: unauthenticated → 401), so any authenticated user
regardless of role can read/write them. This matches the issue matrix split:
**ISS-01 (P0) = Server Names** (hardened) vs **ISS-01b (P0) = Domains**
(secondary, not hardened to the same level).

## Verification legend
✅ Code-verified · 🟡 Manual run pending · ❌ Gap found · n/a.

## Automated evidence
- `npm run check` 0 errors · `npm run build` success · `npm test` 154 passed.
- Unauthenticated smoke: `GET /api/it/servers` → **401**,
  `/api/it/server-names` → **401**, `/api/it/domains` → **401** (auth required;
  role authorization is a separate matter — see below).

## A. Server Names (`/api/it/servers`, `/api/it/server-names`) — ISS-01 (P0)

| Test | Status | Evidence |
|---|---|---|
| Page loads, no crash | ✅ (code) / 🟡 (visual) | Routes registered; `it-servers.tsx` has loading/empty/error states (Stage 4 crash fix). Per-role visual render pending login. |
| Create server name | ✅ | `POST` → `createServerHandler`, `requireRole(...IT_WRITE_ROLES)`. |
| Edit server name | ✅ | `PATCH /:id` → `updateServerHandler`, write-role gated. |
| Duplicate server rejected | ✅ | `findActiveServerByName(name)` on create; `findActiveServerByName(name, id)` (excludes self) on update. |
| Invalid IP/host rejected | ✅ | `isValidHost(host)` validates IPv4 / loose IPv6 / RFC hostname; 400 on failure. |
| Status update | ✅ | `PATCH /:id/status`, write-role gated, audited (`it_server.status_change`). |
| Soft delete / disable | ✅ | `DELETE /:id` → `softDeleteServer`; sets `deletedAt`; deleted rows 404 on re-read. No hard delete. |
| Permission blocked | ✅ | Unauthenticated → 401. Non-IT roles → 403 via `requireRole(...IT_WRITE_ROLES)`. Per-role 403 confirmation pending login (🟡). |
| Audit created | ✅ | `AuditLogService.record`/`recordTransition` for `it_server.create/update/status_change/delete`. |

**Result: PASS (code-verified).**

## B. Domains & secondary IT surfaces (`/api/it/domains`, `/registries`, `/hosting-packages`, `/backups`, `/system-report`) — ISS-01b

| Test | Status | Evidence |
|---|---|---|
| Domain list loads | ✅ | `it-domains.tsx` fetches real data from `GET /api/it/domains` (TanStack Query); has loading + "No domains found" empty state. |
| Create domain | ⚠️ auth-only | `POST /domains` exists but is **not** `requireRole`-guarded (authenticated only). |
| Role permission enforced | ❌ GAP | `/domains`, `/registries`, `/hosting-packages`, `/backups`, `/system-report` have **no `requireRole`** — any authenticated role can access. |
| Audit created | ❌ GAP | No `AuditLogService` calls on these routes. |
| Export (Excel/CSV/PDF) | ❌ FAKE SUCCESS | `it-domains.tsx` `handleExport` shows a `setTimeout` "exported successfully" toast **without generating or downloading any file** (lines 38–45). Copy and Print are real; Excel/CSV/PDF are fake. |
| Quotation amount | ❌ STATIC | The "Invoice Quotation" dialog renders a hardcoded `0.00` total with a non-functional "Generate Quotation" button (line 303). |
| Filter inputs (company/person/contact/email) | ⚠️ | Top filter inputs are decorative (no `value`/`onChange` wiring); only the table "Search" box filters. |

**Result: PARTIAL — FLAG.** Domain list rendering is real, but role authorization
and audit are missing, and the export + quotation features are fake/static.

## Notes / findings (carry to Final Report)
1. **Role-authz + audit gap** on `/domains`, `/registries`, `/hosting-packages`,
   `/backups`, `/system-report` (authenticated-only). The P0 Server Names surface
   is properly hardened; the secondary surfaces are not.
2. **Fake export success** and **static `0.00` quotation** in `it-domains.tsx`
   (pre-existing, not introduced this stage) — flagged, not changed.
3. **Notifications:** none emitted for this module (none required).
