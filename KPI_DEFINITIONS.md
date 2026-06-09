# WebExcels DRM — KPI Definitions (Stage 10, section F)

This file documents the formula and source table for each KPI/metric surfaced on
dashboards, and whether the card supports a drill-down to a filtered list.

Rule (Stage 10): a KPI card may link to a filtered list/report **only when a real
source query backs it**. Placeholder / future metrics must NOT offer a drill-down.

| KPI / Card | Definition (formula) | Source (schema `drm`) | Drill-down target | Status |
|---|---|---|---|---|
| Assigned Leads | Count of customers in the CRM | `COUNT(*) drm.customers` | `/leads` filtered list | Live |
| Active Tasks | Tasks not in a completed state | `COUNT(*) tasks WHERE status != 'Completed'` | PMS task list | Live |
| Invoices — Pending Approval | Invoices awaiting HOD/Account approval | `drm` invoice tables filtered by workflow status | Invoice list (status filter) | Live |
| Service Pool size | Customers currently in the service pool | `drm.service_pool_entries` | `/service/pool` | Live |
| Complaints — Open | Complaints not closed/resolved | `drm` complaint table by status | Service complaints list | Live |
| Audit events (24h) | Audit log rows in the last 24h | `drm.activity_logs WHERE created_at > now()-'24h'` | `/admin/audit-logs` (date filter) | Live |
| Training Progress | Static placeholder (no source) | — | none | Placeholder — no drill-down |
| Engagement Rate | Static placeholder (no source) | — | none | Placeholder — no drill-down |
| Data Entry Completion | Static placeholder (no source) | — | none | Placeholder — no drill-down |

## Notes
- Placeholder cards in `admin-activity-routes.ts` (`trainingProgress`,
  `engagementRate`, `dataEntryCompletion`, and the `supportReplies` multiplier)
  are clearly marked here as non-sourced. They must not be wired to a drill-down
  until a real query exists, to avoid implying data that does not exist.
- When adding a new KPI, add a row here with its exact SQL/source before exposing
  a drill-down link.
