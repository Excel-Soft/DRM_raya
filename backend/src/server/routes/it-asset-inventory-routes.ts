import { Router, type Request, type Response } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";
import {
  physicalAssetsRepository,
  ASSET_TYPES,
  ASSET_CONDITIONS,
  PROJECT_TYPES,
  type PhysicalAssetInput,
} from "../repositories/physical-assets.repository";
import { branchesRepository } from "../repositories/branches.repository";
import { requireRole } from "../middleware/auth.middleware";

// Physical IT asset inventory (laptops, mobiles, LEDs, desktops, tablets…) —
// deliberately mounted at /api/it/asset-inventory, kept separate from the
// pre-existing /api/it (domain/hosting/server infrastructure, unrelated to
// physical hardware — see it-assets-routes.ts) which this feature never
// touches.
const ASSET_READ_ROLES = ["admin", "super_admin", "super_hod", "hod", "it_manager", "it_executive", "developer"];
const ASSET_WRITE_ROLES = ["admin", "super_admin", "super_hod", "it_manager", "it_executive"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const assetInputSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES),
    projectType: z.enum(PROJECT_TYPES).nullable().optional(),
    makeModel: z.string().trim().max(200).nullable().optional(),
    colour: z.string().trim().max(100).nullable().optional(),
    purchaseDate: z.string().trim().nullable().optional(),
    warranty: z.string().trim().max(50).nullable().optional(),
    warrantyPeriod: z.string().trim().max(100).nullable().optional(),
    purchasedCondition: z.string().trim().max(100).nullable().optional(),
    currentCondition: z.enum(ASSET_CONDITIONS).optional(),
    empCode: z.string().trim().max(100).nullable().optional(),
    issuedStatus: z.string().trim().max(100).nullable().optional(),
    employeeName: z.string().trim().max(200).nullable().optional(),
    branchId: z.string().uuid().nullable().optional(),
    specification: z.string().trim().max(2000).nullable().optional(),
    assetOwnedBy: z.string().trim().max(200).nullable().optional(),
    mobilePhone: z.string().trim().max(50).nullable().optional(),
    itManagerRemarks: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

const assetUpdateSchema = assetInputSchema.partial();

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

function parsePurchaseDate(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const router = Router();

router.get("/", requireRole(...ASSET_READ_ROLES), async (req: Request, res: Response) => {
  try {
    const { branchId, assetType, condition } = req.query;
    const assets = await physicalAssetsRepository.list({
      branchId: typeof branchId === "string" && branchId ? branchId : undefined,
      assetType: typeof assetType === "string" && assetType ? assetType : undefined,
      condition: typeof condition === "string" && condition ? condition : undefined,
    });
    return res.json({ success: true, data: assets });
  } catch (error) {
    console.error("Error fetching physical assets:", error);
    return res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.get("/stats", requireRole(...ASSET_READ_ROLES), async (_req: Request, res: Response) => {
  try {
    const stats = await physicalAssetsRepository.getStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching asset stats:", error);
    return res.status(500).json({ error: "Failed to fetch asset stats" });
  }
});

router.post("/", requireRole(...ASSET_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = assetInputSchema.parse(req.body);
    const asset = await physicalAssetsRepository.create(parsed as PhysicalAssetInput, actorId(req));
    return res.status(201).json({ success: true, data: asset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid asset data", details: error.errors });
    }
    console.error("Error creating asset:", error);
    return res.status(500).json({ error: "Failed to create asset" });
  }
});

router.patch("/:id", requireRole(...ASSET_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = assetUpdateSchema.parse(req.body);
    const asset = await physicalAssetsRepository.update(req.params.id, parsed, actorId(req));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    return res.json({ success: true, data: asset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid asset data", details: error.errors });
    }
    console.error("Error updating asset:", error);
    return res.status(500).json({ error: "Failed to update asset" });
  }
});

router.delete("/:id", requireRole(...ASSET_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const deleted = await physicalAssetsRepository.softDelete(req.params.id, actorId(req));
    if (!deleted) return res.status(404).json({ error: "Asset not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return res.status(500).json({ error: "Failed to delete asset" });
  }
});

router.post(
  "/import",
  requireRole(...ASSET_WRITE_ROLES),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const text = req.file.buffer.toString("utf-8");
      const records: Record<string, string>[] = parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const branches = await branchesRepository.list(true);
      const branchByName = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));

      const toInsert: PhysicalAssetInput[] = [];
      const skippedRows: Array<{ row: number; reason: string }> = [];
      const warnings: Array<{ row: number; message: string }> = [];

      records.forEach((record, idx) => {
        const rowNum = idx + 2; // +1 for header row, +1 for 1-based
        const assetType = (record["Asset"] || "").trim();
        if (!assetType) {
          skippedRows.push({ row: rowNum, reason: "Asset (type) is required" });
          return;
        }

        const officeRaw = (record["Office"] || "").trim();
        let branchId: string | null = null;
        if (officeRaw) {
          branchId = branchByName.get(officeRaw.toLowerCase()) ?? null;
          if (!branchId) {
            warnings.push({ row: rowNum, message: `Office "${officeRaw}" not found — imported without an office` });
          }
        }

        toInsert.push({
          assetType,
          makeModel: record["Make/Model"] || null,
          colour: record["Colour"] || null,
          purchaseDate: parsePurchaseDate(record["Purchase Date"]),
          warranty: record["Warranty"] || null,
          warrantyPeriod: record["Warranty Period"] || null,
          purchasedCondition: record["Purchased Condition"] || null,
          currentCondition: record["Current Condition"] || undefined,
          empCode: record["Emp. Code"] || null,
          issuedStatus: record["Issued Status"] || null,
          employeeName: record["Employee Name"] || null,
          branchId,
          specification: record["Specification"] || null,
          assetOwnedBy: record["Asset Owned By"] || null,
          mobilePhone: record["Mobile Phone"] || null,
          itManagerRemarks: record["IT Manager Remarks"] || null,
        });
      });

      const { imported } = await physicalAssetsRepository.bulkInsert(toInsert, actorId(req));
      return res.json({ success: true, imported, skippedRows, warnings });
    } catch (error) {
      console.error("Error importing assets CSV:", error);
      return res.status(500).json({ error: "Failed to import CSV" });
    }
  },
);

export default router;
