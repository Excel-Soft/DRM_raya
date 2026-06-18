# PATCH 5 — Management Confirmation Required

These business rules **cannot be inferred from code** and must be confirmed by
management before the corresponding Patch 5 items are implemented. Per the Stage 0
constraints, **no assumption was hard-coded** for any of the following.

Each question includes the code-observed *current* behaviour for context, so the
decision can be made against what the system does today.

---

### 1. Is Service Executive officially allowed to create GM records?
*Current code:* the dedicated `POST /api/service/gm` returns **501 (stub)**, but
the generic GM-create routes (`POST /api/gm`, `POST /api/account/gm-entries`) are
**authentication-only** because the URL-permission middleware fails open and the
permission table is unpopulated — so a Service Executive is **not blocked at the
backend** today. The sidebar exposes the GM-create page to `service_executive`.
*Impacts:* P1, P13.

### 2. Is Service Executive officially allowed to create manual invoices?
*Current code:* the new workflow route `POST /api/invoices` enforces backend
`requireRole("sales_executive","sales_manager","admin")`, but the **visible page**
(`sales/create-invoice.tsx`) posts to the **legacy `POST /api/account/invoices`
(auth-only)** route, and the page itself gates on
`canCreateInvoice = userRoleName === "sales_executive"` (**frontend only**).
Please confirm exactly which roles may create manual invoices (the legacy route
also needs a backend role guard).
*Impacts:* P7, P13.

### 3. What are the minimum payment threshold rules by GM type and package?
*Current code:* only positivity checks (`amount > 0`, `pkr_amount > 0`,
`dollar_rate > 0`); **no minimum threshold** exists. Please specify the minimum
required payment per **GM type** (Full / Partial / Loan) and per **package**.
*Impacts:* P3.

### 4. Should the three default invoices be generated during GM creation, or only after final GM approval?
*Current code:* the three zero-amount invoices ("Alibaba Product Posting",
"Alibaba Minisite", "Listing Page") are created **at GM creation**
(`createProductPostingInvoices`). Patch 5 P6 asks for post-approval timing —
please confirm the desired point of generation.
*Impacts:* P6, P9.

### 5. Must Product Posting always wait for Listing Page QA approval?
*Current code:* there is **no backend dependency** — Product Posting tasks can be
assigned without the related Listing-Page project passing QA. Please confirm
whether Listing-Page QA approval must be a hard prerequisite (and the exact
matching key: per customer, per order, per project).
*Impacts:* P10.

### 6. Does Verification Manager remain a required final stage after QA completion?
*Current code:* the product-posting workflow has `QA_COMPLETE →
VERIFICATION_PENDING → VERIFICATION_COMPLETE`, but a required Verification stage
is **not uniformly enforced across all department lifecycles**. Please confirm
whether Verification is mandatory as the final stage for every department.
*Impacts:* P11.

### 7. What is the exact initial project status after final invoice approval: Active, Documents Pending, or another status?
*Current code:* projects created from the manual path are set to **`"Active"`**
by default (`create-project-from-gm`). Please confirm the canonical initial
project status after final invoice approval.
*Impacts:* P9, P12.
