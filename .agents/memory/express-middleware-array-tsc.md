---
name: Express middleware array breaks tsc handler inference
description: Passing a middleware array (not spread) to an Express route makes req/res infer as implicit any
---

Passing a **middleware array** as a single argument to an Express route handler
(e.g. `router.post("/x", guardArray, handler)`) selects a different `post`
overload and makes the handler's `(req, res)` infer as implicit `any` → new
TS7006 errors under `tsc --noEmit`.

**Fix:** spread the array — `router.post("/x", ...guardArray, handler)` — so each
middleware is passed individually and proper `Request`/`Response` inference is
restored. Passing middlewares individually (not in an array) also works.

**Why:** matters here because this repo holds a fixed tsc baseline; an array guard
silently adds ~2 errors per route and looks like a regression.

**How to apply:** when building a reusable guard as `const g = [authMiddleware, ...]`,
always spread it at the call site.
