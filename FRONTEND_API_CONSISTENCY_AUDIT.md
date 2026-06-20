# Frontend API Consistency Audit — Patch 6 Stage 2

This is a **foundation** stage: it introduces a shared, authenticated file-download
helper and converts the export/template-download surface to use it. It does **not**
rewrite every `fetch("/api/...")` call site in the client. This document records
what changed, why, and what was deliberately left as-is.

## What the app already has

- `client/src/lib/queryClient.ts`
  - `apiRequest(method, url, data?)` — attaches auth headers + `credentials`,
    and on `401` performs the standard session-expiry redirect.
  - `apiRequestJson(...)` — `apiRequest` + JSON parse + error-envelope handling.
  - `extractApiError(body, status)` — understands both the new `{ error: { code,
    message } }` envelope and legacy `{ message }` / `{ error }` shapes.
  - `getAuthHeader()` — returns the `Authorization` header object for raw `fetch`.

The gap was **binary/file downloads**: every export hand-rolled
`fetch(url, { headers: getAuthHeader() })` → `res.blob()` → temporary anchor, and
each one handled (or silently swallowed) auth failures differently. A `401`
there did **not** trigger the app-wide session redirect.

## New helper

- `client/src/lib/download.ts`
  - `downloadAuthedFile(url, filename, method?, data?)` — routes the request
    through `apiRequest` (so `401` → same redirect as everything else), then on
    success reads the body as a Blob and triggers the download via a temporary
    object-URL anchor (identical success path to the code it replaces).
  - `DownloadError` — thrown on non-2xx with the HTTP `status`, so callers can
    show an authorization-specific message on `403`.

## Converted call sites (export / template downloads)

| File | Function | Before | After |
| --- | --- | --- | --- |
| `client/src/pages/salary-report.tsx` | `handleExport` | `fetch(..., getAuthHeader())` + manual blob/anchor | `downloadAuthedFile(...)`; keeps the 403 "not authorized to export salary" message |
| `client/src/pages/reports-raw-attendance.tsx` | `exportCsv` | same manual pattern | `downloadAuthedFile(...)` |
| `client/src/pages/user-reports.tsx` | report `handleExport` | same manual pattern | `downloadAuthedFile(...)` |
| `client/src/components/lead-import-dialog.tsx` | `downloadTemplate` | `fetch("/api/leads/template", getAuthHeader())` | `downloadAuthedFile(...)` |

Behavior preserved: same URLs, same filenames, same toasts. The only functional
improvement is consistent `401` (session-expiry redirect) and `403` handling.

`getAuthHeader` imports were removed from `salary-report.tsx` and
`reports-raw-attendance.tsx` where they became unused; left intact in
`user-reports.tsx` and `lead-import-dialog.tsx` (still used by other calls).

## Deliberately NOT converted (rationale)

This stage intentionally avoids touching unrelated request flows to keep the
blast radius small and behavior-preserving:

- **`useQuery` GET fetchers** (e.g. `office-expenses.tsx`, `ledger-report.tsx`,
  `cheque-system.tsx`, `refund-report.tsx`, `dd-executive-dashboard.tsx`, …).
  These already work through TanStack Query; consolidating them onto
  `apiRequestJson`/`getQueryFn` is a separate, larger refactor with its own
  caching/error-shape considerations.
- **Auth flows** (`auth.tsx`, `App.tsx` `/api/auth/me`). These run before a
  session exists; the `401` redirect logic must not apply, so they stay on raw
  `fetch`.
- **JSON mutation `fetch` calls** (e.g. `tracing.tsx`, `gm-pool-add-gm.tsx`,
  `lead-import-dialog.tsx` preview/commit). These return JSON, not files, and
  belong to module-specific flows out of scope for this shared-foundation stage;
  they can migrate to `apiRequest`/`apiRequestJson` incrementally.
- **Backup/scratch files** (e.g. `*.backup`). Left untouched per project policy.

## Follow-up (not in this stage)

- Migrate JSON mutation `fetch("/api/...")` calls to `apiRequest`/`apiRequestJson`
  module by module so they share envelope parsing + the `401` redirect.
- Migrate remaining `useQuery` raw fetchers to a shared `getQueryFn`.
