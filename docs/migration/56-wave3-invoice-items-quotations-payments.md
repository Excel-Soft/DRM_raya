# Wave 3 — Invoice items, Quotations, Payments (`drm_legacy_stage`)

**Live VPS `.env` / PM2:** unchanged

## 3A — `webxl_invoice_item` → `drm.invoices.items`

| | |
|--|--:|
| Line rows processed | 14,172 |
| Invoices updated | **10,366** |
| Script | `run-invoice-items-backfill.mjs` |

JSON shape: `[{ name, description, unitPrice, quantity, total }]`

## 3B — `webxl_quotations` + `webxl_quotation_items`

| | |
|--|--:|
| Archive quotations | 5,931 |
| Migrated | **5,921** |
| Rejected (unmapped user) | 10 |
| Quotation item rows | **~11k** (inserted with headers) |
| DDL | `ddl/08_quotations_workflow_columns.sql` |
| Script | `run-quotations-transform.mjs` |

## 3C — `webxl_payments` → `drm.ledger_entries`

| | |
|--|--:|
| Archive payments | 10,625 |
| Ledger entries created | **5,599** |
| Rejected | 5,026 (no linked migrated invoice and/or zero/invalid amount) |
| Script | `run-payments-transform.mjs` |

Payments link: `reference_type='invoice'`, `reference_id` = modern invoice UUID, `entry_type='Credit'`, `category='Invoice'`.

## Mac verify

```bash
psql "$DATABASE_URL" -c "
SELECT count(*) FILTER (WHERE items <> '[]') AS invoices_with_lines FROM drm.invoices;
SELECT count(*) FROM drm.quotations;
SELECT count(*) FROM drm.ledger_entries;"
```

## Notes

- Remaining payments without `webxl_invoice` map stay in archive only; extend invoice migration if needed.
- Quotation HOD columns added for workflow parity with app routes.
