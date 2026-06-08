# QA Seed / Test Data Guide — Stage 10 (Task G)

How to populate a QA/UAT environment with representative data. **Do not insert
fake data into a production database.** Seeds are for dev/QA only and require
explicit approval before running anywhere shared.

> ⚠️ The seed scripts write to whatever `DATABASE_URL` points at. Confirm you are
> targeting a **dev/QA** database first.

## Existing seed helpers (`scripts/`)
| Script | Seeds |
|---|---|
| `scripts/seed-gm-data.ts` | GM (general meeting) sample entries |
| `scripts/seed-bv-data.ts` | BV (business volume) sample entries |
| `scripts/seed-vas-data.ts` | Service VAS sample data |
| `scripts/seed-sales-exec.cjs` | Sales executive sample account/data |
| `scripts/check-gm-data.ts`, `check-bv-data.ts`, `dump-bv-data.ts` | Verify/inspect seeded rows |

Run a seed (dev/QA only), e.g.:
```bash
npx tsx scripts/seed-gm-data.ts
npx tsx scripts/seed-bv-data.ts
npx tsx scripts/seed-vas-data.ts
node scripts/seed-sales-exec.cjs
```

## Required data for a full UAT pass

### 1. Roles
Ensure the role set exists (see `PERMISSION_MATRIX_QA.md`): admin, super_admin,
HOD, sales_manager, sales_executive, product_posting_manager/executive,
dd_manager/executive, software_manager/executive, qa_manager,
verification_manager, service_manager/executive, account_manager, HR/admin-HR.

### 2. Sample users
- One account per role above (predictable emails, e.g. `role@webexcels.local`).
- The dev admin login is documented in `REPLIT_RUNBOOK.md`.
- At least one manager + one executive under the same department to test
  approve/assign/scope rules.

### 3. Sample customers (CRM)
- A handful of customers across branches/countries; a few assigned to a specific
  sales_executive to test scope filtering.

### 4. Sample GM / BV
- Use `seed-gm-data.ts` / `seed-bv-data.ts`. Verify with `check-*-data.ts`.

### 5. Sample project / task (PMS)
- One project with 2–3 tasks in different statuses (open / in-progress / done) and
  an assignee, to test PMS lists, status changes, and overdue handling.

### 6. Sample product-posting workflow
- One posting item moving through posting → software → QA → verification, so each
  manager/executive queue has at least one record and approvals can be exercised.

### 7. Sample service customer
- A service complaint + a private/public-pool entry + a VAS/due-payment record
  (`seed-vas-data.ts`) so the service module and its exports render real data.

### 8. Sample attendance / leave / overtime / loan
- For 2–3 users: an attendance record, a pending leave request, an overtime
  entry, and a loan request — to test the Attendance/HR to-do and approvals.

### 9. Sample report data
- Reports read from the above operational tables. Once CRM/GM/BV/attendance/
  service/PMS rows exist, the report pages and exports have real data. No separate
  "report seed" is needed.

## Reset / re-seed
- Prefer a fresh dev DB or a Replit checkpoint before bulk seeding so you can roll
  back. Inspect with the `check-*` / `dump-*` scripts.

## Guardrails
- **Never** auto-run seeds against production.
- Seed accounts use obvious test emails/passwords — never reuse real credentials.
- Get explicit user approval before inserting data into any shared environment.
