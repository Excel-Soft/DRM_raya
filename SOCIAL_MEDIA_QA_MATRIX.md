# Social Media + Support — QA Matrix (Patch 7 Stage 6)

All checks below were **executed** against the running app (`localhost:5000`)
using minted JWTs for an **admin** (FULL) user and a **low-privilege**
(`sales_executive`) user. Result: **23/23 passed**. `npm run check` (tsc) also
passes clean.

> Honesty note: this matrix records checks that were actually run this stage, not
> aspirational coverage. The smoke script was deleted after the run and the test
> posts it created were soft-deleted in cleanup.

| # | Area | Check | Expected | Result |
|---|------|-------|----------|--------|
| 1 | Auth | `GET /api/social-media/posts` without token | 401 | PASS |
| 2 | Auth | `GET /api/social-media/dashboard/summary` without token | 401 | PASS |
| 3 | Support (SUP-001) | `GET /api/support/tickets` with module OFF | 404 (before auth) | PASS |
| 4 | Accounts (SOC-001) | `GET /api/social-media/accounts` (alias) | 200 + `data[]` | PASS |
| 5 | Posts create | Valid create (platform+account+content) | 201 + id | PASS |
| 6 | Validation | Create without platform | 400 | PASS |
| 7 | Validation | Create with non-existent account | 400 | PASS |
| 8 | Validation | Create with empty content | 400 | PASS |
| 9 | Validation | Create with past `scheduledAt` | 400 | PASS |
| 10 | Dashboard | `summary` returns real counts after a create | 200, total≥1, DRAFT≥1 | PASS |
| 11 | Lifecycle | `submit-approval` | 200, approval=PENDING | PASS |
| 12 | Dashboard | `summary` PENDING reflects submit | PENDING≥1 | PASS |
| 13 | Validation | `reject` without reason | 400 | PASS |
| 14 | RBAC | Low-priv `approve` on a PENDING post | 403 | PASS |
| 15 | Lifecycle | `approve` (FULL) | 200, approval=APPROVED | PASS |
| 16 | Validation | `publish` without `confirmManual` | 400 | PASS |
| 17 | RBAC | Low-priv `publish` | 403 | PASS |
| 18 | Lifecycle | `publish` (FULL, confirmed) | 200, publishing=PUBLISHED | PASS |
| 19 | SOC-EXT-001 | Publish response is honest internal | `MANUAL_INTERNAL`, "not posted to any external", `externalRef=null` | PASS |
| 20 | Lifecycle | `schedule` with future date | 200, publishing=SCHEDULED | PASS |
| 21 | Dashboard | `summary.upcomingScheduled` after schedule | ≥1 | PASS |
| 22 | Filters | `summary?scheduledFrom&scheduledTo` narrows results | 200, SCHEDULED≥1 | PASS |
| 23 | RBAC | Low-priv `DELETE` of another user's post | denied (403/404) | PASS |

## Manual / UI checks (recommended, not part of the automated smoke)
- Stat cards on the Social Media page show the same totals as the summary API and
  update after create/approve/publish (cards are invalidated on mutation).
- Scheduled date-range inputs filter both the table and the cards together.
- Support: logged-in admin and normal users do not see the Support sidebar entry;
  visiting `/support/tickets` shows the inactive page.

## Environment used
- `SUPPORT_MODULE_ENABLED=false`, `VITE_SUPPORT_MODULE_ENABLED=false` (shared).
- Replit-provided PostgreSQL (schema `drm`).
