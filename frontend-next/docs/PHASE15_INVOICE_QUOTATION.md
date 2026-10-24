# Phase 15 — Invoice & Quotation migration (tracker)

**Project:** DRM WebExcels  
**Branch:** `fix/upgrade_frontend_habib`  
**Owner:** Habib  
**Depends on:** Phase 14 Customer (pools + attribute links hit these routes)  
**Overall status:** **In progress** — 15A + 15B wired; 15C pending

---

## 1. Scope map

| Piece | Legacy route | Proposed Next route | Legacy source | Next today |
|-------|--------------|---------------------|---------------|------------|
| **Quotation** (create/edit) | `/sales/quotation?leadId=` | `/dashboard/sales/quotation` | `frontend/src/pages/quotation.tsx` (~827) | **15A** — `quotation-view.tsx` + page + redirects |
| **Create invoice** | `/sales/create-invoice/:customerId` | `/dashboard/sales/create-invoice/[customerId]` | `frontend/src/pages/sales/create-invoice.tsx` (~871) | **15B** — `create-invoice-view.tsx` + page + redirects |
| **Invoice pool** (sidebar) | `/sales/invoice-pool` | `/dashboard/sales/invoice-pool` | `invoice-pool.tsx` (~375) | **MVP** — `invoice-pool-view.tsx` (tabs + JSON detail) |

**Out of Phase 15 (later / other module):**

- Account **Make Invoice** — `/account/invoices` (Account sidebar)
- Analytics invoice report — `/analytics/invoice`
- HOD/account approval queues for invoices (HOD/Account modules)

---

## 2. Sub-phases (recommended order)

| Sub-phase | Deliverable | Why this order |
|-----------|-------------|----------------|
| **15A** | Quotation page + redirects + `leadId` / edit id query parity | Attribute **Quotation** chip + sales workflow entry; confirms products/GST math before invoice |
| **15B** | Create invoice page + print/PDF parity (or staged: submit first, PDF second) | Private pool **Invoice** action; may prefill from `quotationId` |
| **15C** | Invoice pool UI parity (formatted detail, actions vs legacy) | Sidebar item already on Next; polish after create path exists |

---

## 3. Primary APIs (no backend schema work expected)

### Quotation (`quotation-routes.ts`)

- `GET /api/quotations?leadId=`
- `GET /api/quotations/:id`
- `POST /api/quotations`, `PUT /api/quotations/:id`
- `POST /api/quotations/:id/confirm`, `hod-approve`, `hod-reject`, `resubmit`

Supporting (shared with invoice):

- `GET /api/sales/services` (product catalog / departments)
- Lead/customer profile as needed for header fields

### Create invoice (`create-invoice.tsx` → account routes)

- `GET /api/sales/customers/:id`
- `GET /api/quotations/:id` (optional prefill)
- `GET /api/account/invoices/next-number`
- `POST /api/account/invoices`, `PATCH /api/account/invoices/:id`
- `GET /api/auth/me`, workflow gates (`useServiceExecutiveCreateGates` equivalent)

### Invoice pool (already wired)

- `GET /api/sales/invoice-pool`
- `GET /api/sales/invoice-pool/:id`

---

## 4. Shared UI to extract (both 15A & 15B)

- Department / role gate (`isDepartmentAllowed` — port to Next util or server-side check only)
- Product combobox + line items grid (qty, unit price, years, domain URL on quotation)
- Totals: subtotal, GST %, discount PERCENT/AMOUNT, grand total, PKR (dollar rate on quotation)
- Skeleton loaders on catalog + customer fetch (match Phase 14 follow-up modal pattern)

Legacy uses Radix Command popover + SweetAlert2 — Next should use existing `@/components/ui/*` + `toast` unless Habib wants Swal parity.

---

## 5. Navigation & redirects

Add to `customer-routes.ts` / `legacy-redirects.ts` / `next.config` when pages exist:

| Legacy | Next |
|--------|------|
| `/sales/quotation` | `/dashboard/sales/quotation` |
| `/sales/create-invoice/:customerId` | `/dashboard/sales/create-invoice/:customerId` |

Update **Private Pool** and **Customer Attribute** links from bare `/sales/...` to dashboard paths.

---

## 6. Verification

```bash
cd frontend-next
npm run typecheck && npm run test:unit && npm run build
```

Manual (talha / sales executive):

1. Attribute → **Quotation** → create/save with `leadId`
2. Pool row → **Invoice** → create → appears in **Invoice Pool**
3. Invoice pool tabs + detail match legacy statuses

---

## 7. Recommendation

Start **15A (Quotation)** in the next dev session — unblocks attribute and pool links without waiting for full PDF invoice stack. **15B** immediately after; **15C** can overlap once list/detail API shape is stable.

**Do not** mark Phase 15 complete until Habib signs off quotation + create-invoice on `:3001` standalone.
