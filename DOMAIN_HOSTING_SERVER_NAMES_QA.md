# Domain Hosting / Server Names — QA Matrix (Patch 6 Stage 6)

Manual QA for the IT Domain Hosting page (`/it/servers` →
`client/src/pages/it-servers.tsx`) and its APIs after the Stage 6 build.

## Pre-conditions
- Logged in as an IT role with write access (`IT_WRITE_ROLES`) for create/delete
  cases; an IT read-only role for the RBAC checks.
- App running (`npm run dev`, port 5000).

## Domain create form

| # | Action | Expected |
| --- | --- | --- |
| 1 | Open the page | The create form shows controlled fields: Company (optional), Domain Name*, Registry, Hosting Server, Hosting Package, cPanel Username, Activation Date, Expiry Date. No SSL / First Date / Active Duration / cPanel Password fields. |
| 2 | Click **Submit** with an empty Domain Name | Inline error "Domain name is required"; no request sent. |
| 3 | Enter `not a domain` and Submit | Inline error "Enter a valid domain name (e.g. example.com)". |
| 4 | Set Activation Date after Expiry Date and Submit | Inline error "Expiry date cannot be before activation date". |
| 5 | Enter `example.com` only and Submit | Toast "Domain added"; form resets; the new row appears in the table; it **persists after a page refresh**. |
| 6 | Pick a Company from the dropdown, Submit | Domain saved with that `customer_id` (real customer row, FK-safe). |
| 7 | Submit a domain name that already exists | Request fails with `409`; toast shows "A domain with this name already exists"; no duplicate row. |
| 8 | Inspect the create response / domain list in the network tab | No `cpanelPassword` / `cpanel_password` field is present; only a `cpanelPasswordSet` boolean. |

## Registry management (inline create)

| # | Action | Expected |
| --- | --- | --- |
| 9 | "Add Registry" card: click **Add** with an empty name | Toast "Registry name is required"; no request. |
| 10 | Enter a name (+ optional URL) and **Add** | Toast "Registry added"; the list refreshes with the new registry; it persists after refresh. |
| 11 | Inspect the registry list response | No `credentials` field is returned; only a `credentialsSet` boolean. |
| 12 | Delete a registry | Toast "Registry deleted successfully"; row removed. |

## Hosting package management (inline create)

| # | Action | Expected |
| --- | --- | --- |
| 13 | "Add Hosting Pkg" card: click **Add** with an empty name | Toast "Package name is required"; no request. |
| 14 | Enter name (+ optional capacity / price) and **Add** | Toast "Hosting package added"; list refreshes; persists after refresh. |
| 15 | Enter a negative price and **Add** | Request fails `400` "Price must be a non-negative number". |
| 16 | Delete a package | Toast "Hosting package deleted successfully"; row removed. |

## RBAC

| # | Action | Expected |
| --- | --- | --- |
| 17 | As an IT **read-only** role, GET the page | Domains / registries / packages load (read allowed). |
| 18 | As a read-only role, attempt create/delete (via API) | `403` — write blocked. |
| 19 | As a non-IT role, hit any `/api/it/*` endpoint | Blocked by role guard. |

## Audit

| # | Action | Expected |
| --- | --- | --- |
| 20 | Create / delete a domain, registry, or hosting package | An audit-log entry is recorded with module `domain_hosting`, the actor, and the entity id (before/after as appropriate). |

## Regression
- `npx tsc --noEmit` clean.
- `npm test` (vitest) 219 passed.
- Server Names CRUD (create/edit/status/soft-delete) still works unchanged.
