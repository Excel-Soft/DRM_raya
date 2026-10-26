# DRM WebExcels — Next.js migration progress report (role & module)

**Branch:** `fix/upgrade_frontend_habib`  
**Last pushed commit:** `6abe772` — `feat(frontend-next): home dashboard layout, quick links, and mobile nav`  
**Report date:** 2026-10-26  
**Audience:** Admin / Habib / team planning  
**App:** `frontend-next` (Next.js 16) — legacy Vite app (`frontend/`) still runs in parallel

---

## 1. Executive summary (Urdu + English)

**English:** Foundation, auth, app shell, and **most sidebar modules** are migrated to Next. **Admin role** can sign in, use **Admin / Super Admin** dashboards, **DRM Setting**, **Users**, **Audit logs**, and the full **Customer / HR / Lead / Reports (user reports)** stack on `localhost:3000`. **Four module groups are still legacy-only** in the sidebar: **PMS**, **Support**, **Office Account**, and **Reports** (main Reports menu — separate from “User Reports” which *is* on Next).

**Urdu:** Basic setup ho chuka hai — **admin login**, shell, navigation, aur **zyada tar modules Next par chal rahe hain**. Admin side par ab bhi **PMS, Support, Account, Office Account, aur Reports (bara menu)** legacy Vite par hain jab tak migrate na hon. In ke liye `NEXT_PUBLIC_LEGACY_APP_ORIGIN` set karke sidebar se legacy tab khol sakte hain.

| Metric | Count |
|--------|------:|
| Next `page.tsx` routes (approx.) | **74** |
| Sidebar module groups (total) | **21** |
| Groups with **all** child links on Next | **16** |
| Groups **fully legacy** (no Next pages yet) | **5** |
| Documented migration phases (status docs) | **PHASE 2–25** + foundation |

---

## 2. Kya complete hai (global / sab roles)

| Area | Status | Notes |
|------|--------|--------|
| Next scaffold, API rewrite, standalone build | Done | `FOUNDATION_STATUS.md` |
| Auth (login, session, Bearer, role switch) | Done | `/auth`, `AuthProvider` |
| Route access / legacy guard mapping | Done | Tests in `route-access*.test.ts` |
| App shell (topbar, sidebar, breadcrumbs) | Done | Emerald/zinc UI |
| Mobile bottom nav (Home, Customer, HR, Lead, Menu) | Done | Oct 2026 session |
| Legacy URL → Next redirects | Partial | Customer, DRM, HR, lead, user reports, quick links, etc. |
| Navigation visibility by role | Done | Menu ≠ authorization; matches legacy DEPT rules |
| Home dashboard (`/dashboard`) | Done | KPIs, tables, widgets, quick links, appointment modal |
| E2E / full UAT sign-off | **Pending** | Phase docs note “browser QA not run” in places |

---

## 3. Module-wise status (sidebar order)

Legend: **Next** = works on `frontend-next` without legacy app. **Legacy** = sidebar link needs Vite (`NEXT_PUBLIC_LEGACY_APP_ORIGIN`) or shows Legacy badge.

| # | Module (permKey) | Next | Legacy | Screens / scope | Phase doc (if any) |
|---|------------------|:----:|:------:|-------------------|---------------------|
| 1 | **Dashboard** | Yes | — | Home dashboard + quick links | Session 2026-10 |
| 2 | **Customer** | Yes | — | 11 sidebar items (pools, invoice, duplicate, etc.) | `PHASE14`, completion report |
| 3 | **Attendance** | Yes | — | 5 HR routes under `/hr/*` | Session 2026-10 |
| 4 | **Lead** | Yes | — | Lead pool, GM BV pool | `PHASE29` (lead-routes) |
| 5 | **PMS** | **No** | **All 8** | Tasks, running projects, approvals, team workspace, … | **Not started** |
| 6 | **User Reports** | Yes | — | Loan, VAS, GM, BV (`/dashboard/reports/{type}`) | User reports phase |
| 7 | **Notice** | Yes | — | Notice board, DRM policies | Phase 13 |
| 8 | **Portfolio** | Yes | — | Add / view portfolio | Portfolio phase |
| 9 | **DRM Setting** | Yes | — | Attributes, permission, promotion, PMS *setting*, bot, forms, … | `PHASE16` |
| 10 | **Users** | Yes | — | Add, list, groups | `PHASE17`, `PHASE17_1` |
| 11 | **Support** | **No** | **1** | Tickets (`/support/tickets`) | **Not started** |
| 12 | **Account** | **Yes** | **8** | GM, temp/refund GM, donations, invoices, ledger, AB report, dollar system | **Migrated** (`/dashboard/account/*`) |
| 13 | **Office Account** | **No** | **3** | Trial balance, COA, general ledger | **Not started** |
| 14 | **Reports** | **No** | **5+** | Attendance/salary/projects reports, increment, penalty | **Not started** (see note below) |
| 15 | **Domain Hosting** | Yes | — | Servers, domains, backup | `PHASE24` |
| 16 | **Posting Data** | Yes | — | 7 posting-data screens | `PHASE23` |
| 17 | **Target System** | Yes | — | 6 target/KWA screens | `PHASE22` |
| 18 | **Events** | Yes | — | Add event, menu, duty planner | `PHASE21` |
| 19 | **Social Media Posting** | Yes | — | Social + training link | `PHASE18` |
| 20 | **Daily Reports** | Yes | — | Daily added GM | `PHASE20` |
| 21 | **Allowed IP** | Yes | — | DRM IP list | `PHASE19` |

