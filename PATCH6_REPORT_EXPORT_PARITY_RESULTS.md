# Patch 6 — Report Export Parity Results

Date: 2026-06-22. Verifies, per report, that the on-screen view and its export
draw from the **same** query/service with the **same** filters and role-scope
(rules A.1–A.3), that the export filename includes report + range + user/branch +
timestamp (A.4), and that every export writes one audit row (A.5). Standard:
`EXPORT_STANDARD.md`.

## Results

| Report | View vs export source | Same filters | Same role-scope | Filename (report+range+user/branch+timestamp) | Export audit |
|---|---|---|---|---|---|
| Raw Attendance | same handler/query (`/api/reports/raw-attendance` + `/export`) | yes | yes | yes (client + server) | **added** (`raw_attendance.export`) |
| Salary | same service (`/api/reports/salary` + `/export`) | yes | yes | yes (client + server) | yes (already, `salary.export`) |
| Event | same handler/query (`/api/reports/event` + `/export`) | yes | yes | yes (client + server) | **added** (`event_report.export`) |
| Reception | same handler/query (`/api/reports/reception` + `/export`) | yes | yes | yes (client + server) | **added** (`reception_report.export`) |
| Daily Target | same service (`getDayTargetReport`) | yes | yes | yes (client + server, timestamp added) | yes (already) |
| BV | same source (`/reports/bv` + `/export`) | yes | yes | yes (`bv_report_` prefix preserved + timestamp) | yes (already) |
| Penalty | view-only (no export UI) | n/a | row-aware scope enforced | n/a (no export) | n/a |

## Notes

- **Source parity** was already in place for all seven before this stage; the
  export endpoint reuses the same query builder and the same scope resolver as
  the list/view endpoint, so an export can never return rows the user cannot see.
- The **visible** filename is set client-side (`a.download` /
  `downloadAuthedFile`); the server `Content-Disposition` is the fallback for
  direct/API consumers. Both now comply.
- Penalty has no export surface; "add export if required" is **not** required.

## Evidence

- `npm test`: `stage8-event-reception.test` (reception export is `text/csv`,
  carries the `Company` header, rows scoped) and `stage9-bv-report.test`
  (`Content-Disposition` contains `bv_report_` + `.csv`) pass — 219/219 total.
- Unauthenticated calls to each export endpoint return 401 (role-gated).
