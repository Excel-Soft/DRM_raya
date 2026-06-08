# Manual Smoke Test — Stage 10 (Task C)

Lightweight, repeatable manual checklist for QA/UAT. No Playwright/Cypress is
installed (an E2E harness was judged heavier than warranted); automated coverage
is provided by the vitest API smoke suite (`server/stage10-smoke.test.ts`,
`npm test`) and this manual checklist covers the UI flows.

## Prerequisites
- App running: `npm run dev` (port 5000) or the deployed URL.
- A valid login (see `QA_SEED_DATA_GUIDE.md` / `REPLIT_RUNBOOK.md` for the dev
  admin). Have at least one non-admin role account to test blocking.

## Automated API smoke (run first)
```bash
npm test
```
Expected: **14 passing** (auth gate returns 401 on protected GETs, bad login →
401 sanitized, malformed login → 400, unknown routes handled with no stack leak).

## Manual UI checklist

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | **Login** | Submit valid credentials | Redirect to role dashboard; token stored; no console errors |
| 2 | **Invalid token redirect** | Tamper/clear token in storage, reload a protected page | Redirected to login (no blank screen, no 500) |
| 3 | **Sidebar navigation** | Click a sidebar item | Route opens; Suspense fallback shows briefly then page renders |
| 4 | **Unauthorized route blocked** | As a low-privilege role, open an admin-only URL directly | Blocked / redirected; no admin data shown |
| 5 | **Customer list loads** | Open CRM → Customers | List renders with real rows or a clear empty state |
| 6 | **Lead/marketing page loads** | Open Leads / Marketing | Page renders; filters work |
| 7 | **PMS task page loads** | Open PMS → Tasks/Projects | Task list renders |
| 8 | **Product posting manager page** | Open Product Posting (manager) | Dashboard/list renders |
| 9 | **Service page loads** | Open Service module | Page renders (complaints/pool/etc.) |
| 10 | **Report page loads** | Open a Report | Data renders; export button present |
| 11 | **Attendance To-Do loads** | Open Attendance → To-Do | List renders |
| 12 | **User list / settings** | As admin open Users / Settings | User list renders; allowed-IP settings visible |

## Cross-cutting checks
- **Request ID:** open browser devtools → Network → any `/api/*` response has an
  `X-Request-Id` header. Quote this id when reporting a bug (it appears in server
  logs as `rid=...`).
- **Error sanitization:** force a 500 (or watch a failing call) — the client body
  must be `{ success:false, error:{...}, message:"Internal server error" }` with
  **no** stack trace / SQL / secrets.
- **Export honesty:** an export downloads a timestamped file containing the
  currently filtered rows (see `EXPORT_STANDARD.md` for which reports are real vs
  the known mock-data exceptions).

## Sign-off
Record results in `UAT_SIGNOFF_MATRIX.md` (module / scenario / role / route /
expected / tested by / status / notes).
