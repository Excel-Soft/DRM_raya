---
name: route-registry is not the live router
description: route-registry.ts is a stale inspection artifact; the live router is App.tsx and the live sidebar is app-sidebar.tsx.
---

# route-registry is not the live router

`client/src/...route-registry.ts` is an **inspection / documentation artifact**, not
the source of truth for what is reachable. The actual route table is in
`client/src/App.tsx` (Wouter `<Route>`s, including redirects) and the actual
navigation is in `client/src/components/app-sidebar.tsx`.

**Why this matters:** the registry can disagree with reality. It listed legacy pages
(e.g. `office-account-head` / `office-old-account-head`, "OFF-001/OFF-002") with
`sidebarVisible: true` even though `App.tsx` already redirects those paths to
`/office/chart-of-accounts`, making the mock pages unreachable. Scoping a task off the
registry alone leads to "fixing" screens that no user can ever load, or missing real
reachability.

**How to apply:** when judging whether a screen/button is *reachable* (production-safe
audits, dead-screen sweeps, mock-guard decisions), confirm against `App.tsx`
(route + any redirect) and `app-sidebar.tsx`, and treat `route-registry.ts` as a hint
only. Likewise, components referenced solely by `components/examples/*` (e.g.
`public-pool.tsx`, `customer-list.tsx`) are dev-only demos, not mounted on live routes.
