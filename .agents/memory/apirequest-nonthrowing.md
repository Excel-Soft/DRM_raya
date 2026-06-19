---
name: apiRequest is non-throwing on non-2xx
description: client apiRequest() returns the Response even on 4xx/5xx; mutations must throw themselves or onError never fires.
---

The client helper `apiRequest(method, url, body)` in `client/src/lib/queryClient.ts`
deliberately does **not** throw on non-2xx — it returns the `Response` so callers
can read `res.json()` (calling `throwIfResNotOk` there would consume the body).

**Why:** a TanStack `useMutation` whose `mutationFn` does `await apiRequest(...)`
without inspecting the response will resolve successfully on a 400/403, firing
`onSuccess` (e.g. a false "saved!" toast) while the server actually rejected it.
This silently defeats backend validation surfacing.

**How to apply:** in a mutationFn, either capture the response and call
`await throwIfResNotOk(res)` (it's a no-op when ok and throws `"${status}: ${body}"`,
which the local `readApiError` helpers parse), or use `apiRequestJson<T>()` which
throws on `!res.ok`. Don't assume `await apiRequest(...)` rejects on HTTP errors.
