import { Router } from "express";

const router = Router();

// DEPRECATED: this endpoint used to trust client-reported role/screenData as
// authoritative and had no server-side identity check — see
// docs/copilot/PROGRESS.md and SECURITY.md. The assistant panel in the app no
// longer calls it; it now opens WebExcels DRM Copilot (/api/copilot/*), which
// derives identity from the verified session and enforces per-tool scope.
// This route is intentionally left non-functional rather than silently
// "fixed in place", so it can never be used as a bypass of Copilot's
// restrictions by a client that still points at the old path.
router.post("/chat", (_req, res) => {
  res.status(410).json({
    success: false,
    error: "Deprecated",
    message:
      "This endpoint has been retired. Use the WebExcels DRM Copilot panel (POST /api/copilot/ask), which is authenticated and permission-scoped.",
    migrateTo: "/api/copilot/ask",
  });
});

export default router;
