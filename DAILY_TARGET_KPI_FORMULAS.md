# Daily Target — KPI Formulas

Date: 2026-06-22. Documents the Daily Target report KPIs exactly as implemented,
for management sign-off. **No formula change** was made in Patch 6 Stage 8. The
open business decision is item **K** in
`PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.

## Source of truth

`server/reports-routes.ts` — `GET /api/reports/day-target` (and `/export`),
backed by `getDayTargetReport` in `server/services/day-target.service.ts`. The
endpoint replaced the former `501` stub: it reports each in-scope employee's
assigned target, real approved-GM achievement, and live activity counts over a
date window.

## KPIs (as implemented)

```
achievement% = round( (amount / targetAmount) * 100 )      when targetAmount > 0
             = null                                          when no target set
```

- **Achievement basis:** "amount" is the employee's **Approved-GM** achievement
  over the window (Approved-only — see item K).
- **Honest gaps:** a missing target is surfaced as `null`, never as `0%` or a
  fabricated value. Activity counts are live; no metric is invented.
- **Scope:** the export honours the same row-scope as the view
  (`resolveDayTargetScope`) and returns the full filtered set, not a single page.

## Pending management confirmation (item K, REP-004)

Confirm: does "achievement" count **only Approved GMs**?

**Current default until confirmed:** Approved-only. This is config-backed, so a
confirmed decision needs no code change — only the decision.
