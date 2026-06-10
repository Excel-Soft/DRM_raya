---
name: pg pool client double-release pitfall
description: never call client.release() in try-block early returns when finally already releases
---

When a route does `const client = await pool.connect()` (node `pg`) with a
`try { ... } finally { client.release(); }`, do **not** also call
`client.release()` on early-return paths inside the `try` (auth fail, validation
400, conflict 409, not-found 404). The `finally` runs on every return, so those
manual releases double-release the same client.

**Why:** double-release on `pg` can throw / return a client to the pool twice,
which destabilizes the pool under load and shows up as flaky 500s on the *next*
requests, not the one that double-released. Code review flags it as a blocking
reliability bug.

**How to apply:** release the client in exactly one place — the `finally` (or
guard with a `released` boolean). Early returns just `return res.status(...)`.
