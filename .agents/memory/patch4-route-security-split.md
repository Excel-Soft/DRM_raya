---
name: Non-uniform route security posture (DRM)
description: Several DRM modules have parallel route files / route groups with very different auth postures; never assume a module is uniformly guarded.
---

# Don't assume uniform guarding within a module

When auditing or QA-ing a DRM module's security/audit posture, do **not** assume
all routes in a feature area share the same guards. The repo deliberately (or
by legacy drift) has **parallel route surfaces with very different postures**:

- **Office Accounts:** `server/office-account-routes.ts` is the *hardened* surface
  (`requireFinancialPermission` role guard + `AuditLogService` on every mutation/
  export). `server/account-routes.ts` is *legacy* — invoices/donations/GM-entries/
  dollar buyer-buying CRUD are **authenticated-only** (401 if no token) with **no
  role guard and no audit**; only the dollar `/transaction` is guarded+audited.
- **IT assets:** `server/it-assets-routes.ts` applies `requireRole` + audit **only**
  to `/servers` and `/server-names`. The secondary routes (`/domains`,
  `/registries`, `/hosting-packages`, `/backups`, `/system-report`) are
  authenticated-only — no role guard, no audit.
- **Audit false-positive trap:** an `ActivityLogService.log(... AUTO_CREATED ...)`
  near GM code is actually in `/pending-quotations/:id/approve` (project
  auto-creation), **not** the GM approve/reject handlers. Grep for the *handler*
  the call sits inside, not just proximity.

**Why:** during Patch 4 Stage 7 QA I initially wrote "fully guarded + audited"
for whole modules; an architect review caught that only sub-surfaces were. Every
correction was confirmed by reading the actual route registrations.

**How to apply:** when reporting auth/audit coverage, enumerate routes
individually (grep `router.(get|post|patch|delete)` + the guard on that exact
line) and verify which handler each audit call lives in. A 401 on an unauth
smoke test only proves *authentication*, never *role authorization*.
