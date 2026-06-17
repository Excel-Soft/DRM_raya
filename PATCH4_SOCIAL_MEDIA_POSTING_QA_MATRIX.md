# Patch 4 — Social Media Posting QA Matrix (ISS-03)

Stage 7 QA for Social Media Posting + Social Accounts. Verification +
documentation only.

- **Frontend:** `client/src/pages/social-media.tsx` (`/social-media`),
  `client/src/pages/drm/all-social-accounts.tsx` (`/drm/all-social-accounts`).
- **Backend:** `server/social-media-routes.ts` (posts),
  `server/social-accounts-routes.ts` (accounts).
- **Two-status model (not a single state machine):**
  - `approval_status`: `DRAFT → PENDING → APPROVED | REJECTED` (REJECTED can go
    back to PENDING via resubmit).
  - `publishing_status`: `DRAFT → READY → SCHEDULED → PUBLISHED` (+ `FAILED`,
    `CANCELLED`). Approving a post sets `publishing_status = READY`.

## Verification legend
✅ Code-verified · 🟡 Manual run pending · ❌ Gap · n/a.

## Automated evidence
- `npm run check` 0 errors · `npm run build` success · `npm test` 154 passed.
- Unauthenticated smoke: `GET /api/social-media/posts` → **401**,
  `GET /api/drm/social-accounts` → **401** (access blocked).

## Matrix

| Test | Status | Evidence |
|---|---|---|
| Create draft | ✅ | `POST /api/social-media/posts` creates a DRAFT. |
| Validate required platform/account/content | ✅ | `platform`, `socialAccountId`, `content` required → 400; `content` ≤ 5000, `title` ≤ 300. |
| Schedule future post | ✅ | `POST /posts/:id/schedule` (APPROVED → SCHEDULED); `scheduledAt` parsed + stored. |
| Reject past schedule date | ✅ | On create and on schedule: `scheduledAt` must be a valid date and `> now` (`getTime() <= Date.now()` → 400 "cannot be in the past"). |
| Submit for approval | ✅ | `POST /posts/:id/submit-approval` (DRAFT/REJECTED → PENDING); only the owner/manager (`canManageRow`) may submit; notifies HOD/Admins via `NotificationService.notifyRole`. |
| Approve / Reject | ✅ | `approve` (PENDING → APPROVED) and `reject` (PENDING → REJECTED, **reason required**); only approvers (`isApprover`), cannot approve own post, dept-scoped; creator notified. |
| Publish / manual publish | ✅ | `POST /posts/:id/publish` (APPROVED → PUBLISHED); role-gated (`canSchedule`/owner); creator notified. |
| Failure handling | ✅ (code) / 🟡 (UI) | Server returns explicit 400/403/409 with messages (no fake success). `social-media.tsx` has loading/error/empty states. Per-state UI run pending login. |
| List refresh | ✅ | `GET /api/social-media/posts` with view scoping (`getAllowedUserIds`); client refetches after mutations (TanStack Query). |
| Filters / export | ✅ | List supports filters; CSV export path present (audited as `social_post.export`). |
| Permissions | ✅ | Per-handler `forbidden()`/403 + scoping: `getAllowedUserIds` (view), `getManagedUserIds` / `canManageRow` (edit/submit/schedule), `isApprover` (approve/reject). Full access: `admin`, `super_hod`; managers: posting/dd/marketing/seo-smm; approvers: HOD/admin. Unauthenticated → 401 (smoke). |
| Audit / notification | ✅ | `AuditLogService.record` for create/update/delete/export; `auditTransition` for submit/approve/reject/schedule/publish/cancel. `NotificationService.notify` on approve/reject/schedule/publish/cancel; `notifyRole` on submit. |

## Social Accounts (`server/social-accounts-routes.ts`)
| Test | Status | Evidence |
|---|---|---|
| Create / Edit / Verify / Delete | ✅ | `POST`, `PATCH /:id`, `PATCH /:id/verify`, `DELETE /:id`. |
| Permission scoping | ✅ | Full roles view-all/create/edit/verify/delete; managerial roles scoped; cross-scope mutation → **403**. |
| Audit | ✅ | Best-effort `ActivityLogService.log` for `drm.social_account.create/update/verify/delete` (never throws). |

## Notes / findings
- **Publish behavior:** "publish" performs a **status transition to PUBLISHED**
  (manual publish) + notification. There is **no automated external
  posting/integration** to live social platforms in this stage — document this as
  expected behavior and a business confirmation item.
- **Result:** **PASS (code-verified).** Validation, state machine, role scoping,
  audit, and notifications are all present and fail-closed. Per-role interactive
  runs 🟡 pending login.
