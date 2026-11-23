import { Router } from "express";
import { db, pool } from "../db";
import { drmPolicies, insertDrmPolicySchema, type DrmPolicy } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { isManagerialRole } from "../utils/role-utils";
import { ActivityLogService } from "./services/activity-service";

const router = Router();

function getUserRole(req: any): string | undefined {
  return req.user?.roleId ?? req.user?.activeRoleId ?? req.user?.role;
}

function canManage(req: any): boolean {
  return isManagerialRole(getUserRole(req));
}

function parseLegacyInt(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function mapModernPolicyRow(p: DrmPolicy) {
  return {
    ...p,
    legacyReadOnly: false,
    legacyFileName: null as string | null,
  };
}

function mapLegacyPolicyRow(r: {
  _legacy_pk: string;
  head: string | null;
  detail: string | null;
  policy_type: string | null;
  min_allow: string | null;
  max_allow: string | null;
  penalty: string | null;
  img: string | null;
  create_at: string | null;
}) {
  const created =
    r.create_at && String(r.create_at).trim()
      ? new Date(r.create_at.replace(" ", "T"))
      : new Date();
  return {
    id: `legacy-policy-${r._legacy_pk}`,
    head: (r.head && r.head.trim()) || "Untitled",
    type: (r.policy_type && r.policy_type.trim()) || null,
    fileUrl: null,
    penalty: (r.penalty && r.penalty.trim()) || null,
    minAllow: parseLegacyInt(r.min_allow),
    maxAllow: parseLegacyInt(r.max_allow),
    description: r.detail || null,
    status: "active" as const,
    createdBy: null,
    createdAt: created,
    updatedAt: created,
    legacyReadOnly: true,
    legacyFileName: (r.img && r.img.trim()) || null,
  };
}

function isLegacyPolicyId(id: string): boolean {
  return id.startsWith("legacy-policy-");
}

// Get all policies (modern + legacy archive)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const modern = await db.select().from(drmPolicies).orderBy(desc(drmPolicies.createdAt));
    const { rows: legacyRows } = await pool.query<{
      _legacy_pk: string;
      head: string | null;
      detail: string | null;
      policy_type: string | null;
      min_allow: string | null;
      max_allow: string | null;
      penalty: string | null;
      img: string | null;
      create_at: string | null;
    }>(`
      SELECT
        _legacy_pk,
        head,
        detail,
        policy_type,
        min_allow,
        max_allow,
        penalty,
        img,
        create_at
      FROM legacy_archive.webxl_policies
      ORDER BY NULLIF(trim(create_at), '')::timestamp DESC NULLS LAST
    `);

    const combined = [
      ...modern.map(mapModernPolicyRow),
      ...legacyRows.map(mapLegacyPolicyRow),
    ];
    combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json(combined);
  } catch (error: any) {
    console.error("Error fetching policies:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

// Create a new policy
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const validatedData = insertDrmPolicySchema.parse(req.body);
    const userId = (req.user as any).userId;
    validatedData.createdBy = userId;
    const [newPolicy] = await db.insert(drmPolicies).values(validatedData as any).returning();
    await ActivityLogService.log({
      userId,
      action: "create",
      resourceType: "policy",
      resourceId: newPolicy.id,
      details: (newPolicy as any).title ?? (newPolicy as any).name,
    });
    res.status(201).json(newPolicy);
  } catch (error: any) {
    console.error("Error creating policy:", error);
    res.status(400).json({ error: error.message || "Failed to create policy" });
  }
});

// Delete a policy
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const { id } = req.params;
    if (isLegacyPolicyId(id)) {
      return res.status(400).json({ error: "Legacy policies are read-only" });
    }
    await db.delete(drmPolicies).where(eq(drmPolicies.id, id));
    await ActivityLogService.log({
      userId: (req.user as any).userId,
      action: "delete",
      resourceType: "policy",
      resourceId: id,
    });
    res.status(204).end();
  } catch (error: any) {
    console.error("Error deleting policy:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

export default router;
