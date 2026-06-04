---
name: Honest API / error patterns
description: Conventions for wiring DRM frontend pages to real data
---

When making DRM pages production-ready:

- Use `apiRequestJson(method, url, data?)` from `@/lib/queryClient` — it throws
  on non-2xx so TanStack Query `isError`/`onError` fire and backend messages
  (e.g. 400 invalid URL, 409 duplicate) can be shown via `useToast`.
- Remove mock/fallback arrays entirely; never render fabricated rows or
  placeholder business values (phone numbers, localhost URLs, sample names).
  Show real fields, `N/A`/`-` for genuinely-absent columns, and proper
  loading / empty / error states.
- After mutations, invalidate the relevant query keys so the UI refreshes.

**Why:** Stage 4 required honest, real-data screens with no silent fallbacks;
fabricated values had been presented to users as real data.

**How to apply:** any new or converted PMS/workflow screen should follow this;
prefer matching the existing layout (no redesign) and only swap data sources.
