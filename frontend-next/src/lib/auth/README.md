# Auth module (Phase 2)

Express `/api/auth/*` remains the session authority. This folder will hold:

- Session bootstrap helpers
- Route-access utilities (port of legacy `frontend/src/lib/route-access.ts`)
- Client hooks for authenticated layout

**Phase 1:** No login flow or App Router guards wired yet.

**Phase 0 finalization:** `route-access-policy.ts` + `route-access-policy.test.ts` define audit-log viewer roles aligned with `audit-log-routes.ts`. Port full prefix map from legacy `route-access.ts` when implementing guards — do not duplicate divergent rules.
