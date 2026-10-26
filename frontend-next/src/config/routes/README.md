# Route configuration

- **Phase 0A matrix:** `docs/route-matrix/route-matrix.json` (+ CSV + reconciliation report)
- **Regenerate:** `node frontend-next/scripts/build-route-matrix.mjs` (from repo root)
- **Tracker data:** `migration-routes.json` (generated)
- **Tracker API:** `migration-tracker.ts` re-exports typed routes

Legacy sources reconciled in the matrix: registry, `App.tsx`, sidebar, client guard prefixes, sampled backend mounts.
