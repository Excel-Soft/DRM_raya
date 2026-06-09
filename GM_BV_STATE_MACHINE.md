# GM / BV Lifecycle State Machine

`server/utils/gm-bv-state-machine.ts` defines the canonical lifecycle used to
validate transitions on the existing GM/BV endpoints. Existing database columns
(`approval_status`, `account_manager_status`, `final_status`, `status`,
`withdrawal_status`) are preserved; the helper maps them to canonical states via
`mapToCanonical()` and writes back using the existing columns.

## Canonical statuses
`draft`, `pending_hod`, `pending_managers`, `pending_account_manager`,
`approved`, `rejected`, `pending_withdrawal`, `withdrawn`, `refund_pending`,
`refunded`, `cancelled`, `expired`.

## Transition rules
- Transitions not present in `ALLOWED_TRANSITIONS` are rejected with **409**.
- Transitions whose target is in `REASON_REQUIRED_TARGETS` (reject / withdraw /
  refund / cancel) require a non-empty reason, otherwise **400**.

## Reason-required actions (enforced on live endpoints)
- `POST /gm-pool/:id/hod-reject` — comment required.
- `POST /gm-pool/:id/account-manager-reject` — comment required.
- `POST /gm-pool/:id/request-withdraw` — reason required.
- `POST /api/account/refund-gm` — comment required.

## Approval chain (unchanged)
1. Sales Executive creates a GM entry → `pending_hod`.
2. HOD approves → `pending_managers`; HOD rejects (with reason) → `rejected`.
3. Account Manager approves → `approved` (Sales Executive notified); rejects
   (with reason) → `rejected`.
4. Withdrawal: Sales Executive requests (with reason) → `pending_hod` for
   withdrawal; HOD approves → `withdrawn`.

## Duplicate-active guard
The pre-existing check that prevents a second active GM entry for the same
source/customer/project remains in force; override requires the appropriate role.
