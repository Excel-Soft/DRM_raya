---
name: GM tracking flags vs approval state machine
description: gm_entries hod_status/accountant_status are Done/Pending tracking flags, NOT the approval workflow; and the lesson to grep the client before dropping endpoint fields.
---

# GM `hod_status` / `accountant_status` are tracking flags, not approval state

`drm.gm_entries` has two parallel, easily-confused groups of columns:

- **Lightweight tracking flags** — `hod_status`, `accountant_status` hold simple
  `Pending` / `Done` values. They are surfaced as editable dropdowns in the
  **Lead Pools** table (`client/src/pages/lead-pools.tsx`, `updateGmStatus`
  mutation → `PATCH /api/gm-pool/:id` with `hodStatus` / `accountantStatus`).
- **Formal approval state machine** — `approval_status`
  (`pending_hod` → `pending_managers` → `approved` / `rejected_by_*`),
  `account_manager_status`, `sales_manager_status`, `super_hod_status`,
  `final_status`. These move ONLY through the dedicated approval routes
  (`hod-approve`, `account-manager-approve`, `sales-manager-approve`,
  `super-hod-approve`, …) which carry SQL `WHERE approval_status = '...'` stage
  guards. They are **not** in the `PATCH /gm-pool/:id` `updateSchema`, so they were
  never writable through the edit endpoint.

**Why this matters:** dropping `hod_status`/`accountant_status` from the PATCH edit
endpoint does NOT close an approval backdoor (those aren't approval columns) — it
silently breaks the Lead Pools dropdowns. The genuine broken-access-control fix for
that endpoint is the **role guard** (`requireGmSalesActionPermission(GM_EDIT)`); the
endpoint was previously authentication-only.

**How to apply:** treat `hod_status`/`accountant_status` as operational tracking
flags, distinct from the approval workflow. Before "narrowing" any write endpoint by
removing accepted fields, **grep the client** (`client/src/`) for actual senders of
those fields — an architect review caught a silent no-op regression here because the
fields were dropped on the assumption "no client sends them" when the Lead Pools
table did.
