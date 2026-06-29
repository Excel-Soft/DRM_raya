# PATCH 7 — DEFINITION OF DONE

**Stage:** Patch 7 — Stage 0. **Date:** 2026-06-29.

A Patch 7 requirement is **Complete** only when **every** applicable criterion
below is satisfied **and evidenced**. Code that satisfies the logic but lacks
executed UAT is **In Progress**, not Complete. Business-rule items lacking a
recorded management decision are **Needs Management Confirmation**, regardless of
code state. No requirement may be marked Complete on the strength of code
inspection alone where UAT or management sign-off is applicable.

---

## Core completion criteria

1. **Frontend action exists and calls a real API**
   - A real button/control exists, is reachable via a live route, and issues a
     real request (no `console.log`-only / no-op / fake-success controls).
   - Evidence: file + route + the `apiRequest`/endpoint it calls.

2. **Backend API is authenticated and action-permission protected**
   - Endpoint is behind global JWT auth (`routes.ts:220`) — or self-applies
     `authMiddleware` if mounted earlier — and the action is guarded by
     `requireActionPermission` / role guard appropriate to the operation.
   - Evidence: route definition + guard + LIVE anon→401 / wrong-role→403.

3. **Database persistence exists**
   - Writes land in a real `drm` table (no in-memory/mock store).
   - Evidence: table name + persisted-row verification.

4. **Strict validation schema exists**
   - Request body validated by a zod (or equivalent) DTO before persistence;
     invalid input → 400. No raw `req.body` spread into inserts/updates.
   - Evidence: schema reference + LIVE invalid-body→400.

5. **Workflow transitions use a state machine / central service**
   - Status changes route through the central service
     (`invoice-workflow.service.ts`, `pms-transition.service.ts`,
     `CrossDepartmentStatusService`), never raw status PATCH.
   - Evidence: service call + LIVE illegal-transition→blocked.

6. **Dashboards / reports / notifications update**
   - Relevant dashboards, reports, and downstream notifications reflect the change.
   - Evidence: dashboard/report endpoint + reconciliation.

7. **Audit log records actor / time / old / new / reason**
   - Sensitive mutations write to `drm.activity_logs` via `AuditLogService.record`
     with `actorUserId`, `actorRole`, `action`, `module`, `entityType`,
     `entityId`, `before`, `after`, `reason` (best-effort, never blocks the mutation).
   - Evidence: audit row with before/after populated.

8. **UI has validation / loading / empty / success / error states**
   - Each screen handles all five states honestly (errors surfaced, never faked).
   - Evidence: state coverage per screen.

9. **Export parity verified where applicable**
   - Exported report (CSV/PDF/Excel) matches the on-screen dataset.
   - Evidence: export-vs-screen comparison.

10. **Role-based UAT evidence exists**
    - Executed per-role walkthrough: each relevant role logs in and performs the
      allow/deny flow in the browser; results recorded.
    - Evidence: UAT log per role. *(API-level cross-role matrix is necessary but
      not sufficient — browser UAT is required for Complete.)*

11. **Management-confirmed business rules are documented**
    - Any threshold, formula, timing, ownership, or scope decision is recorded with
      the confirming authority and date (see `PATCH7_MANAGEMENT_CONFIRMATION_REQUIRED.md`).
    - Evidence: confirmation entry referenced by requirement ID.

---

## Status definitions
- **Open** — required behavior missing or known-incorrect (e.g. INV-001).
- **In Progress** — criteria 1–9 satisfied/code-complete; criterion 10 (browser UAT)
  outstanding.
- **Partial** — some criteria met; explicit gaps listed in the matrix.
- **Complete** — all applicable criteria evidenced. If scoped, the scope is stated
  inline (e.g. SEC-001 "API permission closure executed").
- **Blocked** — cannot progress due to an external dependency.
- **Needs Management Confirmation** — code may be ready, but criterion 11 is
  unmet; status cannot advance to Complete until the decision is recorded.

## Evidence types
- **CODE** — source inspection. **AUTO** — automated test (`npm test`, 219/219).
- **LIVE** — executed HTTP/DB probe **this session**.
- **P6-LIVE** — executed HTTP probe in the immediately-prior Patch 6 session on the
  **same, unchanged codebase**, reused here (anon 401 endpoint sweep + cross-role JWT
  API matrix). Accepted as valid executed evidence because the code under test is
  byte-identical; re-execution is still recommended at final UAT.
- **UAT** — role-based **browser** walkthrough (not yet executed; tracked by UAT-004).
- Complete (non-scoped) requires at minimum AUTO/LIVE/P6-LIVE **plus** UAT where
  applicable. An API-level matrix alone (LIVE or P6-LIVE) is **not** sufficient for
  Complete on flows that have a user-facing path.
