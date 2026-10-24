# UI primitives (Phase 6)

Lightweight shared components for `frontend-next` — emerald/zinc DRM styling without shadcn/Radix bulk port.

| Component | Path | Notes |
|-----------|------|--------|
| Button | `button.tsx` | primary/secondary/ghost/danger, focus ring |
| Input, Textarea, Select, Label, Field | `input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`, `field.tsx` | validation + `aria-describedby` |
| Card | `card.tsx` | page panels |
| Badge, Separator | `badge.tsx`, `separator.tsx` | |
| PageHeader, ContentContainer | `page-header.tsx`, `content-container.tsx` | |
| Page states | `page-states.tsx` | skeleton loading, empty, error (+ retry), forbidden |
| Skeleton | `skeleton.tsx` | `Skeleton`, `TableSkeleton`, `ModulePageSkeleton`, `AuthSessionSkeleton` |
| DataTable | `data-table.tsx` | column defs; server data supplied by caller |
| PaginationBar | `pagination-bar.tsx` | server-side page/total from Express |
| ConfirmDialog | `confirm-dialog.tsx` | native `<dialog>` for destructive confirms |
| Form feedback | `form-feedback.tsx` | SubmitButton, FormError, FormBanner |

Design tokens: `src/styles/tokens.ts`. Global theme vars: `src/app/globals.css`.

**Deferred:** shadcn/Radix copy from legacy Vite, React Query (see `docs/PHASE6_STATUS.md`), toast library (use FormBanner / inline status until needed).

**Data fetching:** read-only pilots may use `useApiResource` (`src/lib/hooks/use-api-resource.ts`) which wraps `apiFetch`.
