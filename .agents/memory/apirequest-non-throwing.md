---
name: apiRequest is non-throwing on non-2xx
description: Why useQuery error states silently fail unless you use apiRequestJson.
---

# `apiRequest()` does not throw on non-2xx

`client/src/lib/queryClient.ts` exposes two helpers:
- `apiRequest(method, url, data?)` — returns the raw `Response`. It **deliberately
  does NOT call `throwIfResNotOk`** (the comment notes that consuming the body via
  `res.text()` would break a later `res.json()`).
- `apiRequestJson<T>(method, url, data?)` — calls `apiRequest`, throws via
  `throwIfResNotOk` on `!res.ok`, then returns parsed JSON.

**Why it matters:** a `useQuery` whose `queryFn` does `const res = await apiRequest(...); return res.json()`
will resolve successfully even on a 4xx/5xx (parsing the error body), so `isError`
never fires and the UI shows empty data instead of an error state.

**How to apply:** in TanStack Query `queryFn`s that need an error state, use
`apiRequestJson<T>(...)` (or `if (!res.ok) throw`). Reserve raw `apiRequest` for
callers that must read the error body themselves (e.g. mutations surfacing server
validation messages).
