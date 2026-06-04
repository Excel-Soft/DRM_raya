---
name: API error envelope convention
description: Standard error response shape, the no-leak rule, and frontend backward-compat.
---

API error responses use: `{ success:false, error:{ code, message, details? }, message }`.
The top-level `message` is mirrored from `error.message` for frontend backward-compat.

Helpers live in `server/utils/api-error.ts` (`ApiError`, factories, `errorEnvelope`, `sendError`). `sendError` maps `ApiError`→its status/code, `ZodError`→400 `VALIDATION_ERROR` (path+message only), anything else→500 `INTERNAL_ERROR`.

**No-leak rule:** never send stack traces or raw internal error text to clients. The global handler in `server/index.ts` returns a fixed generic `"Internal server error"` for status>=500; only 4xx (intentional, client-safe) messages are surfaced. Full detail incl. stack is logged server-side only.

**Why:** returning raw `err.message`/stack to clients is an information-disclosure path, especially if a debug flag is mis-set in production.

**Frontend backward-compat:** older callers read `json.error` as a string. Any FE error parser must read `json.error?.message || json.message || (typeof json.error === "string" ? json.error : "")` so both the envelope and the legacy `{error:"string"}` shape produce readable messages. Migration to the envelope is incremental — not all route files use it yet, and the auth *middleware* 401 still returns the legacy `{error:"No token provided"}`.

Shared zod validators live in `shared/validators.ts` (dependency-free, no server imports). Note: `pagination` defaults `pageSize` to 25, but existing `reports-routes.ts` endpoints default to 20 — do NOT retrofit the shared schema there or you silently change page sizes. Use it for new/refactored endpoints.
