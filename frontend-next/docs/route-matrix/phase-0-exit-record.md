# Phase 0 exit record — migration planning and inventory

**Branch:** `fix/upgrade_frontend_habib`  
**Primary owner:** Habib  
**Reviewer (proposed):** Talha — confirmation pending  

---

## Closed for migration planning (inventory)

| Item | Status |
|------|--------|
| Route matrix JSON / CSV / migration tracker (207 legacy paths) | **Complete** |
| App ↔ registry alignment (0 App-only gaps) | **Complete** |
| Seven URL aliases documented | **Complete** |
| Next scaffold routes separate from legacy business paths | **Complete** |
| Phase 0A/0B/0C audit trail | **Complete** |
| AUTH-AUDIT-01 legacy client guard | **Fixed** (see phase-0-finalization) |
| Partial auth backlog (`auth-mapping-backlog.json`) | **Complete for scope** — not 207×handlers |

**Phase 0 migration inventory may be treated as closed** for starting Next.js auth + app-shell pilot work, subject to exceptions below.

---

## Not closed (whole migration / security / deployment)

| Area | Status |
|------|--------|
| Full UI ↔ backend authorization map | Open — backlog IDs `AUTH-FIN-01`, `AUTH-REPORTS-01`, `AUTH-MENU-01`, etc. |
| Unified `/approvals` legacy feature | Known broken — `AUTH-APPROVALS-01` |
| `/sales/active-clients` sidebar orphan | Product decision — status `review` |
| Pilot route sign-off | Each pilot path + API deps need evidence + tests before pilot merge |
| Staging/production Node + Nginx for Next standalone | Open — see `operations-prerequisites.md` |
| Talha module ownership | Proposed, not confirmed |

---

## Confirmed frontend defects (addressed or documented)

| ID | Issue | Disposition |
|----|-------|-------------|
| AUTH-AUDIT-01 | Audit Logs client guard wider than API | **Fixed** in legacy `route-access.ts` + sidebar nav alignment |
| AUTH-APPROVALS-01 | Unified approvals API stub | **Documented** — excluded from pilot; product decision required |

---

## Known broken legacy features (excluded from pilot)

| Route | Backlog | Notes |
|-------|---------|-------|
| `/approvals` | AUTH-APPROVALS-01 | Empty `/api/approvals` router; route kept in production Vite app |
| `/sales/active-clients` | SIDEBAR-ORPHAN-01 | Sidebar link only — no App route |

---

## Pilot exclusions (explicit)

- `/approvals` — migration status remains `legacy`; do not port until backend contract exists.
- `/sales/active-clients` — do not port until product defines target route or removes link.

Working approval surfaces for reference: `/pms/approvals`, HOD `/api/hod/approvals`, module-specific flows.

---

## Team decisions still pending

1. **Unified approvals:** restore in approved backend project vs retire `/approvals` UI route.
2. **Active Clients:** remove sidebar link, add route later, or redirect — evidence in `phase-0b-resolution.md`.
3. **Talha module ownership** — see `talha-parallel-tasks.md`.

---

## Acceptance before pilot sign-off (per route)

- Client route guard (or Next equivalent) documented.
- Protected API handlers cited from Express.
- Smoke test or automated check where feasible.
- No known 404 stub for primary page APIs.
