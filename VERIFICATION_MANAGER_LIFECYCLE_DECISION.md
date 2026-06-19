# Verification Manager Lifecycle — Decision Document

**Patch 5 Stage 7, Part A.** Status: **CURRENT BEHAVIOR DOCUMENTED — AWAITING
MANAGEMENT CONFIRMATION.** No workflow transition, phase value, role, or
permission was changed in this patch.

## 1. Purpose

This document records how the QA → Verification → final-owner lifecycle works
**today**, and the open question management must answer before any transition
logic is changed. Because the answer is not yet confirmed, Stage 7 only:

1. Centralizes the *user-facing labels* for this lifecycle in
   `shared/verification-lifecycle.ts` (a single source of truth), and
2. Makes those labels **config-aware** via the existing
   `verificationManagerRequiredAfterQa` flag, so the UI describes the same
   underlying state truthfully under either configuration.

The backend transition code is untouched.

## 2. Current behavior (as implemented)

- After a Product Posting / Software project is built, **QA** reviews it.
- The QA review endpoint is backend-driven only: completing a QA review
  transitions the project phase to `VERIFICATION_PENDING`; returning it
  transitions to `RETURNED_FOR_CHANGE`. No client-side handoff queue is used.
- A project in `VERIFICATION_PENDING` is surfaced to the **Verification Manager**,
  who performs the final check. Completing verification transitions the project to
  `VERIFICATION_COMPLETE`; returning it sends it back to `QA_REVIEW`.
- Therefore, **in the current default configuration the Verification Manager is
  the final owner of a project's readiness state**, and QA completion is *not*
  terminal.

This matches the default config value `verificationManagerRequiredAfterQa = true`.

## 3. The configuration flag

`verificationManagerRequiredAfterQa` already exists in the GM/Sales workflow
config (admin-managed). Stage 7 exposes a **read-only** projection of it (plus the
two Service-Executive flags) at `GET /api/gm-sales-workflow/ui-config` for any
authenticated user, so the frontend can render consistent labels without exposing
the full admin config surface.

| Flag value | Meaning | Final owner | Label after QA |
| --- | --- | --- | --- |
| `true` (default) | Verification Manager step is required after QA | Verification Manager | "Verification Pending" → "Verification Complete" |
| `false` | QA completion is terminal; no separate verification gate | QA Manager | "QA Complete" |

`getVerificationLifecycleLabels(verificationManagerRequiredAfterQa)` returns the
correct wording for each case. With the default (`true`), wording is identical to
what shipped before this patch — i.e. **no visible change in the default state**.

## 4. Open question for management (needs confirmation)

> **Is the Verification Manager review step after QA mandatory for project
> readiness, or is QA completion itself the terminal "ready" state?**

- If **mandatory** (keep `verificationManagerRequiredAfterQa = true`): no change
  required; current behavior and labels are correct.
- If **not mandatory** (set `verificationManagerRequiredAfterQa = false`): the
  labels already collapse correctly, **but a follow-up patch must also change the
  transition logic** so QA completion moves the project directly to a terminal
  state instead of `VERIFICATION_PENDING`. That transition change is intentionally
  **out of scope** for Stage 7 and must not be made until management confirms.

## 5. What Stage 7 changed (Part A only)

- Added `shared/verification-lifecycle.ts` — canonical lifecycle stage labels and
  the `getVerificationLifecycleLabels()` helper (labels only; no transitions).
- Made the Verification Manager widget's post-QA status tag config-aware using
  that helper.
- This document.

## 6. What Stage 7 explicitly did NOT change

- No QA review / verification transition logic.
- No phase enum values, roles, or permissions.
- No database structure.
