---
name: Performance system is read-only with a fixed scoring formula
description: The DRM performance module must never expose a configurable/mutable scoring formula.
---

# Performance system: fixed formula, read-only

The DRM performance feature (`/api/drm/performance`, `server/services/
performance.service.ts`, `client/src/pages/drm/performance.tsx`) scores users with
an EXACT, fixed formula: 40% Work Completion + 30% Quality + 20% Target
Achievement + 10% Timeliness, with fixed quality penalties.

**Rule:** the formula is NOT admin-configurable. `getScoringConfig()` returns the
hardcoded `DEFAULT_SCORING_CONFIG` constants; do not read dynamic weights from
persisted policy, and do not add write/mutation endpoints (no
`PUT .../scoring-config`, no client-side weight editor) to this module.

**Why:** the task spec requires production behaviour to match the exact formula
and the feature to be additive/read-only. A prior pass added a persisted,
admin-editable scoring policy + `PUT /scoring-config` + a `ScoringConfigEditor`
UI; code review rejected it as a requirements violation (mutable formula + write
behaviour in a read-only feature).

**How to apply:** keep the `GET /scoring-config` (read-only, returns the fixed
config for display, `canEdit:false`). If asked to make scoring tunable, flag that
it conflicts with the fixed-formula requirement before implementing.
