---
name: Raw fetch hides errors in TanStack queries
description: Why list/read queries in client/ must use apiRequestJson, not raw fetch().then(r=>r.json())
---

In `client/`, a `useQuery` whose `queryFn` is
`fetch(url).then(r => r.json())` will parse a 4xx/5xx **error body as data**.
TanStack Query then treats it as success: `isError` stays false and the page
collapses to an empty list instead of an error state. This silently hides
backend failures and violates the "no raw backend errors / honest error states"
rule.

**Rule:** read/list queries use `apiRequestJson(method, url)` from
`client/src/lib/queryClient.ts` (it checks `res.ok` and throws a sanitized
error, so `isError` works); mutations use `mutationRequest` (throws) — not
`apiRequest` directly, which is the no-throw `Response` variant. Always render an
explicit `isError` branch alongside loading/empty.

**Why:** a Stage-7 architect review caught Office Expenses still using raw
`fetch` for its list + cheques queries, so any non-2xx produced an empty table
with no error shown.

**How to apply:** when wiring or auditing any retained page's data fetch, grep
for `fetch(` in `client/src/pages` — convert to `apiRequestJson` and add an
error row/toast.
