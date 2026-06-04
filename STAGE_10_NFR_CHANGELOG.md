# Stage 10 — Non-Functional Quality Changelog

Scope: production-quality hardening with **no** changes to business workflows,
screen designs, route paths, status codes, or success-response shapes. Stages 1–9
left intact. Active app = `server/` + `client/` + `shared/` (the `src/` tree is
legacy and not mounted).

---

## A. Upload security
- **multer upgraded `^1.4.5-lts.2` → `^2.0.x`** (`@types/multer` → `^2.0.x`),
  clearing the multer 1.x advisory from the dependency tree.
- Removed the **dead `import multer from "multer"`** in
  `server/posting-data-routes.ts` (it was imported but never used; no route logic
  changed).
- New reusable hardened middleware **`server/middleware/secure-upload.ts`**:
  - `createSecureUpload({ allowedMime, allowedExt, maxBytes, maxFiles })` —
    `multer.memoryStorage()` (no arbitrary disk paths), size + file-count limits
    (default 5 MB / 1 file).
  - `fileFilter` enforces **both** a MIME allowlist and an extension allowlist
    (case-insensitive), a hard denylist of executable/script types
    (`.exe .sh .bat .cmd .com .msi .js .mjs .php .py .rb .pl .jar .html .htm .svg`
    + dangerous MIME), and rejects path separators / traversal in `originalname`.
  - `safeFilename()` strips directory components, allows only `[A-Za-z0-9._-]`,
    caps length.
  - `csvUpload` preset and `handleUploadError` (returns the standard error
    envelope) for when binary uploads are introduced.
- **Reality note:** the active app currently has **no binary uploads** — product
  docs, service docs, todo attachments and meeting files are stored as
  URL/strings. The middleware is provided for safe future wiring.
- **Virus-scan limitation** documented in `UPLOAD_SECURITY_NOTES.md` (no scanner
  present; recommend ClamAV / 3rd-party if binary storage is added).

## B. Standard API error envelope
- New **`server/utils/api-error.ts`**:
  - `ApiError` class + factories (`badRequest/unauthorized/forbidden/notFound/
    conflict/internal`).
  - `errorEnvelope(code, message, details?)` → `{ success:false,
    error:{ code, message, details? }, message }` — a top-level `message` is
    mirrored so existing frontend toasts keep working.
  - `sendError(res, err)` maps `ApiError`→status/code, `ZodError`→400
    `VALIDATION_ERROR` (safe path+message issue list only), anything else→500
    `INTERNAL_ERROR`. **No stack traces, SQL, or secrets are ever returned.**
- **Global error handler** (`server/index.ts`) now emits the envelope. **No stack
  trace or raw internal text is ever sent to clients** — 5xx responses return a
  fixed generic `"Internal server error"` message; 4xx client-error messages
  (which are intentional) are surfaced. Full detail incl. stack is logged
  server-side via `console.error`.
- Envelope adopted in error paths of: `auth.routes.ts`, `todo-routes.ts`,
  `users-routes.ts`, `reports-routes.ts`. Success responses untouched.

## C. Shared validation schemas
- New **`shared/validators.ts`** (zod-only, no server imports): `dateRange`,
  `pagination` (page≥1/25, max 200), `id`, `uuid`, `email`, `phone`, `amount`,
  `url` (http/https only), `approvalDecision`, `fileMetadata`, plus a
  `parseOrThrow` helper (throws `ZodError`, mapped to 400 by the error layer).
- `shared/validators.ts` is provided as a reusable module ready for adoption. It
  was **not** retrofitted into existing `reports-routes.ts` pagination parsing,
  because those endpoints use `pageSize` default 20 while the shared `pagination`
  schema defaults to 25 — adopting it there would silently change response page
  sizes. Kept existing behavior untouched; new/refactored endpoints should use the
  shared schemas.

## D. API contract inventory
- New **`API_CONTRACT_INVENTORY.md`** — table of active backend routes across all
  active modules (auth, users/RBAC, sales/customers/leads, GM/BV, accounts,
  attendance/HR, PMS, product-posting/software, service, DRM/DD, reports, support,
  training, events): Route | Method | Auth | Roles | Frontend caller(s) | Request
  | Response | Status. Derived by grepping the real route files.

