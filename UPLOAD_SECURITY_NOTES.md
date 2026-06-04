# Upload Security Notes (Stage 10 — Non-Functional Quality)

This document describes the file-upload security posture of the active WebExcels
DRM application and the reusable hardened upload middleware introduced in Stage 10.

## 1. multer 1.x → 2.x upgrade

`multer` was upgraded from the 1.x line to **2.x** (`^2.1.1`).

**Why:** multer 1.x carries a published security advisory. Upgrading to 2.x clears
that advisory and keeps the dependency on a maintained release line. The upgrade
was safe because the active server did **not** actually use multer for any route
(see below) — it was only a dead import.

## 2. Current upload model: URLs/strings, not binaries

The **active** application (`server/`, `client/`, `shared/`) does **not** store
binary uploads. Everything described in the UI as an "upload" is actually a
**URL or string reference**, including:

- product posting data / documents
- service documents
- todo attachments
- meeting / project files

Files are referenced by link; no multipart binary payloads are persisted to disk
or database as blobs. This significantly limits the file-upload attack surface
(no traversal-to-disk, no executable persistence, no MIME-confusion storage).

The `import multer from "multer"` line in `server/posting-data-routes.ts` was
**dead code** (nothing in that file used it) and has been removed. No route logic
was changed.

## 3. Reusable secure-upload middleware

A hardened, reusable multer 2.x factory lives at
`server/middleware/secure-upload.ts`. It is provided for **future** binary-upload
features so that any new upload route starts from a secure baseline. It is not yet
wired into any route (the active app has no binary uploads).

### `createSecureUpload({ allowedMime, allowedExt, maxBytes, maxFiles })`

Validation rules enforced:

- **In-memory storage only** (`multer.memoryStorage()`) — no arbitrary disk
  destination paths, no path-traversal via storage destination.
- **Limits**: `fileSize` default **5MB**, `files` default **1**.
- **MIME allowlist AND extension allowlist** (both case-insensitive). A file must
  satisfy *both* to be accepted.
- **Hard denylist** that always rejects, regardless of allowlist:
  - Extensions: `.exe .sh .bat .cmd .com .msi .js .mjs .php .py .rb .pl .jar
    .html .htm .svg`
  - Dangerous MIME types (executables, scripts, java archives, html, svg, etc.).
- **Rejects path separators / traversal** (`/`, `\`, `..`, NUL) in
  `originalname`.

### `safeFilename(name)`

Helper that sanitizes a filename for safe storage:

- strips all directory components (basename only)
- allows only `[A-Za-z0-9._-]`
- collapses repeated separators
- strips leading dots/dashes (avoids hidden/option-like names)
- caps length (preserving the extension where possible)

### `csvUpload` preset

A ready-to-use preset for future CSV import features: `text/csv` + `.csv`, 5MB,
1 file.

### `handleUploadError(err, req, res, next)`

Express error handler that converts multer errors into the standard error
envelope:

```json
{ "success": false, "error": { "code": "UPLOAD_REJECTED" | "FILE_TOO_LARGE", "message": "..." }, "message": "..." }
```

It mirrors `errorEnvelope` from `server/utils/api-error.ts` (the shape is inlined
in the middleware to keep it self-contained) and preserves a top-level `message`
field for frontend backward-compatibility. Mount it **after** any route using
`createSecureUpload(...)`.

## 4. Legacy `src/` CSV import is NOT mounted

A legacy CSV import exists under `src/modules/customers`, but the `src/` tree is
**legacy and not mounted** by the active server (dev runs
`tsx watch server/index.ts`). It does not run in production and is not part of the
live attack surface. Do not rely on it; do not edit it for runtime behavior.

## 5. Virus-scan limitation

**There is no virus/malware scanner in this application.** The secure-upload
middleware validates type/size/name but does **not** inspect file *contents* for
malware. This is acceptable today because the active app stores no binaries. If
binary storage is ever introduced, integrate a scanner (e.g. **ClamAV** or a
3rd-party scanning API) before persisting or serving any uploaded file.

## 6. Checklist for wiring secure-upload (when real binary uploads are added)

- [ ] Choose precise `allowedMime` + `allowedExt` for the specific feature.
- [ ] Set conservative `maxBytes` / `maxFiles` for the use case.
- [ ] Apply `createSecureUpload(...)` middleware to the upload route.
- [ ] Mount `handleUploadError` after the route to return the standard envelope.
- [ ] Use `safeFilename(file.originalname)` before any storage / persistence.
- [ ] Store outside the web root; never serve uploads from an executable path.
- [ ] Serve downloads with `Content-Disposition: attachment` and a correct,
      non-sniffable `Content-Type` (`X-Content-Type-Options: nosniff`).
- [ ] Integrate a **virus/malware scanner** (ClamAV / 3rd-party) before
      persisting or serving.
- [ ] Authenticate + RBAC-gate the upload route as appropriate.
- [ ] Add tests covering: oversize rejection, bad MIME/extension rejection,
      dangerous-extension rejection, traversal-in-filename rejection.
