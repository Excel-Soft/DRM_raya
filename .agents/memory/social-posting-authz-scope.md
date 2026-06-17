---
name: Social posting dual authz scope
description: Why social-media posts use two separate authorization scopes (view vs management) and how HOD/posting-manager roles differ.
---

# Social posting authorization: view-scope is not management-scope

For `drm.social_media_posts`, authorization is split into **two distinct department
scopes**, not one:

- **VIEW scope** — who can *see* a row (list / get-by-id / approve / reject). FULL =
  all, HOD/managerial = their department, otherwise self.
- **MANAGEMENT scope** — who can *mutate* a row (edit / schedule / submit / cancel /
  soft-delete). FULL = all, **posting-manager = department**, otherwise self.

Role split:
- **Approvers = FULL + HOD only.** Posting/social managers are NOT approvers.
- **HOD** can approve/reject posts in their department but **manages only the posts
  they personally own** — a HOD must not get edit/cancel/delete over department posts.
- **Posting managers** manage (not approve) department posts.

**Why:** A prior review failed because a single scope helper conflated "can view" with
"can manage", letting HODs/managers edit/submit/cancel department posts, and because
approve/reject/get-by-id trusted the role without re-checking the *target row* — any
HOD/manager could act on a post outside their department by guessing its id
(privilege escalation / IDOR).

**How to apply:** Any new per-row action on social posts must pick the correct scope
helper and **re-verify scope against the fetched row** for non-FULL callers before
mutating/returning it. Never reuse the view scope to authorize a mutation. Keep the
client gating mirroring this, but treat the server as the only real enforcement.