## E. Smoke tests
- New **`server/stage10-smoke.test.ts`** (vitest + supertest, builds the app via
  `registerRoutes`): unauthenticated GETs to representative endpoints across
  modules return 401; bad-credential login returns 401 (not 500) with a sanitized
  body; unknown routes handled with no stack leak. **12 tests pass.**
- No Playwright/Cypress added (heavier than warranted); the lighter installed
  vitest+supertest stack was used, plus a documented manual checklist in
  `TESTING_GUIDE.md`.

## F. Type-check
- `npm run check` (tsc) run. **None of the Stage 10 new/changed files produce
  errors.** Remaining 58 errors are the **pre-existing baseline** in
  `server/reports-routes.ts` (drizzle enum/`createdBy` typings, lines 450+, all
  outside Stage 10 hunks) and `server/repositories/*.ts`. Not refactored (out of
  scope; would touch business logic).

## G. Build performance / code splitting
- `client/src/App.tsx`: heavy pages converted to `React.lazy` with a single
  `<Suspense fallback={<PageLoader/>}>` boundary around the router. Lazy-loaded:
  all dashboards (~25), reports (~29), service (~18), PMS (~9), product-posting,
  and events pages. **Auth page, shell, NotFound kept eager.** Route paths,
  guards, redirects, and visuals unchanged.
- Build now emits separate per-page chunks (verified in build output); auth shell
  renders correctly through the Suspense boundary.

## H. Export standardization
- New **`client/src/lib/export-utils.ts`**: `exportToCSV` (dependency-free, BOM +
  escaping), `exportToExcel` (xlsx), `exportToPDF` (jspdf + jspdf-autotable).
  Filenames include report name + `YYYYMMDD-HHmm`; exports only caller-provided
  (filtered) rows; column typing modeled on existing `performance-export.ts`.
  Existing page exports left working (no forced refactor).

## I. Documentation
- New: `STAGE_10_NFR_CHANGELOG.md` (this file), `API_CONTRACT_INVENTORY.md`,
  `TESTING_GUIDE.md`, `UPLOAD_SECURITY_NOTES.md`, `PRODUCTION_CHECKLIST.md`.

## J. Verification
- `npm run check`: no new errors (baseline only).
- `npm run build`: passes; per-page lazy chunks emitted.
- `npm run dev` (workflow): clean boot on port 5000.
- `npm test`: 14 tests pass (12 new smoke + 2 existing).
- Manual: login error returns sanitized envelope; protected endpoints 401; auth
  page renders through Suspense.

---

## Files changed
**New:** `server/utils/api-error.ts`, `shared/validators.ts`,
`server/middleware/secure-upload.ts`, `client/src/lib/export-utils.ts`,
`server/stage10-smoke.test.ts`, `API_CONTRACT_INVENTORY.md`, `TESTING_GUIDE.md`,
`UPLOAD_SECURITY_NOTES.md`, `PRODUCTION_CHECKLIST.md`,
`STAGE_10_NFR_CHANGELOG.md`.
**Edited:** `server/index.ts`, `server/auth.routes.ts`, `server/todo-routes.ts`,
`server/users-routes.ts`, `server/reports-routes.ts`,
`server/posting-data-routes.ts`, `client/src/App.tsx`, `package.json`,
`package-lock.json`.

## Dependencies changed
- `multer` `^1.4.5-lts.2` → `^2.0.x`; `@types/multer` → `^2.0.x`. No other deps
  added (xlsx/jspdf/jspdf-autotable/zod/vitest/supertest already present).

## Unresolved / known limitations
- Error envelope adopted "first" in auth/todo/users/reports + the global handler;
  other route files still return their legacy `{ error }` shape (gradual
  migration; backward-compatible).
- The auth **middleware** 401 (`{"error":"No token provided"}`) is unchanged — it
  is a separate gate from the adopted route handlers.
- Pre-existing tsc baseline (58 errors) in `reports-routes.ts` + `repositories/*`
  left as-is (business-logic typings; out of scope).
- No binary upload routes are wired yet, so `secure-upload.ts` is unused in
  runtime today (intentional, for future use).
- No virus scanner integrated (documented).
- Main `index` JS chunk is still large (many non-heavy pages remain eager by
  design); heavy pages are split.
