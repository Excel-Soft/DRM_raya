# PATCH 5 — Data Integrity QA

Verifies that Patch 5 writes/reads preserve correctness: no duplicates, no double
counting, balanced money, consistent type derivation, and validated config. Method:
**CODE** inspection of the services + existing unit tests; figures are read from real
tables (no mock data).

---

## 1. Default invoices — no duplicates per GM
- **Rule:** exactly three invoices (`LISTING_PAGE`, `MINIWEBSITE`, `PRODUCT_POSTING`)
  per GM, generated once at the configured event.
- **Mechanism:** `generateDefaultInvoicesForGm` iterates the closed `INVOICE_TYPE_VALUES`
  and is **idempotent** — re-running at the same/again event does not create extra rows.
- **Status:** **PASS (CODE).** Count is bounded by the enum (3); generation guarded by
  `gmInvoiceGenerationTiming` event match.

## 2. Loans not double-counted in dashboards
- **Rule:** a GM with multiple loan-term/receipt rows must count once.
- **Mechanism:** `gm-summary` aggregate uses `DISTINCT ON (gm_id)` and per-GM CTEs so a
  GM contributes a single row; receipts are summed, not row-multiplied.
- **Status:** **PASS (CODE).** No fan-out double counting; widgets fall back to explicit
  0/empty (no fabricated values).

## 3. Partial receipts — balance identity holds
- **Rule:** `received + remaining = target`, and `remaining ≥ 0` at finalisation.
- **Mechanism:** server sums `drm.gm_partial_receipts(amount_usd)` for the `gm_id`;
  final approval rejected with **409 PARTIAL_PAYMENT_INCOMPLETE** while
  `(target − received) > 0.009` (float epsilon). Remaining is derived, never stored
  divergently.
- **Status:** **PASS (CODE).**

## 4. GM type derivation is single-sourced
- **Rule:** Full/Partial/Loan is derived deterministically, never contradictory.
- **Mechanism:** `resolveCanonicalGmType` precedence: explicit `canonicalGmType` >
  `loanMode` enum > `is_loan` / `is_partial_payment` columns. One resolver feeds both
  routing and the approval-path selection.
- **Status:** **PASS (CODE).**

## 5. One project per approved invoice
- **Rule:** an approved invoice yields exactly one linked `INVOICE_ROOT` project.
- **Mechanism:** `createOrLinkProjectForApprovedInvoice` creates-or-links idempotently;
  repeated calls return the same project id.
- **Status:** **PASS (CODE).**

## 6. Cross-entity id type safety (no 500s on joins)
- **Rule:** raw-SQL joins/UNIONs across `opportunities` (varchar id) and `customers`
  (uuid id) must cast to avoid type-mismatch errors.
- **Mechanism:** affected queries cast with `::text`; cross-department ledger references
  real user UUIDs.
- **Status:** **PASS (CODE).** (Known historical pitfall; casts in place.)

## 7. Config values are validated
- **Rule:** only known keys with valid types/enums can be persisted.
- **Mechanism:** `gm-sales-config.service` validates against the zod schema in
  `shared/gm-sales-constants.ts`; unknown keys → **CONFIG_VALIDATION_FAILED**; enums
  (timing, project status, project-generation mode) constrained; `minimumPaymentThresholds`
  is a typed nested map. Table seeded idempotently; existing values never overwritten.
- **Status:** **PASS (CODE).**

## 8. Zero-amount / placeholder invoices cannot be approved
- **Rule:** placeholder (amount 0) invoices block approval until completed.
- **Mechanism:** `assertApprovalReadiness` requires `amount > 0` (plus customer + type)
  → **400 INCOMPLETE_INVOICE**.
- **Status:** **PASS (CODE).**

## 9. Money fields validated at creation
- **Rule:** monetary inputs must be positive.
- **Mechanism:** GM create enforces `amount > 0`, `pkr_amount > 0`, `dollar_rate > 0`;
  threshold check layered on top when configured.
- **Status:** **PASS (CODE).**

---

## Summary

All nine data-integrity properties hold by construction (idempotent generators,
single-source type derivation, summed-not-multiplied money, deduped aggregates,
validated config). No mock or placeholder values are written or displayed; failures are
explicit (4xx/409) rather than silent. Full seeded end-to-end reconciliation is
recommended as a manual pass before production sign-off.
