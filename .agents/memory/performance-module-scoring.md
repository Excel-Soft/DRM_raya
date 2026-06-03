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

## Team comparison: rank the whole scope, then paginate
  the requested page (`page`/`pageSize`). `buildTeamLeaderboard` does score→rank→slice and returns
  whole-scope `stats` (top/avg/bottom/scored) + `totalScored`/`totalPages`. Any "select first N (by
  name) then score" shortcut — or a row cap used as a stand-in for paging — is a correctness bug: it
  drops the true top/bottom scorers whenever the scope exceeds N.
  **Why:** a prior implementation pre-truncated by name (and later a 5000 hard cap) before scoring,
  so extreme scorers past the cap silently vanished from the ranking; raising the cap only moved the
  same bug to a higher number. There is intentionally NO truncation now — every eligible id is fetched
  (no `limit`) and scored.
  **How to apply:** keep per-user scoring batched (small concurrent chunks) so the pool isn't
  flooded, but feed it ALL ids. Aggregate cards / TOP-LOW badges must come from whole-scope `stats`,
  not the visible page; global rank = `(page-1)*pageSize + i + 1` (server also sends per-row `rank`).

## Testing the routes
- Tests run on vitest (`npm test`, config `vitest.config.ts` with `@shared`/`@` aliases,
  `fileParallelism:false`). They are DB-backed: they import the real `pool` and seed throwaway
  `drm.users` rows, then mount `registerPerformanceRoutes` on a bare express app with a middleware
  that injects `req.user` (e.g. `{ userId, roleId: "hod" }`) and drive it with supertest.
  **Why:** there is no auth layer in the test app, so set `req.user` directly.
  **How to apply:** give each test its own unique `department` value so HOD scoping resolves to
  exactly that test's seeded users; clean up by `delete from drm.users where department = $1`.
  Drive paging via the `pageSize`/`page` query params (NOT an env cap — the cap was removed).
