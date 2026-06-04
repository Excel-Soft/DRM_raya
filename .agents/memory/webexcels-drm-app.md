---
name: WebExcels DRM app layout
description: Which code tree is the live app vs legacy scaffold, and the boot path.
---

The live app is `server/` + `client/` + `shared/`.

- Dev/boot: `npm run dev` → `tsx watch server/index.ts` → routes via `server/routes.ts`. Port 5000.
- The `src/` tree (and `api:dev` / `auth:dev` scripts) is a **legacy scaffold that is NOT mounted** at runtime. Do not edit `src/` to change runtime behavior; it will have no effect.

**Why:** the import shipped two overlapping trees; only the `server/`/`client/`/`shared/` one is wired into the running server.

**How to apply:** when fixing behavior, edit `server/`/`client/`/`shared/`. Treat anything under `src/` as dead unless you verify it is actually imported by the active server.

Uploads: the active app has **no binary/multer uploads** — product docs, service docs, todo attachments, meeting files are stored as URL/string fields. `multer` was a dead import only (since removed). A reusable hardened upload middleware exists at `server/middleware/secure-upload.ts` for future binary uploads but is not wired into any route today.
