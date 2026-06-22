# Office Accounts — Patch 6 Stage 7 QA Matrix

Manual QA for the retained Office Accounts pages touched in Stage 7. Roles:
**Financial** = a role in `STAGE2_FINANCIAL_ROLES`; **Non-financial** = an
authenticated user without that role.

## Trial Balance (`/office/trial-balance-report`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| TB1 | Generate real report | Open page → click **Generate Report** with no filters | Real rows from `account_heads` + `ledger_entries`; totals row; no `console.log`-only behaviour. |
| TB2 | Loading state | Click Generate on a slow load | Table shows "Loading trial balance…". |
| TB3 | Empty state | Filter to a category/branch with no matching active heads | "No accounts match these filters." |
| TB4 | Error state | Force a backend error (e.g. invalid `startDate` after `endDate`) | Sanitized message shown in-table (no raw stack); no crash. |
| TB5 | Date window | Set start/end dates | Opening folds movement strictly before `start`; period = within `[start, end-of-day]`; end date inclusive. |
| TB6 | Category filter | Select one/more categories (Assets…Expenses) | Only those categories returned (real `account_heads.category`). |
| TB7 | Branch filter | Type/pick a branch from the suggestion list | Only heads in that branch. |
| TB8 | Include zero balances | Toggle the checkbox | Off = all-zero heads dropped; On = every filtered head shown. |
| TB9 | Balanced ledger | Use a balanced data set | `imbalance = false`; no warning banner. |
| TB10 | Imbalance flag | Use a set where ΣclosingDr ≠ ΣclosingCr (>0.01) | Red imbalance banner with the difference. |
| TB11 | Currency warning | Ledger spans >1 currency | Amber banner; totals shown but flagged as not currency-converted. |
| TB12 | Export RBAC | As **Financial**, click **Export CSV** | CSV downloads (`trial-balance.csv`); audit record written (`trial_balance.export`). |
| TB13 | Export denied | As **Non-financial**, call the export endpoint | 403; sanitized error toast; no file. |
| TB14 | Pagination | Large head count | Returned rows paginated; totals still reflect the full filtered set; footer notes "Showing N of M". |

## Office Expenses (`/office/expenses`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| EX1 | Create valid | Add Expense with head/office/amount>0 | 201; row appears; success toast; audit `expense.create`. |
| EX2 | Create amount ≤ 0 | Submit amount `0` or negative | Client blocks ("Amount must be greater than 0"); backend also rejects (`assertPositiveAmount`). |
| EX3 | Create invalid date | Submit a bad `expenseDate` | Rejected (`assertValidDate`); sanitized error. |
| EX4 | Create failure honesty | Force backend 400/500 on create | Error toast with backend message; dialog stays open; **no false "added successfully"**. |
| EX5 | Edit persists | Click pencil → change amount/detail → Save | PATCH `/expenses/:id`; row updates; "updated successfully"; audit `expense.update` with before/after. |
| EX6 | Edit RBAC | As **Non-financial**, attempt edit | 403; sanitized toast; no change. |
| EX7 | Edit mass-assignment guard | Send a non-whitelisted field | Ignored via `pickWritable`; only whitelisted columns change. |
| EX8 | Edit amount ≤ 0 | Edit amount to 0/negative | Rejected client + server. |
| EX9 | Delete with reason | Click trash → enter reason | Hard delete; audit `expense.delete` with reason. |
| EX10 | Delete without reason | Cancel the reason prompt | Cancelled; nothing deleted. |
| EX11 | Filters → real columns | Filter by date range / office / head | Only real columns hit the API (`startDate`,`endDate`,`office`,`accountingHead`→`expense_head`). No dead Parent/Child/Transactional controls remain. |
| EX12 | Head options are real | Open the Head filter | Options derive from real `expense_head` values present in the data (+ keeps any current selection visible). |
| EX13 | Export CSV/Excel | Use the two export buttons | File downloads with current list. |
| EX14 | Loading/empty/error | Slow load / no data / forced 4xx-5xx on the list | "Loading…", then "No expenses generated yet." when empty, and "Failed to load expenses. Please try again." on error (no silent empty list — list + cheques go through `apiRequestJson`). |
| EX15 | Edit preserves off-list value | Edit a row whose `office`/`expenseHead` is not in the static enumeration | The dialog shows and keeps the real value (options = static ∪ real data ∪ current value); saving without touching it does not blank it. |

## Office VAS (`/office/vas`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| VAS1 | List loads via shared helper | Open page; set date range → View | Rows load through `apiRequestJson` (auth header attached). No raw `fetch`. |
| VAS2 | Loading state | Slow load | "Loading…". |
| VAS3 | Empty state | Range with no paid invoices | "No records found." |
| VAS4 | Error state | Force backend error | "Failed to load VAS records. Please try again." (sanitized). |

## Cross-cutting

| # | Scenario | Expected |
|---|---|---|
| X1 | No raw backend errors | All error paths surface sanitized messages (envelope `error.message` / status fallback), never stack traces. |
| X2 | No console-only buttons | Generate / Export / Save / Edit all hit real endpoints. |
| X3 | No mock-only data | Trial Balance and Expenses render DB-sourced rows; removed mock filter arrays. |
| X4 | Audit coverage | create/update/delete on expenses and trial-balance export all write `AuditLogService` records. |
