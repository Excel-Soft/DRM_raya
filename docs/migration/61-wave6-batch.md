# Wave 6 batch (GM, HR, finance, posting)

**DB:** `drm_legacy_stage`

Resume Wave 5 partials → payments tail → 13 new modules.

| Module | Source → Target |
|--------|-----------------|
| departments | `webxl_department` → `drm.departments` |
| roles | `webxl_role` → `drm.roles` |
| gmaccount | → `legacy_gm_accounts` |
| gmaccount_history | → `legacy_gm_account_history` |
| verify_gm_cash / verify_gm_delay | → legacy verify tables |
| invoice_item_pay | → `legacy_invoice_item_payments` |
| posting_keywords | → `product_posting_data` |
| posting_mimg | → `legacy_posting_main_images` |
| leave / overtime | → `leave_requests` / `overtime_records` |
| expense | → `office_expenses` |
| complaints | → `support_tickets` + messages |

```bash
bash scripts/migration/run-wave6-all-sequential.sh   # log: /tmp/wave6-migrate.log
```
