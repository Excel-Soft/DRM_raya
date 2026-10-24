# Phase 25 — Training module (full Next)

| Legacy | Next |
|--------|------|
| `/training` | `/dashboard/training` |

**Scope:** Parity with `training-center.tsx` — category/subcategory catalog, video list per subcategory, HTML5 player.

- UI: `TrainingShell`, `DrmSection`, emerald/zinc layout; `layout` + page `instant = false`.
- APIs: `GET /api/training/tree`, `GET /api/training/subcategories/:id/videos`.
- Nav: already migrated (`DASHBOARD_TRAINING`, redirect `/training` → `/dashboard/training`).
