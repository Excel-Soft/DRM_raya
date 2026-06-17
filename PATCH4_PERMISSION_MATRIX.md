# Patch 4 — Permission Matrix (ISS-01/02/03/04)

Role-vs-action authorization across all Patch 4 modules, as enforced in code.
This stage **did not change or weaken any permission** — it documents current
enforcement and flags gaps.

## Enforcement layers
1. **Authentication (global):** all `/api/*` (except the deactivated `/api/support/*`,
   which returns 404) require a valid JWT → unauthenticated requests get **401**
   (verified by smoke test).
2. **Role authorization:** per-module, via `requireFinancialPermission` (Office
   Accounts hardened routes), `requireRole` (IT), or per-handler `forbidden()`/403
   + scoping (Social Media / Social Accounts).
3. **UI gating:** sidebar / route guards hide entries the role cannot use (defence
   in depth, not the security boundary — the server is).

Legend: ✅ allowed · ❌ denied (403) · — n/a.

---

## A. Office Accounts — hardened routes (`server/office-account-routes.ts`)
`FINANCIAL_WRITE_ROLES = [admin, account_manager]`;
`STAGE2_FINANCIAL_ROLES = [admin, account_manager, super_hod]` for account-heads,
journal-voucher, and ledger. All other roles → 403. All actions audited.

| Action (key) | admin | account_manager | super_hod | other roles |
|---|---|---|---|---|
| account_head.create/update/delete/export | ✅ | ✅ | ✅ | ❌ |
| journal_voucher.create/post/cancel | ✅ | ✅ | ✅ | ❌ |
| ledger.post/reverse/export | ✅ | ✅ | ✅ | ❌ |
| expense.create/delete/export | ✅ | ✅ | ❌ | ❌ |
| cheque.create/status_update/delete | ✅ | ✅ | ❌ | ❌ |
| vas.create/delete | ✅ | ✅ | ❌ | ❌ |
| business_customer.create/delete | ✅ | ✅ | ❌ | ❌ |
| dollar_system.transaction | ✅ | ✅ | ❌ | ❌ |

## B. Office Accounts — legacy routes (`server/account-routes.ts`) — ⚠️ GAP
These enforce **authentication only**. There is **no role guard and no 403**
except `dollar_system.transaction`. Documented as a finding (not changed here).

| Action | Authn required | Role-gated | Audited |
|---|---|---|---|
| invoices create/edit/status/delete | ✅ (401) | ❌ none | ❌ none |
| donations create/delete | ✅ (401) | ❌ none | ❌ none |
| gm-entries create/approve/reject/delete | ✅ (401) | ❌ none | ❌ none (the nearby `ActivityLogService.log` is on `/pending-quotations/:id/approve`, not GM) |
| dollar buyers/buying create/delete | ✅ (401) | ❌ none | ❌ none |
| dollar transaction | ✅ (401) | ✅ `requireFinancialPermission` | ✅ `AuditLogService.record` |

> **Signoff note:** invoices may be governed upstream by the quotation/HOD/account
> approval workflow, so "no in-route role guard" is not necessarily an open hole,
> but it is **inconsistent** with the hardened Office Accounts routes and should be
> confirmed by the business / addressed in a follow-up hardening task.

---

## C. Domain Hosting / Server Names (`server/it-assets-routes.ts`)
`requireRole(...)` is applied **only** to the Server Names routes
(`/servers`, `/server-names`). The secondary IT surfaces (`/domains`,
`/registries`, `/hosting-packages`, `/backups`, `/system-report`) are
authenticated-only (no role guard, no audit).

| Action | IT_READ_ROLES (admin, super_hod, it_manager, it_admin, domain_manager, developer, …) | IT_WRITE_ROLES (admin, super_hod, it_manager, it_admin, domain_manager) | other authenticated roles |
|---|---|---|---|
| list/get servers, server-names | ✅ | ✅ | ❌ (403) |
| create / update / status / delete server | — | ✅ | ❌ (403) |
| list/create domains, registries, hosting-packages, backups, system-report | ✅ | ✅ | ⚠️ also ✅ (no role guard) |

Server-name write actions audited (`it_server.*`); domains/secondary surfaces are
**not** audited. Unauthenticated → 401 on all.

---

## D. Social Media Posting (`server/social-media-routes.ts`)
Per-handler `forbidden()`/403 + scoping. Full = `admin`, `super_hod`;
managers = `product_posting_manager`, `dd_manager`, `marketing_manager`,
`seo_smm_manager`; approvers = HOD/admin.

| Action | Full (admin/super_hod) | Manager (dept scope) | Creator (self) | Approver (HOD) | other |
|---|---|---|---|---|---|
| view posts | ✅ all | ✅ dept | ✅ own | ✅ dept | ❌ |
| create draft / edit / submit | ✅ | ✅ managed | ✅ own | ✅ own | ❌ |
| approve / reject (PENDING) | ✅ | ❌ (unless approver) | ❌ | ✅ dept, not own | ❌ |
| schedule / publish (APPROVED) | ✅ | ✅ managed | ✅ own | ✅ own | ❌ |
| cancel / delete | ✅ | ✅ managed | ✅ own | ✅ own | ❌ |

Cannot approve own post; approvals are department-scoped. All transitions audited
+ notified. Social Accounts: full roles manage all; managerial roles scoped;
cross-scope mutation → 403; best-effort audit.

---

## E. Support (`/api/support/*`) — deactivated (ISS-02)
While `SUPPORT_MODULE_ENABLED` is OFF, the entire surface returns **404** for all
roles (gate ahead of auth). No role can reach it. Reversible via config.

| Role | Support API | Support UI |
|---|---|---|
| any (admin … executive) | ❌ 404 | ❌ Inactive page / hidden nav |

---

## Summary
- **No permissions weakened** in this stage.
- **Strongly enforced + audited:** Office Accounts (hardened routes), Domain
  Hosting, Social Media/Accounts.
- **Gap flagged:** legacy `account-routes.ts` (invoices/donations/gm/dollar
  ancillary) is authenticated-only with inconsistent audit — confirm or harden in
  a follow-up.