**Note — “Reports” vs “User Reports”:**  
- **User Reports** (sidebar group) = **migrated** (4 report types on Next).  
- **Reports** (sidebar group) = **not migrated** (attendance report, salary, projects, increment, penalty, etc.).  
- Extra on Next: **Grade system**, **commission**, **performance**, **appointments** via **dashboard quick links** (not full Reports module).

---

## 4. Admin role — kya mil gaya, kya baqi

### 4.1 Admin ke liye **Next par available**

| Feature | Route(s) |
|---------|------------|
| Admin dashboard | `/dashboard/admin` |
| Super Admin | `/dashboard/super-admin` |
| Audit logs | `/dashboard/audit-logs` |
| DRM IP list | `/dashboard/allowed-ip/drm-ip-list` |
| DRM Setting (full subtree) | `/dashboard/drm/*` |
| Users management | `/dashboard/drm/users/*` |
| Home dashboard + admin widgets | `/dashboard` |
| D&D Manager hub (shortcuts) | `/dashboard/dd-manager` |
| Saari migrated modules upar table mein “Next = Yes” | (Customer, HR, Lead, …) |

### 4.2 Admin sidebar par **ab bhi legacy** (aap ke mention ke mutabiq)

| Module | Items | Legacy paths (examples) |
|--------|------:|-------------------------|
| **PMS** | 8 | `/pms/tasks`, `/pms/running-projects`, `/pms/approvals`, … |
| **Support** | 1 | `/support/tickets` |
| **Account** | 3 | `/account/gm-entries`, `/account/invoices`, `/account/ledger` |
| **Office Account** | 3 | `/office/trial-balance-report`, `/office/chart-of-accounts`, … |
| **Reports** | 5+ | `/reports/attendance`, `/reports/salary`, `/reports/projects`, … |

**DRM Setting → Pms Project Setting** (`/dashboard/drm/pms-setting`) **Next par hai** — yeh **PMS module** se alag hai (configuration screen, poora PMS workflow nahi).

---

## 5. Role-centric view (kis role ne kya use karega)

Yeh **menu visibility + migrated routes** par based hai; har role ka exact menu legacy `app-sidebar` / DEPT rules se filter hota hai.

| Role / persona | Next par strong coverage | Ab bhi legacy zyada |
|----------------|--------------------------|----------------------|
| **admin / super_admin** | Dashboard, DRM Setting, Users, Audit, IP, Customer, Reports (user), Target, Events, … | **PMS, Support, Account, Office Account, Reports menu** |
| **sales / service (staff)** | Dashboard, Customer, Attendance, Lead, Training, quick links | PMS (if role has PMS), Support tickets, Account screens |
| **account_manager / HOD** | User reports, policies (role-dependent), commission quick link page | Account, Office Account, deep `/reports/*` |
| **dd_manager** | D&D hub + HR shortcuts on Next; full legacy DD dashboard not ported | PMS links from hub → legacy |
| **marketing** | Events, Social media, Portfolio | — |
| **HR-heavy roles** | Full `/hr/*` attendance module | HR-related **Reports** submenu still legacy |

---

## 6. Is session / recent commit mein kya add hua

- Home **dashboard layout** (broad KPI column + widget column).  
- **Quick links** wired to Next routes; ported pages for commission, performance, grade, appointments.  
- **Appointment modal** compact UI.  
- **Sidebar:** removed “Next home” / “API Health”; Dashboard **with icon**.  
- **Mobile:** bottom navigation + menu drawer.  
- Full **`frontend-next/`** tree pushed on `fix/upgrade_frontend_habib`.

---

## 7. Baqi kaam — suggested priority (admin gap)

| Priority | Module | Effort (rough) | Why |
|:--------:|--------|----------------|-----|
| **P1** | **PMS** | Large (8+ screens, workflows) | Admin/dd_manager daily use |
| **P1** | **Support (Tickets)** | Medium | Complaint box on dashboard already calls support APIs |
| **P2** | **Account** | Medium | Finance / GM entries |
| **P2** | **Office Account** | Medium | Ledger / COA |
| **P2** | **Reports** (main menu) | Large (many `/reports/*`) | Overlap plan with User Reports + route matrix |
| **P3** | Full **D&D Manager** dashboard port | Large | Hub exists; legacy dashboard ~1500 lines |
| **P3** | Playwright smoke on admin paths | Small | Close “QA not run” gaps in phase docs |

---

## 8. Kaise verify karein

```bash
# Terminal 1 — backend (if not running)
cd backend && npm run dev

# Terminal 2 — Next
cd frontend-next && npm run dev
# Open http://localhost:3000 — login as admin

# Optional — legacy sidebar targets
# frontend-next/.env.local:
# NEXT_PUBLIC_LEGACY_APP_ORIGIN=http://localhost:5173
```

```bash
cd frontend-next && npm run typecheck && npm run test:navigation
```

---

## 9. Related docs

| Doc | Purpose |
|-----|---------|
| `docs/route-matrix/route-matrix.csv` | Full route inventory |
| `docs/FOUNDATION_STATUS.md` | Phase 1–4 foundation |
| `docs/PHASE16_DRM_SETTING.md` | DRM Setting migration |
| `docs/PHASE17_1_STATUS.md` | Users module |
| `docs/CUSTOMER_MODULE_COMPLETION_REPORT.md` | Customer module |
| `docs/MIGRATION_PLAN.md` | Overall plan (repo root docs) |

---

## 10. One-line status for management

**~76% sidebar groups largely on Next; admin ke liye 5 module groups (PMS, Support, Account, Office Account, Reports) ab bhi legacy par hain — agla focus in par hona chahiye.**

*Generated from `navigation-config.ts`, `migrated-routes.ts`, and phase status docs in `frontend-next/docs/`.*
