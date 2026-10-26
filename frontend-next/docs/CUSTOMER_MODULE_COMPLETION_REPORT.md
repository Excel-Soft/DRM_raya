# Customer module — completion report (Next.js migration)

**Project:** DRM WebExcels  
**Branch:** `fix/upgrade_frontend_habib`  
**Prepared for:** Mohammad / Habib handoff  
**Date:** 2026-10-24  
**Next suggested module:** **DRM Setting** (Attributes, Drm Permission, … — still on legacy Vite)

---

## Executive summary

| Area | Verdict |
|------|---------|
| **Customer sidebar (11 items)** | All have Next routes, redirects, nav + guards; **daily use paths work on `:3000` dev / `:3001` standalone** |
| **Internal sales flows** | Attribute hub, **Quotation**, **Create invoice**, PDF download — **implemented** (legacy `InvoiceReceipt`-style slip) |
| **Formal “100% legacy parity”** | **Not claimed** — GM advanced modals, invoice pool detail UI, some attribute action modals, Active Clients orphan |
| **Ready to start DRM Setting?** | **Yes**, with Customer tracked as **maintain + sign-off in parallel**; keep Vite fallback for edge cases |

---

## 1. Customer sidebar — sub-module status

| # | Submodule | Next route | Status | Notes |
|---|-----------|------------|--------|-------|
| 1 | Check Duplication | `/dashboard/sales/duplicate-checker` | **Done** | Debounced API search; unit tests |
| 2 | Add Customer | `/dashboard/sales/add-customer` | **Done** | Form, CSV import, autofill QA helpers |
| 3 | Temporary Contact | `/dashboard/customer/temporary-contact` | **Done** | List, POST, convert → Add Customer |
| 4 | Private Pool | `/dashboard/customers/private-pool` | **Done** | Sales + service role variant; tracing tabs, follow-up, invoice/quotation links |
| 5 | Service Pool | `/dashboard/customers/service-pool` | **Done** | Assign, filters, follow-up, export |
| 6 | GM BV Pool | `/dashboard/gm-pool/add-gm` | **Done (core)** | Add GM form, payment proof upload, pool table; full loan/edit/withdraw parity → legacy if needed |
| 7 | In service Report | `/dashboard/reports/in-service` | **Done** | Matches legacy **mock** charts (no API) |
| 8 | Public Pool (Pick up) | `/dashboard/customers/public-pool` | **Done** | Pick / list parity with sales/service split |
| 9 | Public Pool (Follow up) | `/dashboard/customers/public-pool-followup` | **Done** | Main/sub services, claim, FollowupModal |
| 10 | Invoice Pool | `/dashboard/sales/invoice-pool` | **Partial (15C)** | Tabs + list + **JSON detail**; formatted legacy detail deferred |
| 11 | Active Clients | `/dashboard/sales/active-clients` | **Placeholder** | Sidebar orphan documented; no legacy page |

**Infrastructure (all sidebar items):**

- `customer-routes.ts` — canonical paths + helper URLs  
- Legacy redirects in `legacy-redirects.ts` / `next.config.ts`  
- `navigation-config.ts` + role visibility + `route-access` guards  
- `instant = false` + Suspense on dynamic/heavy pool pages (Next 16 instant-nav)

---

## 2. Internal routes (not sidebar — linked from Customer UI)

| Route | Next path | Status |
|-------|-----------|--------|
| Customer attribute / follow-up hub | `/customers/attribute/[id]` | **Done** — profile, action chips, history tabs, follow-up modal |
| Quotation create/edit | `/dashboard/sales/quotation?leadId=&id=` | **Done (15A)** — save API, dept gates, **PDF** (title **QUOTATION**) |
| Create invoice | `/dashboard/sales/create-invoice/[customerId]?quotationId=` | **Done (15B)** — POST/PATCH invoice, quotation prefill, **PDF** (title **INVOICE**), receipt modal |
| Legacy bookmarks | `/sales/quotation`, `/sales/create-invoice/:id` | **Redirect** → dashboard paths |

