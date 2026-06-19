# PATCH 5 — Status Transition QA

Legal and illegal transition coverage for each workflow entity. The authoritative
legal-transition maps live in `server/services/workflow-transition.service.ts` and the
per-entity state-machine docs (`GM_BV_STATE_MACHINE.md`, `INVOICE_STATE_MACHINE.md`,
`GM_SALES_CROSS_MODULE_STATE_MACHINE.md`).

**Illegal-transition contract (verified by design):**
1. The API rejects with **400** (illegal transition / incomplete) or **403** (role) or
   **409** (state/dependency).
2. The persisted status **does not change** (the guard runs before the write; no
   partial mutation).
3. The audit/status-history does **not** record a false success — only the rejected
   attempt (where audited) or nothing is written.

Method: **CODE** inspection of transition guards + the existing
`server/workflow-transition.service.test.ts` unit tests; full end-to-end seeded walks
are **MANUAL-PENDING**.

---

## 1. GM entry

**Legal:** `Draft/Pending → Pending HOD → Pending Accounts → Approved`.
- PARTIAL: at/after Accounts → `PARTIAL_PAYMENT_PENDING → Approved` (only when balance 0).
- LOAN: at/after Accounts → `PENDING_ADMIN → Approved` (only when admin-approved).
- Any stage → `Rejected` via the stage's reject action.

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| Pending → Pending HOD (submit) | legal | 200 | by sales initiator/manager |
| Pending HOD → Pending Accounts (HOD approve) | legal | 200 | `hod`/`super_hod` |
| Pending Accounts → Approved (FULL) | legal | 200 | `account_manager` |
| Pending Accounts → PARTIAL_PAYMENT_PENDING | legal | 200 | partial GM |
| PARTIAL_PAYMENT_PENDING → Approved, balance > 0 | **illegal** | **409 PARTIAL_PAYMENT_INCOMPLETE** | status unchanged |
| PENDING_ADMIN → Approved, admin not approved | **illegal** | **409 LOAN_ADMIN_APPROVAL_REQUIRED** | status unchanged |
| Pending → Approved (skip HOD/Accounts) | **illegal** | **400** illegal transition | not in legal map |
| HOD approve by non-HOD role | **illegal** | **403 FORBIDDEN** | status unchanged |
| Create GM by disallowed role | **illegal** | **403 FORBIDDEN** | no row inserted |

## 2. Invoice

**Legal:** `Draft → Submitted (HOD) → HOD Approved → Account Approved → Paid`; reject
at HOD or Accounts → `Rejected`.

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| Draft → Submitted to HOD | legal | 200 | creator/owner |
| Submitted → HOD Approved | legal | 200 | `hod`/`super_hod`; readiness enforced |
| HOD Approved → Account Approved | legal | 200 | `account_manager` |
| Account Approved → Paid | legal | 200 | requires payment method + reference + amount |
| Approve with missing customer / amount=0 / no type | **illegal** | **400 INCOMPLETE_INVOICE** | `assertApprovalReadiness`; status unchanged |
| Account approve before HOD approve | **illegal** | **400/409** illegal transition | not in legal map |
| Mark Paid without payment/proof | **illegal** | **400** | `workflowMarkPaidSchema` |
| HOD/Account action by wrong role | **illegal** | **403 FORBIDDEN** | unchanged |

## 3. Project (from approved invoice)

**Legal:** approved invoice → `createOrLinkProjectForApprovedInvoice` → one
`INVOICE_ROOT` project at configured initial status (default `Active`; `OnHold` if PP
dependency enabled & unmet). Department by invoice type.

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| Approved invoice → generate project | legal | 200, one project | idempotent |
| Generate project twice for same invoice | legal (idempotent) | 200, **same** project | no duplicate created |
| Generate project from non-approved invoice | **illegal** | **400 GENERATION_FAILED** | no project created |
| Generate project by disallowed role | **illegal** | **403 FORBIDDEN** | none created |

## 4. Product Posting dependency

**Legal:** assign Product-Posting task when dependency disabled (default) or when the
linked Listing-Page QA is approved.

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| Assign PP, dependency off (default) | legal | 200 | no Listing-QA prerequisite |
| Assign PP, dependency on & Listing QA approved | legal | 200 | dependency satisfied |
| Assign PP, dependency on & Listing QA pending | **illegal** | **409 LISTING_QA_PENDING** | not assigned; project stays `OnHold` |
| Assign PP by role outside guard | **illegal** | **403 FORBIDDEN** | unchanged |

## 5. QA (Listing Page / Product Posting)

**Legal:** `qa-review` (approve) by `qa_manager`/`admin` → task `QA_COMPLETE`; on
Listing-Page QA approval, held PP dependency rows are released (best-effort).

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| qa-review approve | legal | 200 → QA_COMPLETE | `qa_manager`/`admin` |
| qa-review by non-QA role | **illegal** | **403 FORBIDDEN** | phase unchanged |

## 6. Verification

**Legal:** `QA_COMPLETE → VERIFICATION_PENDING → VERIFICATION_COMPLETE` via
`verification-review` by `verification_manager`/`admin`. Lifecycle **labels** are
config-aware (`verificationManagerRequiredAfterQa`); **transition logic unchanged** in
this patch.

| Transition | Type | Expected | Notes |
|-----------|------|----------|-------|
| VERIFICATION_PENDING → VERIFICATION_COMPLETE | legal | 200 | `verification_manager`/`admin` |
| verification-review by wrong role | **illegal** | **403 FORBIDDEN** | phase unchanged |
| Complete when not in VERIFICATION_PENDING | **illegal** | **400** illegal transition | unchanged |

---

## Summary

Legal transitions succeed for the correctly-configured role; illegal transitions are
rejected with **400/403/409**, leave persisted status untouched, and do not write a
false-success audit entry. Transition enforcement is centralised in
`workflow-transition.service.ts` and covered by its unit tests; full seeded end-to-end
transition walks are recommended as a manual pass before production sign-off.
