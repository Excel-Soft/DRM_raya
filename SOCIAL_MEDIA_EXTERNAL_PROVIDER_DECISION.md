# Social Media — External Provider Decision (SOC-EXT-001)

## Decision

**No external social-media publishing provider is integrated, and none will be
added in this stage.** Publishing a post records an **internal/manual** state
only. The application never calls Meta/Facebook/Instagram, X/Twitter, LinkedIn,
YouTube, TikTok, or any other social platform API, and it never sends WhatsApp,
SMS, or email on publish.

## Why

1. **Honesty constraint.** Claiming a post was published to an external platform
   without actually sending it would be a fake success. The only truthful state we
   can guarantee is "recorded internally".
2. **No credentials, by design.** `drm.social_accounts` stores no passwords,
   tokens, API keys, or secrets. Real external publishing would require per-account
   OAuth/credentials and a secret store; that is out of scope and would violate the
   "no plaintext social credentials" constraint if done carelessly.
3. **Gap-closure scope.** This patch closes gaps in the existing internal workflow;
   it is explicitly not a rebuild and does not add new third-party plumbing.

## How it is enforced in code

- `POST /api/social-media/posts/:id/publish`:
  - Requires explicit confirmation (`confirmManual: true`).
  - Requires `APPROVED` (unless caller is FULL, who may override).
  - Sets `publishing_status = 'PUBLISHED'`, records `published_by` / `published_at`,
    and **nulls `external_ref`** (there is no external reference because nothing was
    sent externally).
  - Audits the transition with the reason
    `"Manual/Internal publish (no external provider configured)"`.
  - Returns `publishMode: "MANUAL_INTERNAL"` and
    `publishNote: "Manual/Internal Published — recorded internally; not posted to
    any external platform."`
- The Social Media page header states: *"Publishing is recorded internally
  (manual) — posts are not sent to any external platform."* There are no controls
  that imply external posting.

## If external publishing is wanted later (future work, not this stage)

A real integration would require, at minimum:
1. A provider integration per platform (prefer Replit connectors / managed OAuth
   over hand-rolled secrets).
2. A secret store for per-account tokens (never columns in `social_accounts`).
3. A real send step with provider response handling, mapping failures to the
   existing `FAILED` publishing state and storing the provider id in `external_ref`.
4. Honest status: only mark `PUBLISHED` after the provider confirms; otherwise
   `FAILED` with `failure_reason`.

Until that exists, the internal/manual model above is the truthful behavior.
