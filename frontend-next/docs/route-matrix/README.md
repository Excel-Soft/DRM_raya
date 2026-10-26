# Route matrix (Phase 0A)

| File | Purpose |
|------|---------|
| `route-matrix.json` | Full machine-readable inventory |
| `route-matrix.csv` | Spreadsheet / review |
| `reconciliation-report.md` | Gaps, aliases, ownership, open Phase 0 items |

Regenerate after legacy route changes:

```bash
node frontend-next/scripts/build-route-matrix.mjs
```
