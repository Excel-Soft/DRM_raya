# PATCH 7 — Final QA Scenarios (Stage 8, Section G)

**Date:** 2026-06-30. The 18 mandatory scenarios. Status legend: **EXECUTED** (live
probe this session) · **CODE** (logic verified in source) · **PENDING-UAT** (browser
walkthrough not executed here) · **NMC** (needs management confirmation).

| # | Scenario | Status | Evidence / notes |
|---|---|---|---|
| 1 | Anonymous attempts every protected API → 401/403 | **EXECUTED ✅** | 7-endpoint anon sweep all 401 (`/api/customers,invoices,audit-logs,penalties,users,target-system/targets,accounts/dashboard/gm-summary`); server `AUTH_MW` logs corroborate |
| 2 | Unauthorized role attempts sensitive approve/reject/delete/export → 403 | **EXECUTED ✅** | sales_exec POST `/api/penalties` 403; sales_exec PATCH penalty approval 403; service_exec POST penalty 403; hod/account_manager/sales_exec on audit viewer 403 |
| 3 | Sales Exec valid/invalid GM entries; invalid fail with clear errors | **CODE + PENDING-UAT** | zod DTOs on GM write paths; invalid body → 400. Browser create flow pending |
| 4 | Service Exec GM/invoice participation functional or hidden/disabled per mgmt | **NMC** | GM-009/SRV-001 — Service-GM **OFF** by default; final policy needs mgmt decision |
| 5 | Full / Partial / Loan GM each follow approved workflow path | **CODE + PENDING-UAT** | `resolveCanonicalGmType` + type routing (GM-002); per-type browser UAT pending |
| 6 | Partial GM receipt collection blocks final approval until all-paid | **CODE + PENDING-UAT** | `enforceLoanPartialFinalApprovalGate` → `PARTIAL_PAYMENT_INCOMPLETE` (GM-004) + AUTO test; browser UAT pending |
| 7 | Loan GM needs terms, Admin approval if configured, return-date + overdue | **CODE (partial) + NMC** | `gm_loan_terms.admin_approval_status` → 409 if not APPROVED (GM-005); **overdue rules NMC** (GM-006) |
| 8 | Invoice HOD/Accounts approval rejects invalid role/stage/customer/proof/amount/type/duplicate | **CODE + PENDING-UAT; INV-001 open** | `assertApprovalReadiness` + duplicate guard `findActiveDuplicate` (INV-002). **INV-001 raw status PATCH remains Open** (not state-machine-bound) |
| 9 | Final Accounts invoice approval creates/links exactly one project | **CODE + PENDING-UAT** | `createOrLinkProjectForApprovedInvoice` + unique `uq_projects_invoice_root` (INV-003) + AUTO; browser UAT pending |
| 10 | Product Posting cannot start before Listing-Page QA approval (if dep enabled) | **NMC** | `assertProductPostingDependencySatisfied` gate exists; dependency **default false** → QA-002 needs mgmt decision |
| 11 | Server Names add/edit/delete/list persists after refresh | **CODE + PENDING-UAT** | `it-assets-routes.ts` CRUD persists to `drm` (DOM-002); browser refresh UAT pending |
| 12 | Support module hidden/disabled if out of scope | **EXECUTED (P6-LIVE) + NMC** | `/api/support/*` → 404; nav hidden; `SupportInactive` page. Final remove-vs-retain = mgmt (SUP-001) |
| 13 | Social Media create/edit/delete/schedule/list persists + updates dashboard | **CODE + PENDING-UAT** | `social-media-routes.ts` approval+publishing state machines persist to `drm.social_media_posts` (SOC-001); external publish out of scope by design (SOC-EXT-001 NMC) |
| 14 | Every retained Office Accounts submodule uses real backend data | **CODE + PENDING-UAT** | `office-account-routes.ts` table-backed (expenses, chart-of-accounts, trial balance, ledger); legacy heads redirect (OFF-002) |
| 15 | Raw Attendance, Salary, Event, Reception, Daily Target, Diagnosis, BV reports show filtered data + matching exports | **CODE + PENDING-UAT; formulas NMC** | export parity in `PATCH7_REPORT_EXPORT_PARITY_RESULTS.md`; **salary/BV/attendance/day-target formulas NMC** (REP-002/004/005) |
| 16 | Service followups/complaints/dropouts/renewals validate required fields + update reports/status | **CODE + PENDING-UAT** | `service-core-routes.ts` validators + rich audit (SRV-002) |
| 17 | No browser console errors in critical flows | **PENDING-UAT** | current console clean (only `[vite] connecting/connected`); per-flow walkthrough pending |
| 18 | Audit logs + notifications exist for major transitions | **EXECUTED ✅** | audit viewer `GET /api/audit-logs` live (admin/super_hod 200; filters by action/module; invalid date 400); event coverage in `PATCH7_AUDIT_NOTIFICATION_EVENT_MAP.md` (AUD-001) |

## Roll-up
- **EXECUTED (pass):** #1, #2, #18 (+ #12 via P6-LIVE).
- **CODE-verified, browser-UAT pending:** #3, #5, #6, #8, #9, #11, #13, #14, #15, #16.
- **Needs Management Confirmation:** #4, #7 (overdue), #10, #12 (disposition), #15 (formulas).
- **Open defect surfaced:** #8 → **INV-001** (raw invoice status route not bound to the
  workflow/audit state machine) — highest residual risk.
- **Console health:** clean in idle; #17 closure needs per-flow browser UAT.
