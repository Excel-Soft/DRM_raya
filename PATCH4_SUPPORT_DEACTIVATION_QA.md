# Patch 4 — Support Module Deactivation QA (ISS-02, P2)

Stage 7 QA for the Support module deactivation. Verification + documentation only.
Reason (from issue matrix): "Support Module not required at this time." Code and
DB tables are **retained** for a future phase; only access is gated off.

## Mechanism (reversible feature flag)
- **Server flag:** `isSupportModuleEnabled()` → `process.env.SUPPORT_MODULE_ENABLED === "true"`
  (`server/feature-flags.ts`). OFF unless explicitly `"true"`.
- **Client flag:** `isSupportModuleEnabled()` → `import.meta.env.VITE_SUPPORT_MODULE_ENABLED === "true"`
  (`client/src/lib/feature-flags.ts`). OFF unless explicitly `"true"`.
- Both flags are absent/OFF in this environment → module deactivated.

## Verification legend
✅ Code-verified · 🟡 Manual run pending · n/a.

## Matrix

| Test | Status | Evidence |
|---|---|---|
| API surface blocked | ✅ | Unauthenticated smoke: `GET /api/support/tickets` → **404** (not 401) — a deactivation gate mounted in `server/routes.ts` before the Support routes returns 404 for the entire `/api/support/*` surface while the flag is OFF. |
| Direct URL blocked (frontend) | ✅ | `client/src/App.tsx` routes `/support/tickets`, `/support/tickets/:id`, `/support/complaints` render `SupportInactive` when `isSupportModuleEnabled()` is false (component swap, not just a hidden link). |
| Sidebar entry hidden | ✅ | `client/src/components/app-sidebar.tsx`: `if (item.permKey === "Support" && !isSupportModuleEnabled()) return false;` hides the whole Support section. |
| Dashboard shortcuts hidden | ✅ | Support shortcuts gated by `isSupportModuleEnabled()` in `reception-dashboard.tsx`, `dd-executive-dashboard.tsx`, `qa-manager-widget.tsx`, `verification-manager-widget.tsx`. |
| Inactive page shown in place | ✅ | `client/src/pages/support-inactive.tsx` informs the user the module is off (no broken/blank page, no fake data). |
| Code + DB retained | ✅ | Support routes/pages and `drm.support_*` tables are not deleted — only gated. Re-enable is config-only. |
| No unrelated module affected | ✅ | Flag only branches Support entry points; `npm run build` + `npm test` (154) pass, confirming no regression elsewhere. Service-complaint surface (`/service/complaints`) is separate — confirm scope if it must also be hidden (🟡). |

## Re-enable instructions (future phase)
1. Set server env `SUPPORT_MODULE_ENABLED=true` (Replit-managed secrets).
2. Set client env `VITE_SUPPORT_MODULE_ENABLED=true`.
3. Restart the app (rebuild so Vite re-inlines the client flag).
4. Verify the Support sidebar entry, routes, and `/api/support/*` return live.

## Result
**PASS (code-verified).** Deactivation is enforced at both the API (404) and UI
(component swap + hidden nav) layers, is fully reversible via config, and changes
no business logic or data. Per-role interactive walkthrough is 🟡 pending login.
