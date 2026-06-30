# Domain Hosting (Domains + Backup) — QA Matrix (Patch 7 Stage 5)

Manual QA for the **secondary** IT Domain/Hosting pages hardened in Patch 7
Stage 5: IT Domains (`/it/domains` → `client/src/pages/it-domains.tsx`) and IT
Backup (`/it/backup` → `client/src/pages/it-backup.tsx`). The **primary** page
(`/it/servers`, Server Names CRUD) is covered by
`DOMAIN_HOSTING_SERVER_NAMES_QA.md` and is unchanged this stage.

Roles: **IT read** = a role in `IT_READ_ROLES`; **IT write** = a role in
`IT_WRITE_ROLES`; **Non-IT** = any other authenticated user.

## IT Domains (`/it/domains`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| D1 | List loads | Open page | Rows from `GET /api/it/domains`; loading spinner first. |
| D2 | Search filters real data | Type part of a domain in **Search** | List narrows by real `domainName`; no decorative Company/Person/Contact/Email card (removed — unbacked). |
| D3 | CSV export is real | Click **CSV** | `it_domains.csv` downloads with the current rows (No, Company, Domain, Domain/Hosting/SSL Expiry, Status, Registered). |
| D4 | Excel export is real | Click **Excel** | `it_domains.xlsx` downloads (xlsx). |
| D5 | No PDF / no fake toast | Inspect export buttons | **No PDF button**; exporting an empty list shows "No data to export" — never a false "exported successfully". |
| D6 | Copy / Print | Click **Copy** / **Print** | Copy puts tab-separated rows on the clipboard; Print opens the print view. |
| D7 | Status badges are derived | Look at Domain/Hosting/SSL cells | Badge = `Expired` / `N d left` / `Active` / `N/A`, computed from the real expiry dates (no hardcoded "Renew"). |
| D8 | Unbacked fields honest | Open the **Attribute** dialog | Grade and Contact show **N/A** (not `D`/`0`); Company/Email show real value or N/A. |
| D9 | Message composer (no provider) | Open Attribute → **Renewal Message** | Textarea prefilled from real expiry fields; **Copy Message** copies to clipboard; no "WhatsApp"/"sent" claim. |
| D10 | Quotation honesty | Open the **Quotation** (refresh icon) dialog | Line total shows **"Not available"** with a note; **no "Generate Quotation"** button (it did nothing). |
| D11 | Empty state | No domains / no search match | "No domains found" row. |

## IT Backup (`/it/backup`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| B1 | List loads | Open page | Rows from `GET /api/it/backups` (IT-read gated); `domainId` shown as `domainName`. |
| B2 | Create valid | Pick Domain + Backup Type (+ URL/details) → submit | `POST /api/it/backups` → **201**; list invalidates/refreshes; success toast; audit `it_backup.create` (module `domain_hosting`). |
| B3 | Create validation | Submit with required field missing | Backend Zod rejects → **400**; sanitized error toast; **no false success**. |
| B4 | Create RBAC | As **Non-IT / IT-read**, POST a backup | **403**; sanitized toast; nothing created. |
| B5 | Unauthenticated | POST with no token | **401**. |
| B6 | No dead controls | Inspect the table | No dead delete (trash) icon and no dead pagination (no backing soft-delete / paged endpoint). |
| B7 | Sanitized validation error | POST a wrong-typed body (e.g. `backupType` as a number) | **400** with `{ error: "<message>" }` (e.g. "Expected string, received number"); **no raw Zod JSON / `issues` array**. Same for `POST /api/it/domains`. |

## RBAC summary (APIs)

| Endpoint | Read | Write |
|---|---|---|
| `GET /api/it/domains` | IT_READ_ROLES | — |
| `GET /api/it/backups` | IT_READ_ROLES | — |
| `POST /api/it/backups` | — | IT_WRITE_ROLES (+ audit) |

## Regression (this stage)

- `npm run check` (tsc): clean.
- `npm test` (vitest): 227 passed.
- Smoke (minted JWT): backup POST 401 / 403 / 400 / 201; domains GET 200.
- Server Names (`/it/servers`) CRUD unchanged (see its own QA doc).
