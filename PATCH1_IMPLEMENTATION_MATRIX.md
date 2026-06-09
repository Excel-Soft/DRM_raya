# Patch 1 — Implementation Matrix (Stage 0)

Planning tracker derived from `PATCH1_BASELINE_AUDIT.md`. **No implementation in
Stage 0** — every row is `Status = Pending (audited)`. Stage numbers are
recommendations for sequencing, not commitments.

Columns: Patch area | Module | Priority | Current files | Current gap |
Implementation target | Acceptance criteria | Stage | Status

| Patch area | Module | Priority | Current files | Current gap | Implementation target | Acceptance criteria | Stage | Status |
|---|---|---|---|---|---|---|---|---|
| Validation handling | Invoices/Accounts | P0 | `server/account-routes.ts:1060` | `PATCH /invoices/:id` spreads `...req.body` into Drizzle `.set()` — mass assignment | Field allowlist + `shared/validators.ts` schema on update | Only whitelisted fields update; amount/status not settable via generic PATCH; invalid body → 400 envelope | 1 | Pending (audited) |
| Financial update protection | Invoices/GM/BV | P0 | `account-routes.ts` (invoice + gm-entries), `gm-pool-routes.ts` | Financial mutations lack field guard + status/approval gating on generic update | Guard status transitions; require role for amount/status changes; audit each change | Financial fields change only via dedicated, role-gated, audited endpoints | 1 | Pending (audited) |
| Permissions / RBAC | Routing/auth | P0 | `server/routes.ts:133,139,200` | `/api/drm` + attributes router mounted before global `authMiddleware` | Confirm internal auth or move mounts after gate; document public routers | Every non-public `/api/*` requires a valid JWT; verified by smoke | 1 | Pending (audited) |
| Approval visibility | Cross-module approvals | P0 | `account-routes.ts`, `pms-routes.ts`, `hod-routes.ts` | Inconsistent per-route role checks on approve/reject | Apply `requireRole`/`requireRoles` consistently per `ROUTE_PERMISSION_MATRIX.md` | Unauthorized approve/reject → 403; matrix matches code | 1 | Pending (audited) |
| Workflow synchronization | GM pool | P0 | `server/gm-pool-routes.ts:849,942 / 865,966` | Duplicate `super-hod-approve`/`reject` routes (second shadowed) | Remove/merge duplicates; confirm intended handler | One handler per transition; behavior unchanged & tested | 1 | Pending (audited) |
| Auth/password/signup | Auth | P0 | `server/auth.routes.ts:81,311,366`, `routes.ts:96` | Signup hardened already; `MOCK_AUTH` bypass exists (dev) | Keep signup disabled in prod; verify MOCK_AUTH off in prod; review reset-token flow | Prod: no public signup, no mock bypass; reset tokens single-use/expiring | 1 | Pending (audited) |
| Invoice→PMS/project linking | Invoices/PMS | P0 | `pms-routes.ts:218`, `routes/invoice-routes.ts` | Linking exists partially; contract not unified | Define + verify invoice↔project link contract | Invoice shows linked project; PMS pending-project list consistent | 2 | Pending (audited) |
| Validation handling (bulk) | PMS/Service/HR | P0 | §8 routes (`pms`, `service-core`, `notice`, `posting-data`, `loan`, `overtime`, `temp-contacts`) | Broad `...req.body` updates, no allowlist | Add per-route validators/allowlists | Each update validates input; unknown fields rejected | 2 | Pending (audited) |
| Raw SQL safety | CRM | P0 | `server/crm-routes.ts:281,343,404,476` | Dynamic `${whereSql}` fragments — confirm no raw user input | Ensure `whereSql` uses placeholders only | No user input concatenated into SQL; parameterized | 1 | Pending (audited) |
| Frontend/backend mismatch | Invoices UI | P0 | `account-invoices.tsx:260`, `InvoiceCreateForm.tsx:100,316` | UI expects `agentName/currency/amount`; product endpoint uncertain | Align API response shape + settle product endpoint | tsc invoice errors resolved; UI binds real fields | 1 | Pending (audited) |
| Follow-up communication | CRM | P1 | `reports-follow-up.tsx`, sales routes | Follow-up flow/report not verified; possible static data | Verify/implement follow-up persistence + report | Follow-ups persist and surface in report | 3 | Pending (audited) |
| Cross-department status linking | PMS/Posting/Software | P1 | workflow transition routes, `pms-routes.ts` status | Status linking across depts not unified | Verify transitions propagate cross-dept status | Dept status changes reflected downstream | 3 | Pending (audited) |
| Reports/filters/exports | Reports | P1 | `reports-routes.ts`, `reports-*.tsx` | Some reports use mock/static or no-auth fetch | Bind to real endpoints; standardize export (`EXPORT_STANDARD.md`) | Reports show real filtered data; exports timestamped real rows | 3 | Pending (audited) |
| Mock/static screens | Multiple | P1 | §11 list | Several pages/widgets use mock/sample data | Replace with real endpoints or mark intentional | No unintended mock data in active screens | 3 | Pending (audited) |
| Direct fetch / auth helper | Client-wide | P1 | §12 list (esp. no-auth fetches) | Direct `fetch` bypassing `apiRequest`/`getAuthHeader` | Migrate to shared helpers | All `/api` calls carry auth consistently; 401 handled centrally | 2 | Pending (audited) |
| Service workflow validations | Service | P1 | `service-core-routes.ts`, `service-manager-routes.ts` | Broad body updates; validation gaps | Add validators + state checks | Invalid service transitions rejected | 3 | Pending (audited) |
| HR approval/salary/attendance | HR | P1 | `leave-`, `overtime-`, `loan-`, `salary-`, `todo-routes.ts` | Approval/salary/attendance completion not fully verified | Verify approval gating + salary/attendance flows | Approvals role-gated & audited; salary/attendance complete | 3 | Pending (audited) |
| UI/layout consistency | Client | P2 | components/pages | Not audited in depth | Consistency pass | Consistent layout/spacing | 4 | Pending (audited) |
| Disabled invalid actions | Client | P2 | forms/tables | Not audited | Disable actions when invalid/unauthorized | Invalid actions disabled with reason | 4 | Pending (audited) |
| Standard modals | Client | P2 | dialogs | Not audited | Standardize modal pattern | Consistent modal UX | 4 | Pending (audited) |
| Table alignment | Client | P2 | tables | Not audited | Alignment pass | Consistent columns/alignment | 4 | Pending (audited) |
| Empty/loading/error states | Client | P2 | lists/pages | Inconsistent | Standard empty/loading/error components | All data views show the three states | 4 | Pending (audited) |
| Breadcrumbs/page titles | Client | P2 | shell/pages | Not audited | Add breadcrumbs/titles | Each page has title/breadcrumb | 4 | Pending (audited) |

> Source of truth for findings: `PATCH1_BASELINE_AUDIT.md`. Stage 0 makes no code
> changes; rows move to In-progress/Done only in their implementation stage.
