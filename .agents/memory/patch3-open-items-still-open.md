---
name: Patch 3 "OPEN" items are still unfixed in code
description: The Patch 3 stages were verification/documentation passes, so issue-matrix items marked OPEN are genuinely not fixed — verify against code, don't trust "stage complete/merged".
---

# Patch 3 OPEN items are genuinely unfixed

The Patch 3 multi-stage effort (and Patch 2 before it) turned out to be largely
**verification + documentation** passes, not code-change passes. `PATCH3_ISSUE_MATRIX.md`
lists planned *targets* with a Status column, but several **P0 `OPEN`** items were
confirmed by code inspection (June 2026) to still be unfixed in the live code:

- **APR-001 / INV-001** — `PATCH /api/account/invoices/:id/status` (in
  `server/account-routes.ts`) has only `if(!req.user)`: no role/action gate and no
  status state machine on `drm.invoices`.
- **SEC-005** — `attributesRoutes` is mounted before `authMiddleware` in
  `server/routes.ts`; per-handler public/gated audit still pending.
- **SEC-006** — `JWT_SECRET` is hard-coded in `.replit` (violates `replit.md`).
  Needs move to a Replit-managed secret + rotation (user-approved; invalidates
  sessions). Do not reproduce the value anywhere.
- **GLOBAL-003** — raw `...req.body` spreads in `server/service-core-routes.ts`
  (4 sites) and `server/notice-routes.ts` (2 sites); no zod allow-list.
- **WF-003 / XDL-002** — service→GM/VAS/BV bridges (`server/service-core-routes.ts`)
  return `501` (honest stub, no fake success).

**Why:** A future agent (or final report) must not assume "Patch 3 Stage N
complete/merged" means the P0 code fixes were applied. They were planned but, for
these items, not implemented.

**How to apply:** Before claiming any Patch 3 issue ID is fixed, grep/read the
cited file and confirm in code. Treat SEC-006, SEC-005, APR-001/INV-001, and
GLOBAL-003 as pre-production blockers owned by Patch 3 Stages 1–2.
