# PATCH 6 — Definition of Done (DoD)

A Patch 6 requirement is **Complete only when every applicable criterion below is met and
evidenced**. Partial work stays Open/Partial in the traceability matrix. No mock/fake
fallback data may be used to satisfy any criterion. Evidence means a concrete artifact:
file/line reference, request/response sample, screenshot, or recorded UAT step.

## DoD checklist (per requirement)

1. **Frontend action connected to a real API**
   - The UI control triggers a real backend call via the shared `apiRequest`/`useQuery`
     client (no orphaned `onClick`, no `console.log`-only handlers, no direct `fetch`
     unless justified).
   - Evidence: page file + handler + endpoint.

2. **Backend API authenticated and action-permission protected**
   - Route sits **behind global auth** and enforces an **action-level** permission
     (`requirePermission` / `requireRole` / domain guard), not just token validity.
   - Evidence: route registration order + guard reference; anon and wrong-role calls
     return 401/403.

3. **DB persistence implemented**
   - Writes land in the correct `drm` table via Drizzle/parameterized SQL; reads reflect
     persisted state across reloads. No in-memory/local-only state for business data.
   - Evidence: table name + insert/update/select.

4. **Strict validation schema**
   - All mutating handlers validate input with zod (`parse`/`safeParse`); invalid input
     returns **400** with field-level errors. No raw `req.body` spread into inserts.
   - Evidence: schema name + handler.

5. **Workflow state machine / central service**
   - Status changes go through the workflow/transition service and (where cross-module)
     the central `CrossDepartmentStatusService`; illegal transitions are rejected. No raw
     status mutation routes.
   - Evidence: service call + rejection path.

6. **Reports / dashboards / notifications update**
   - The action is reflected in the relevant report/dashboard, and notifications fire
     where required; list and export outputs match (export parity).
   - Evidence: report endpoint + matching CSV/columns.

7. **Audit log with actor / time / old → new / reason**
   - Every state-changing action records an audit entry (actor, timestamp, before/after,
     reason) via `AuditLogService` / `ActivityLogService` / domain audit. Denied attempts
     are recorded where the guard supports it.
   - Evidence: audit call + sample row fields.

8. **Loading / empty / error / success UI states**
   - The page handles all four states; errors are shown as friendly messages (no raw
     backend error text leaked, no silent failures).
   - Evidence: state handling in the page.

9. **Role-based UAT evidence**
   - The scenario is executed for each relevant role (allowed and denied) in the running
     app, with results recorded.
   - Evidence: recorded UAT steps/screenshots per role.

10. **Management confirmation for business rules**
    - Any threshold, formula, timing, ownership, or module-retention rule is confirmed by
      management before the dependent requirement is closed (see
      `PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`).
    - Evidence: written confirmation referenced in the matrix.

## Governance rules
- **Evidence-based only:** no requirement is marked Complete without the artifacts above.
- **Unexecuted UAT is PENDING**, never a fabricated pass.
- **No permission weakening** and **no mock/fallback data** may be introduced to pass DoD.
- A requirement touching multiple layers is only as done as its weakest unmet criterion.
