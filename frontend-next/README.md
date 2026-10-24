# DRM WebExcels — `frontend-next` (Phase 1 foundation)

Next.js **16** App Router frontend. Legacy Vite app remains in `../frontend/` until cutover.

## Requirements

- **Node.js:** 20.9+ (Next.js 16). Node **24+** or **20.19+ / 22.13+** recommended for ESLint engine compatibility.
- **Package manager:** **npm** (`package-lock.json` in this folder). Legacy Vite app may still use Yarn separately.

## Scripts

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run test         # route-access policy unit tests
npm run build        # uses webpack (required for ../frontend/shared alias today)
npm start            # standalone server (after build; see .next/standalone/server.js)
```

## Environment

Copy `.env.example` → `.env.local`:

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Express origin for Next **rewrites** (default `http://localhost:5001`) |

Public vars must use `NEXT_PUBLIC_*` only (see `src/config/env.ts`).

## Local development

1. Start Express backend (from `backend/`): default port is **`PORT` env or 5000**; legacy Vite proxy targets **5001** — set `PORT=5001` or align `BACKEND_URL` with your backend.
2. Start Next: `npm run dev` (port **3000**).
3. Browser calls same-origin `/api/...`; Next rewrites to `BACKEND_URL`.
4. Optional: legacy Vite on **5173** (`frontend/yarn dev`) unchanged.

## Routing (Phase 1)

| Path | Purpose |
|------|---------|
| `/` | Foundation home (app shell placeholder) |
| `/auth` | Auth placeholder (Phase 2) |
| `/api-health` | Manual Express health check (does not auto-pass) |

## API client

- Browser: `src/lib/api/browser-client.ts` — `credentials: "include"`, `/api/*` via rewrites.
- Server: `src/lib/api/server-client.ts` — absolute `BACKEND_URL`; optional cookie forward (documented, Phase 2+).
- **Auth authority:** Express only. No Next.js business API routes.

## Aliases

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@shared/*` | `../frontend/shared/*` (TypeScript; webpack alias in `next.config.ts`) |

See `src/config/shared-import-audit.ts` before importing shared code in Client Components.

**Build note:** `npm run build` runs `next build --webpack` because Turbopack cannot bundle sibling `../frontend/shared` yet. `npm run typecheck` validates `@shared` via `src/config/shared-path.typecheck.ts`.

## Folder conventions

- `src/app/` — thin routes only
- `src/modules/<domain>/` — business screens (Phase 2+)
- `src/components/ui/` — shadcn (Phase 3 port)
- `src/components/layout/` — shell
- `src/lib/api/`, `src/lib/auth/` — Habib foundation ownership
- `src/config/routes/` — migration tracker (matrix pending Phase 0)

## Rendering

- Default: **Server Components** for layouts and static structure.
- Interactive screens: **Client Components** + React Query (Phase 2+).
- No `proxy.ts` in Phase 1 — Express validates sessions.

## Production (future)

- `output: "standalone"` in `next.config.ts`
- Nginx → Next Node server; `/api` → Express (unchanged)
- Legacy `frontend/deploy.sh` unchanged until Phase 11

## Ownership (foundation)

- **Habib:** `lib/api`, `lib/auth`, `config/routes`, `providers`, shell, build config
- **Talha:** module prep only until foundation sign-off (see `docs/FOUNDATION_STATUS.md`)

Branch: `fix/upgrade_frontend_habib`
