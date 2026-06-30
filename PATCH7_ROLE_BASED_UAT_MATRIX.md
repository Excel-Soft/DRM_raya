# PATCH 7 — Role-Based UAT Matrix (Stage 8, Section F · UAT-004)

**Date:** 2026-06-30. Per-role expectations across protected-API access, route
visibility, CRUD, approve/reject, export, finalize, and workflow transitions.

**Evidence legend:** **LIVE** = executed HTTP probe this session (minted-JWT harness
`.local/uat8.mjs`, corroborated by server `AUTH_MW`/status logs) · **P6-LIVE** =
executed on the byte-identical codebase in the prior session · **CODE** = source
guard inspection · **UAT(browser)** = per-role browser login walkthrough.

> **Honest scope:** This environment cannot drive a real per-role **browser login**
> walkthrough. The **API-level** cross-role permission matrix below is **executed**;
> the **browser UI** dimension of each row is **PENDING** and tracked by **UAT-004
> (Open)**. An API matrix is necessary but, per `PATCH7_DEFINITION_OF_DONE.md` #10,
> not sufficient for "Complete".

## A. Executed API permission results (LIVE this session)

| Actor (role claim) | Probe | Expected | Got | Result |
|---|---|---|---|---|
| anonymous | GET `/api/customers` | 401 | 401 | ✅ |
| anonymous | GET `/api/invoices` | 401 | 401 | ✅ |
| anonymous | GET `/api/audit-logs` | 401 | 401 | ✅ |
| anonymous | GET `/api/penalties` | 401 | 401 | ✅ |
| anonymous | GET `/api/users` | 401 | 401 | ✅ |
| anonymous | GET `/api/target-system/targets` | 401 | 401 | ✅ |
| anonymous | GET `/api/accounts/dashboard/gm-summary` | 401 | 401 | ✅ |
| admin | GET `/api/audit-logs` | 200 | 200 | ✅ |
| super_hod | GET `/api/audit-logs` | 200 | 200 | ✅ |
| hod | GET `/api/audit-logs` | 403 | 403 | ✅ |
| account_manager | GET `/api/audit-logs` | 403 | 403 | ✅ |
| sales_executive | GET `/api/audit-logs` | 403 | 403 | ✅ |
| admin | GET `/api/audit-logs?action=login` | 200 | 200 | ✅ |
| admin | GET `/api/audit-logs?module=penalty` | 200 | 200 | ✅ |
| admin | GET `/api/audit-logs?dateFrom=not-a-date` | 400 | 400 | ✅ |
| sales_executive | POST `/api/penalties` | 403 | 403 | ✅ |
| sales_executive | PATCH `/api/penalties/:id/approval` | 403 | 403 | ✅ |
| service_executive | POST `/api/penalties` | 403 | 403 | ✅ |

**18/18 executed checks passed.** Server log corroboration: `AUTH_MW … normalizedRole="…"`
lines with matching 401/403/200/400 statuses.

## B. Per-role UAT matrix (expectations + evidence state)

| # | Role | Protected API | Route visibility | Create/Update/Delete | Approve/Reject | Export | Finalize | Workflow transition | API evidence | Browser UAT |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | anonymous | all 401 | none | — | — | — | — | — | **LIVE 401** | n/a |
| 2 | admin | full | full | full | full | full | full | full | LIVE (audit 200) | PENDING |
| 3 | super_admin | full | full | full | full | full | full | full | CODE | PENDING |
| 4 | super_hod | full (audit 200) | full | full | financial/HR approve | full | loan/GM final approve | full | LIVE (audit 200) | PENDING |
| 5 | HOD | dept-scoped; **audit 403** | dept | dept | dept approve | dept | invoice HOD approve | dept | LIVE (audit 403) | PENDING |
| 6 | account_manager / accounts_office | accounts; **audit 403** | accounts | accounts | invoice accounts approve | accounts | invoice final approve | invoice→project | LIVE (audit 403) | PENDING |
| 7 | sales_executive | sales; **audit 403**, **penalty 403** | sales | GM create (own) | **deny** approve | own | **deny** | GM create | LIVE (403s) | PENDING |
| 8 | sales_manager | sales mgmt | sales | GM mgmt | GM approve (per policy) | sales | per policy | GM | CODE / P6-LIVE | PENDING |
| 9 | service_executive | service; **penalty 403** | service | service lifecycle | **deny** approve | service | — | service lifecycle | LIVE (penalty 403) | PENDING |
| 10 | service_manager | service mgmt | service | service mgmt | service approve | service | — | service lifecycle | CODE | PENDING |
| 11 | PMS / project_manager | pms | pms | pms tasks | pms approve | pms | project finalize | pms transitions | CODE | PENDING |
| 12 | product_posting_manager | product | product | product | posting approve | product | — | posting workflow | CODE | PENDING |
| 13 | product_posting_executive | product (scoped) | product | posting (gated by QA dep) | deny | — | — | posting (blocked if QA pending — QA-002) | CODE | PENDING |
| 14 | DD manager | dd | dd | dd approvals (backend-driven; no localStorage) | dd approve | dd | — | dd workflow | CODE | PENDING |
| 15 | DD executive | dd (scoped) | dd | dd entries | deny | — | — | dd workflow | CODE | PENDING |
| 16 | software_manager | software | software | software | software approve | software | — | software workflow | CODE | PENDING |
| 17 | software_executive | software (scoped) | software | software entries | deny | — | — | software workflow | CODE | PENDING |
| 18 | QA manager | qa | qa | qa | listing-page QA approve | qa | — | QA gate (feeds QA-002) | CODE | PENDING |
| 19 | verification manager | verification | verification | verification (backend-driven) | verify approve | — | — | verification workflow | CODE | PENDING |
| 20 | HR manager | hr | hr | hr/attendance | leave/overtime approve | salary/attendance | salary finalize (freeze) | hr workflow | CODE | PENDING |
| 21 | IT manager | it | it | domains/servers CRUD | — | export | — | — | CODE | PENDING |
| 22 | ordinary employee | self-scoped | minimal | own requests | **deny** | — | — | — | CODE | PENDING |

## C. Outstanding for UAT-004 closure
1. Per-role **browser login** walkthrough for rows 2–22 (sidebar visibility, direct
   route access, allow/deny on create/approve/export/finalize/transition), results
   recorded with screenshots/logs.
2. Management confirmations (Section H register) that define allow/deny for the
   policy-dependent rows (GM creation/thresholds/timing, service-exec GM, product
   posting QA dependency, support disposition).

**UAT-004 = Open** (API matrix executed; browser walkthrough pending).
