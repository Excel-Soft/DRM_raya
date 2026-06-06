---
name: Service dashboard honesty & scope-clause gotcha
description: How service dashboards present data honestly, and the WHERE/AND scope-clause pitfall in service-reports.repository dashboardCounts.
---

# Service dashboards: honest data pattern

Service dashboard top-cards / charts must read a real endpoint value with a
`0`/empty fallback — never hardcoded literals. The established reference is the
manager dashboard: cards bind to `/api/service/manager/stats` and the assistant
dashboard binds to `/api/service/manager/stats` + `/api/service/dashboard/counts`.

**Why:** Several backend stat fields (`totalRevenue`, `vm`, `kwa`, `psa`,
`sponsorBrand`) intentionally return `0` because no invoice/GM revenue source is
wired to service customers yet. Showing the honest `0` is correct; inventing
figures is a constraint violation. When no source exists for a list/table, show
an honest empty state instead of fabricated rows.

**How to apply:** Before "fixing zeros" on a service dashboard, confirm whether a
real source exists. If it does, bind to it with a `0` fallback. If it does not,
keep `0`/empty — do not fabricate.

# scopeSql is a full `WHERE` clause — append with AND

In `server/repositories/service-reports.repository.ts`, `scopeSql` is
`"WHERE sc.assigned_to = ANY($1)"` (or `""` for admins). Any query that already
has its own `WHERE` must add the scope with an inline `AND ... = ANY($1)`
ternary, NOT by interpolating `${scopeSql}` — otherwise scoped (non-admin) calls
build a double-`WHERE` and 500.

**Why:** A latent double-`WHERE` in the due-payments count silently broke
`dashboardCounts()` for non-admin users while admins (empty scope) saw no issue.

**How to apply:** Mirror the `dueFollowups`/`dropouts`/`duePayments` queries
(`${userIds?.length ? "AND ... = ANY($1)" : ""}`); reserve bare `${scopeSql}`
only for queries with no other WHERE clause.
