import { Router, type Request, type Response } from "express";
import {
  createAssignmentOverride,
  disableAssignmentOverride,
  getAssignmentOverrideHistory,
  getAssignmentOverrideState,
} from "../services/assignment-override.service";

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return null;
  }
  return userId;
}

router.get("/", async (req, res, next) => {
  try {
    if (!requireUser(req, res)) return;
    const data = await getAssignmentOverrideState();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    if (!requireUser(req, res)) return;
    const data = await getAssignmentOverrideHistory();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { newRatio, reason, effectiveFrom, effectiveTo } = req.body ?? {};
    const data = await createAssignmentOverride({
      newRatio,
      reason,
      effectiveFrom,
      effectiveTo,
      userId,
    });
    res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.status === 400) return res.status(400).json({ success: false, message: e.message });
    next(e);
  }
});

router.post("/:id/disable", async (req, res, next) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { reason } = req.body ?? {};
    const data = await disableAssignmentOverride(req.params.id, userId, reason);
    res.json({ success: true, data });
  } catch (e: any) {
    if (e.status === 404) return res.status(404).json({ success: false, message: e.message });
    next(e);
  }
});

export const assignmentOverrideRouter = router;
