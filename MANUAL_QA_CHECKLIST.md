# WebExcels DRM — Manual QA Checklist (Stage 10, section H)

Run alongside `scripts/api-smoke-test.ts` (automated API checks). Tick each item
in a clean browser session. "Backend blocks" means: even if a button is forced,
the API must still reject the action.

## 1. Auth & session
- [ ] Login with valid admin credentials succeeds and lands on a dashboard.
- [ ] Invalid/expired token → redirected to login (no blank/broken screen).
- [ ] Logout clears session; protected routes redirect to login.

## 2. Permissions / navigation
- [ ] Sidebar only shows modules permitted for the active role.
- [ ] Direct-navigating to an unauthorized route redirects (client) AND the
      underlying API returns 401/403 (backend).
- [ ] Role switch / impersonation (admin) updates the visible menu.

## 3. Invoice workflow
- [ ] Create invoice → HOD approve → Account approve → Paid → Cancel each move
      shows a toast and updates status.
- [ ] Reject/return requires remarks (cannot submit empty).
- [ ] A non-permitted role cannot see or trigger the approve action; API blocks.

## 4. PMS / product posting / software workflow
- [ ] Assignment → evidence submit → manager complete → QA return → verification.
- [ ] QA/verification return requires a reason.
- [ ] Wrong-stage actions are hidden/disabled; backend rejects if forced.

## 5. Cross-department
- [ ] Invoice-to-project link is visible from both sides where data exists.

## 6. Service department
- [ ] Follow-up complete requires an outcome.
- [ ] Dropout create requires a reason; recover requires a recovery note.
- [ ] Renewal create requires customer/package/due date/amount > 0.
- [ ] Complaint close requires a resolution remark.

## 7. GM / BV
- [ ] GM approval/rejection records correctly (or legacy bridge returns 501 with
      a clear message — no fake success).

## 8. Reports & exports
- [ ] Data tables show loading, empty, and error (retry) states correctly.
- [ ] Export (CSV/Excel/PDF) respects active filters/visible columns.
- [ ] No disabled/fake pagination — controls reflect real totals.

## 9. Audit log viewer (`/admin/audit-logs`)
- [ ] Loads for admin/super_admin/super_hod; 403 for other roles.
- [ ] Filters (actor, module, entity, action, date range) narrow results.
- [ ] A sensitive action (e.g. approval) appears in the log afterwards.

## 10. UI consistency
- [ ] Major screens show a title / breadcrumb.
- [ ] No `alert()` popups on the converted screens (toasts/inline instead).
- [ ] Module labels match the actual module (no Product Posting label inside
      Software workflow, etc.); obvious typos fixed.
