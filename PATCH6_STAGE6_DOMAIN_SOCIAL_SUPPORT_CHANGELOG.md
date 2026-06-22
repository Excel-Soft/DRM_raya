# Patch 6 Stage 6 — Domain Hosting / Social Media / Support — Changelog

Scope of this stage (build):

- **(A/B) Domain Hosting / Server Names** — made the IT Domain Hosting page
  functional and hardened the supporting APIs (RBAC, audit, credential safety).
- **(C) Social Media Posting** — verified the already-merged implementation; no
  rewrite (see `SOCIAL_MEDIA_POSTING_WORKFLOW.md`).
- **(D) Support deactivation** — verified the already-merged deactivation; no
  rewrite (see `SUPPORT_MODULE_DEACTIVATION_NOTES.md`).
- **(E) Docs** — this changelog plus the QA / workflow docs referenced below.

The work obeys the stage constraints: no duplicate engines (existing repos /
routes reused), no visible controls that do nothing, no plaintext social/server
credentials stored or returned, no destructive DB changes (additive only).

---

## (A/B) Domain Hosting / Server Names

### Problem fixed
The Domain Hosting page rendered a static "Submit" form whose inputs were not
bound to any state and whose button did nothing (a dead control). The
registries / hosting-packages management cards could delete rows but had **no
way to create** them. The domain/registry/hosting-package APIs had no role
checks and no audit logging, and the create payloads could carry plaintext
credentials.

### Files changed
- `client/src/pages/it-servers.tsx`
  - Replaced the no-op domain form with a controlled form bound to React state
    and a real create mutation (`POST /api/it/domains`).
  - Removed dead / non-persisted controls: **SSL** checkbox, **First Date**,
    **Active Duration**, and the **cPanel Password** input (a plaintext secret
    field we refuse to capture).
  - Fields now map 1:1 to real `it_domains` columns: Company (optional, FK-safe
    customer picker), Domain Name (required), Registry, Hosting Server, Hosting
    Package, Activation Date, Expiry Date, cPanel Username.
  - Added client-side validation (required domain name, hostname format,
    expiry-after-activation) with an inline error message and a pending state.
  - Added inline **Add** forms to the "Add Registry" and "Add Hosting Pkg" cards
    so those headers are no longer dead labels.
  - Removed the now-unused `Checkbox` import.
- `server/it-assets-routes.ts`
  - Added `serializeDomain` (strips `cpanel_password`, exposes a
    `cpanelPasswordSet` boolean) and `serializeRegistry` (strips `credentials`,
    exposes a `credentialsSet` boolean). All domain/registry responses go through
    these serializers so secrets are never returned to any client.
  - Added RBAC to domains / registries / hosting-packages: `IT_READ_ROLES` on
    GET, `IT_WRITE_ROLES` on POST/DELETE (mirrors the existing server-name
    routes).
  - Added audit logging via `AuditLogService` (module `domain_hosting`) on every
    create and delete.
  - Added `POST /api/it/registries` and `POST /api/it/hosting-packages` (the
    create endpoints the UI now needs).
  - Hardened `POST /api/it/domains`: strips `cpanelPassword` from the payload,
    requires + format-validates the domain name, rejects duplicates with `409`
    (pre-check plus a catch on Postgres unique-violation `23505`), then audits.
- `server/repositories/it-assets.repository.ts`
  - Added `findDomainByName`, `getRegistry`, `getHostingPackage`,
    `createRegistry`, `createHostingPackage`.

### APIs added / modified
| Method | Path | Change |
| --- | --- | --- |
| GET | `/api/it/domains` | now `IT_READ_ROLES`; responses serialized (no secret) |
| POST | `/api/it/domains` | `IT_WRITE_ROLES`; strips secret, validates, dup→409, audited |
| GET | `/api/it/registries` | now `IT_READ_ROLES`; responses serialized (no secret) |
| POST | `/api/it/registries` | **new** — `IT_WRITE_ROLES`, audited |
| DELETE | `/api/it/registries/:id` | now `IT_WRITE_ROLES`, 404 guard, audited |
| GET | `/api/it/hosting-packages` | now `IT_READ_ROLES` |
| POST | `/api/it/hosting-packages` | **new** — `IT_WRITE_ROLES`, audited |
| DELETE | `/api/it/hosting-packages/:id` | now `IT_WRITE_ROLES`, 404 guard, audited |

### DB changes
**None.** No schema changes were made in this stage. The existing `it_domains`,
`it_registries`, and `it_hosting_packages` tables (created at runtime by
`ensureItSchema`) are used as-is. The plaintext `it_domains.cpanel_password` and
`it_registries.credentials` columns are left in place but are **never written by
the new create paths and never returned** by the API; instead the API exposes
only boolean "…Set" flags. (Dropping those columns would be a destructive change
and `db:push` is broken, so it is intentionally out of scope.)

### Server Names behavior
Unchanged in this stage — the server-name CRUD (create/edit/status/soft-delete
with RBAC + audit) already existed and is the pattern the domain/registry/package
routes were aligned to.

---

## (C) Social Media Posting — verified, not rewritten
See `SOCIAL_MEDIA_POSTING_WORKFLOW.md`. The accounts + posts CRUD and the
approval / publishing state machines are fully implemented and merged in
`server/social-accounts-routes.ts` and `server/social-media-routes.ts`, with
audit logging and runtime `CREATE TABLE IF NOT EXISTS` schema. No credential
columns exist on social accounts, so the no-plaintext-secret constraint holds.

## (D) Support deactivation — verified, not rewritten
See `SUPPORT_MODULE_DEACTIVATION_NOTES.md`. The `/api/support/*` surface returns
`404` before auth when `SUPPORT_MODULE_ENABLED` is not `"true"`, the client hides
the routes / sidebar entries behind `VITE_SUPPORT_MODULE_ENABLED`, and no
disabled support route is exposed.

---

## Tests
- `npx tsc --noEmit` — clean (0 errors).
- `npm test` (vitest) — 219 passed across 14 files.
- No IT-asset-specific test suite exists in the repo; the change was verified via
  the type checker, the full suite (regression), and the manual QA matrix in
  `DOMAIN_HOSTING_SERVER_NAMES_QA.md`.