---

## 3. Phase 14 sub-phases (tracker alignment)

| Sub-phase | Scope | Completion |
|-----------|--------|------------|
| **14A** | Nav, redirects, duplicate checker, add customer, invoice pool MVP, in-service report, active clients stub | **Complete** (invoice pool polish → 15C) |
| **14B** | Temporary contact, service pool, public pool follow-up | **Complete** |
| **14C** | GM BV pool, private/public pools (sales + service) | **Complete (core)**; deep GM/history/print on Next-only host may 404 → legacy |

---

## 4. Phase 15 — Invoice & quotation (Customer-adjacent)

| Sub-phase | Deliverable | Status |
|-----------|-------------|--------|
| **15A** | Quotation page + redirects + line items + save | **Done** |
| **15B** | Create invoice + gates + save + PDF + print slip | **Done** |
| **15C** | Invoice pool formatted detail / actions | **Not started** |

**PDF stack (15A/15B):**

- Shared `InvoiceReceipt` (inline hex styles — html2canvas + Tailwind `lab()` safe)  
- Logo: `public/webexcels-logo.png`  
- Filename: `{CompanyName}_{YYYY-MM-DD}.pdf`  
- Quotation vs invoice titles and footers separated  

**Still deferred vs legacy Vite:**

- Radix Command product combobox (Next uses `Select` + toast)  
- SweetAlert2 (Next uses sonner toast)  
- Full `AttributeActionModal` (GM Doc upload, Update Expiry UI) — partial on attribute page  

---

## 5. Key files (for reviewers)

| Area | Location |
|------|----------|
| Customer UI | `frontend-next/src/modules/customer/` |
| Quotation / invoice | `frontend-next/src/modules/sales/` |
| PDF | `frontend-next/src/lib/pdf/` |
| Routes | `frontend-next/src/lib/navigation/customer-routes.ts` |
| App pages | `frontend-next/src/app/(app)/dashboard/...`, `customers/attribute/...` |
| Trackers | `PHASE14_CUSTOMER_MIGRATION.md`, `PHASE15_INVOICE_QUOTATION.md` |

---

## 6. Verification (automated)

```bash
cd frontend-next
npm run typecheck
npm run test:navigation
npm run test:unit
npm run build
```

**Manual sign-off (Habib / talha — sales executive):**

1. Private pool → filters, follow-up, **View** → attribute (no 404)  
2. Attribute → **Quotation** → save → PDF **QUOTATION** → private pool  
3. Pool → **Invoice** → save → PDF **INVOICE** → invoice pool row  
4. GM pool → add GM + payment proof (if used)  
5. Service vs sales role: private/public pool variant  

---

## 7. Open items before calling Customer “closed”

| Item | Priority |
|------|----------|
| **15C** — Invoice pool detail UI (not JSON) | Medium |
| GM pool history/print routes on Next-only deploy | Low (legacy URLs) |
| Attribute — GM Doc / Update Expiry full modal parity | Medium |
| Active Clients — product decision | Low |
| Habib formal browser sign-off on `:3001` standalone | **Required for “closed”** |

---

## 8. Recommendation — move to **DRM Setting**

- **Customer module** is **migration-complete for operational workflows** (pools, add customer, temp contact, GM core, quotation, invoice, PDF).  
- Treat remaining rows in §7 as **backlog**, not blockers for starting **DRM Setting** migration.  
- **DRM Setting** (legacy): e.g. `/drm/attributes`, `/drm/permission` — see `navigation-config.ts` group `DRM Setting`; **not yet** under `/dashboard/*` in Next.

**Suggested next doc:** `PHASE16_DRM_SETTING.md` (scope from `app-sidebar.tsx` + route registry), same pattern as Phase 14.

---

## 9. Ops reminder

- Dev: `frontend-next` **`npm run dev`** → `:3000`  
- Prod-like: **`npm run build`** → `start:standalone` → `:3001` + Express `:5001`  
- After build: **restart standalone + hard refresh** (avoid stale chunks)
