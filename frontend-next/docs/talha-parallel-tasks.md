# Talha — parallel audit and preparation (proposed)

**Status:** Module ownership **not confirmed** — preparation only, no unapproved business-page migrations.

**Coordination:** Do not edit shared foundation files without Habib's explicit agreement:

- `frontend-next/src/lib/api/**`
- `frontend-next/src/lib/auth/**`
- `frontend-next/src/providers/**`
- `frontend-next/src/app/(app)/layout.tsx`
- `frontend-next/src/components/layout/app-shell.tsx`

Habib owns Phase 2/3 shared foundation and migrated modules (`/notice-board` pilot, `/admin/audit-logs` Phase 3).

**Phase 3 — Talha ownership:** Still **not confirmed**. Continue documentation-only prep until Habib assigns a module boundary.

---

## Handoff checklist (before Talha opens a module PR)

1. Confirm module ownership with Habib (Customer/Lead, Service/PMS, or Product Posting).
2. Branch from `fix/upgrade_frontend_habib` — not `main`/`production`.
3. No changes to files listed above; module work under `src/modules/<name>/` and `src/app/(app)/<routes>/`.
4. Attach API inventory with **Express file + handler** citations (not guessed permissions).
5. Run `npm run test` and `npm run typecheck` in `frontend-next/`.
6. Note overlap with pilot or auth backlog in PR description.

---

## Customer / Lead (preparation)

| Task | Detail |
|------|--------|
| Route inventory | `App.tsx` + `route-registry.ts` Customer group |
| Express files | `crm-routes`, `sales-routes`, `tempContacts` mounts in `routes.ts` |
| Client prefixes | `/sales`, `/customers` in `frontend-next/src/lib/auth/route-access.ts` |
| Smoke checklist | List, detail, follow-up; 401/403 cases |
| Blockers | Document any unverified response shapes |

---

## Service / PMS (preparation)

| Task | Detail |
|------|--------|
| Routes | `/pms/*`, especially `/pms/approvals` (**not** `/approvals`) |
| Express | `pms-routes.ts`, `hod-routes.ts` for approvals |
| Auth backlog | `PMS-APPROVALS-AUTH`, `AUTH-APPROVALS-01` |
| Smoke checklist | Pending project list, task system read |
| Blockers | Per-handler auth not fully extracted |

---

## Product Posting (preparation)

| Task | Detail |
|------|--------|
| Routes | `/product-posting`, `/posting-data`, workflow pages |
| Express | `product-posting-workflow`, `invoiceRouter`, `taskExecutionRouter` |
| Aliases | `/team-report/link-report` → posting-data (matrix) |
| Smoke checklist | Manager vs executive entry URLs |
| Blockers | Widget-heavy dashboards — list API deps per widget |

---

## Deliverables (docs only)

Create `frontend-next/docs/modules/<module>.md` with endpoint tables and permission notes.

---

## Habib — current implementation owner

- Next.js npm workflow, auth bootstrap, route-access, app shell, `/notice-board` pilot.
- Integration branch validation and pilot sign-off criteria.
