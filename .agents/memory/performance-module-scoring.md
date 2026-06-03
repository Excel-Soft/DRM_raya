---
name: Performance module scoring
description: How the DRM performance module composes access scoping with the scoring service, and why team-style aggregation is safe.
---

# Performance module (server/performance-routes.ts + server/services/performance.service.ts)

The performance feature is read-only and computes an employee score from existing
DRM data: Final = 40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness,
normalized over whichever components have data.

## Access scoping
- `getAllowedUserIds(req)` returns the user ids a caller may view, or `null` meaning "all".
- Full-access roles (`admin`, `super_hod`) → `null` (all users).
- HOD / managerial roles → scoped to their **department** (plus self), not a team hierarchy.
  **Why:** there is no team-hierarchy column on `drm.users`, and `normalizeRole` is lossy,
  so department is the only reliable column that guarantees no cross-team/department leak.
- Any new aggregate endpoint MUST scope its candidate user list through `getAllowedUserIds`
  (and reuse the same `id = ANY($n::text[])` filter) so it can never leak out-of-scope employees.

## Concurrency safety
- `buildSummary(userId, from, to, includeRecords)` wraps its work in an `AsyncLocalStorage`
  store (`perfWarnings`) created fresh per call, so concurrent `buildSummary` calls do NOT
  cross-contaminate each other's `dataWarnings`.
  **How to apply:** it is safe to fan out `buildSummary` across many users to build leaderboards
  (the team comparison does this in small concurrent batches to avoid flooding the pg pool).

## Team comparison sizing
- The `/team` endpoint scores every allowed user (batched) up to a `MAX_TEAM_USERS` safety cap,
  and also runs a `count(*)` over the same WHERE to get the true total. Response carries
  `total` + `truncated` so the UI can show "Showing N of M" instead of silently dropping employees.
  **Why:** the old hard `limit 200` dropped employees past the cap with no signal to the manager.
  **How to apply:** if you raise the cap or change selection, keep the `count(*)` and `truncated`
  flag in lockstep, and remember selection-before-scoring is by name order, not by score.
