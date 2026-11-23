import { Express, Request, Response } from "express";
import { db, pool } from "../db";
import { productPostingData, insertProductPostingDataSchema, restrictedKeywords, insertRestrictedKeywordSchema } from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { normalizeRole } from "../utils/role-utils";
import { z } from "zod";
import { ActivityLogService } from "./services/activity-service";
import fs from "fs";
import { ensureLegacyPostingFile } from "./legacy-assets-routes";
import { ZipStoreWriter } from "../utils/zip-store";

const postingStatusUpdateSchema = z.object({
  status: z.string().trim().min(1, "status is required")
}).strict();

export function registerPostingDataRoutes(app: Express) {
  const ensurePostingRole = (req: Request, res: Response, allowed: string[]) => {
    const user = req.user as any;
    const activeRoleId = normalizeRole(user?.activeRoleId || user?.roleId || "");
    const roleSet = new Set(
      [activeRoleId, ...(Array.isArray(user?.roles) ? user.roles : [])]
        .filter(Boolean)
        .map((role) => normalizeRole(String(role))),
    );
    const allowedRoles = allowed.map((role) => normalizeRole(role));

    if (!activeRoleId || !allowedRoles.some((role) => roleSet.has(role))) {
      res.status(403).json({ error: "Not authorized for posting data action" });
      return false;
    }
    return true;
  };

  // Get all posting data
  app.get("/api/posting-data", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const { category, startDate, endDate } = req.query;

      // ?type=keywords — View Keywords: keyword rows only (no product image;
      // legacy webxl_posting_keywords + new Add Keywords entries), with the
      // category name (legacy webxl_category) and an inclusive end date.
      // Avoids shipping the ~67k product-image rows to that page.
      if (req.query.type === "keywords") {
        const where: string[] = ["NULLIF(p.main_image, '') IS NULL"];
        const params: unknown[] = [];
        if (category && category !== "all") {
          params.push(String(category));
          where.push(`p.category = $${params.length}`);
        }
        if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          params.push(startDate);
          where.push(`p.created_at >= $${params.length}::date`);
        }
        if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          params.push(endDate);
          where.push(`p.created_at < ($${params.length}::date + 1)`);
        }
        const { rows } = await pool.query(
          `SELECT p.id, p.category, COALESCE(NULLIF(btrim(c.name), ''), p.category) AS "categoryName",
                  p.title, p.keywords, p.description, p.status, p.user_id AS "userId",
                  p.created_at AS "createdAt", p.updated_at AS "updatedAt"
           FROM drm.product_posting_data p
           LEFT JOIN legacy_archive.webxl_category c ON c.id = p.category
           WHERE ${where.join(" AND ")}
           ORDER BY p.created_at DESC`,
          params,
        );
        return res.json(rows);
      }

      let conditions = [];
      
      if (category && category !== "all") {
        conditions.push(eq(productPostingData.category, category as string));
      }
      
      if (startDate) {
        conditions.push(gte(productPostingData.createdAt, new Date(startDate as string)));
      }
      
      if (endDate) {
        conditions.push(lte(productPostingData.createdAt, new Date(endDate as string)));
      }

      const query = db.select().from(productPostingData);
      
      if (conditions.length > 0) {
        query.where(and(...conditions));
      }
      
      const data = await query.orderBy(desc(productPostingData.createdAt));
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching posting data:", error);
      res.status(500).json({ error: "Failed to fetch posting data" });
    }
  });

  // Categories that have keyword rows, with names — View Keywords' Category filter.
  app.get("/api/posting-data/keyword-categories", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const { rows } = await pool.query(
        `SELECT p.category AS value, COALESCE(NULLIF(btrim(c.name), ''), p.category) AS label, count(*)::int AS count
         FROM drm.product_posting_data p
         LEFT JOIN legacy_archive.webxl_category c ON c.id = p.category
         WHERE NULLIF(p.main_image, '') IS NULL
         GROUP BY 1, 2
         ORDER BY 2`,
      );
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching keyword categories:", error);
      res.status(500).json({ error: "Failed to fetch keyword categories" });
    }
  });

  // ---- View Products (old-DRM catalogue) -------------------------------------
  // Mirrors legacy view-posting-product (func.php): a product is one
  // webxl_posting_mimg row (main image + category); its small views are the
  // webxl_posting_data rows with that mimg_id. Categories 987 (Restricted) and
  // 988 (Trash) are excluded, exactly like countpostingProductsAll(). Read
  // straight from legacy_archive (the earlier ETL flattened these into
  // product_posting_data without the main image). Image files are served via
  // /api/legacy-assets/posting-data?f=<file>.
  const HIDDEN_PRODUCT_CATEGORIES = ["987", "988"];
  const MOVE_TARGETS: Record<string, string> = { restricted: "987", trash: "988" };
  const PRODUCT_ROLES = ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"];
  // Legacy products with moves (Restricted/Trash) applied; the archive itself is never changed.
  const PRODUCTS_SRC = `(SELECT m0.id, m0.img, m0.create_date, COALESCE(mv.to_cat, m0.cat) AS cat
     FROM legacy_archive.webxl_posting_mimg m0
     LEFT JOIN drm.posting_product_moves mv ON mv.mimg_id = m0.id)`;

  app.get("/api/posting-data/product-categories", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const { rows } = await pool.query(
        `SELECT value, label, count FROM (
           SELECT m.cat AS value, COALESCE(NULLIF(btrim(c.name), ''), 'Category ' || m.cat) AS label, count(*)::int AS count
           FROM ${PRODUCTS_SRC} m
           LEFT JOIN legacy_archive.webxl_category c ON c.id = m.cat
           WHERE m.cat <> ALL($1::text[])
           GROUP BY 1, 2
         ) t
         ORDER BY lower(label), value`,
        [HIDDEN_PRODUCT_CATEGORIES],
      );
      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      res.json({ total, categories: rows });
    } catch (error: any) {
      console.error("Error fetching product categories:", error);
      res.status(500).json({ error: "Failed to fetch product categories" });
    }
  });

  // ?category=<id>|all &scope=active|restricted|trash &page=1 &pageSize=48  -> { total, page, pageSize, data }
  app.get("/api/posting-data/products", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const category = String(req.query.category ?? "all");
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 48));
      const page = Math.max(1, Number(req.query.page) || 1);
      // scope=restricted|trash -> the Restricted Products (987) / Trash Products (988) pages.
      const scope = String(req.query.scope ?? "active");
      const params: unknown[] = [HIDDEN_PRODUCT_CATEGORIES];
      let where = `m.cat <> ALL($1::text[])`;
      if (scope === "restricted" || scope === "trash") {
        params[0] = MOVE_TARGETS[scope];
        where = `m.cat = $1`;
      } else if (category !== "all") {
        params.push(category);
        where += ` AND m.cat = $${params.length}`;
      }
      const countRes = await pool.query(
        `SELECT count(*)::int AS total FROM ${PRODUCTS_SRC} m WHERE ${where}`,
        params,
      );
      const total = countRes.rows[0]?.total ?? 0;
      params.push(pageSize, (page - 1) * pageSize);
      // Page of products first, then ONE pass over webxl_posting_data for their
      // small views (archive tables have no mimg_id index and the app user can't
      // add one; a per-row subquery took ~0.7 s per page, this ~50 ms).
      const { rows } = await pool.query(
        `WITH page AS (
           SELECT m.id, m.cat, m.img, m.create_date
           FROM ${PRODUCTS_SRC} m
           WHERE ${where}
           ORDER BY m.id::int DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}
         ),
         thumbs AS (
           SELECT d.mimg_id, json_agg(d.images ORDER BY d.id::int) AS images
           FROM legacy_archive.webxl_posting_data d
           WHERE d.mimg_id IN (SELECT id FROM page) AND NULLIF(btrim(d.images), '') IS NOT NULL
           GROUP BY d.mimg_id
         )
         SELECT page.id, page.cat AS category, COALESCE(NULLIF(btrim(c.name), ''), page.cat) AS "categoryName",
                NULLIF(btrim(page.img), '') AS "mainImage", page.create_date AS "createdAt",
                COALESCE(t.images, '[]'::json) AS images,
                NULLIF(btrim(fc.name), '') AS "fromCategoryName"
         FROM page
         LEFT JOIN thumbs t ON t.mimg_id = page.id
         LEFT JOIN legacy_archive.webxl_category c ON c.id = page.cat
         LEFT JOIN drm.posting_product_moves mv ON mv.mimg_id = page.id
         LEFT JOIN legacy_archive.webxl_category fc ON fc.id = mv.from_cat AND mv.from_cat <> ALL(ARRAY['987','988'])
         ORDER BY page.id::int DESC`,
        params,
      );
      res.json({ total, page, pageSize, data: rows });
    } catch (error: any) {
      console.error("Error fetching posting products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Legacy "Move To Restricted Products" / "Move To Trash": body { ids: string[], target: "restricted"|"trash" }
  app.post("/api/posting-data/products/move", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, PRODUCT_ROLES)) return;
      const toCat = MOVE_TARGETS[String(req.body?.target ?? "")];
      const ids: string[] = Array.isArray(req.body?.ids)
        ? Array.from(new Set<string>(req.body.ids.map((x: unknown) => String(x)).filter((x: string) => /^\d+$/.test(x))))
        : [];
      if (!toCat) return res.status(400).json({ error: "target must be restricted or trash" });
      if (ids.length === 0 || ids.length > 5000) return res.status(400).json({ error: "Select 1 to 5000 products" });
      const userId = String((req.user as any)?.id ?? "");
      const { rowCount } = await pool.query(
        `INSERT INTO drm.posting_product_moves (mimg_id, from_cat, to_cat, moved_by)
         SELECT m.id, m.cat, $2, $3
         FROM legacy_archive.webxl_posting_mimg m
         WHERE m.id = ANY($1::text[])
         ON CONFLICT (mimg_id) DO UPDATE SET to_cat = EXCLUDED.to_cat, moved_by = EXCLUDED.moved_by, moved_at = now()`,
        [ids, toCat, userId || null],
      );
      res.json({ moved: rowCount ?? 0, target: req.body.target });
    } catch (error: any) {
      console.error("Error moving posting products:", error);
      res.status(500).json({ error: "Failed to move products" });
    }
  });

  // Legacy "Download zip": body { ids: string[] } -> zip with one folder per product
  // (<id>/<main image> + its small views). Images come from the legacy-asset cache.
  const MAX_ZIP_PRODUCTS = 300;
  app.post("/api/posting-data/products/download", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, PRODUCT_ROLES)) return;
      const ids: string[] = Array.isArray(req.body?.ids)
        ? Array.from(new Set<string>(req.body.ids.map((x: unknown) => String(x)).filter((x: string) => /^\d+$/.test(x))))
        : [];
      if (ids.length === 0) return res.status(400).json({ error: "Select at least 1 product" });
      if (ids.length > MAX_ZIP_PRODUCTS) {
        return res.status(400).json({ error: `Select at most ${MAX_ZIP_PRODUCTS} products per download` });
      }
      const { rows } = await pool.query(
        `WITH thumbs AS (
           SELECT d.mimg_id, json_agg(d.images ORDER BY d.id::int) AS images
           FROM legacy_archive.webxl_posting_data d
           WHERE d.mimg_id = ANY($1::text[]) AND NULLIF(btrim(d.images), '') IS NOT NULL
           GROUP BY d.mimg_id
         )
         SELECT m.id, NULLIF(btrim(m.img), '') AS main, COALESCE(t.images, '[]'::json) AS images
         FROM legacy_archive.webxl_posting_mimg m
         LEFT JOIN thumbs t ON t.mimg_id = m.id
         WHERE m.id = ANY($1::text[])
         ORDER BY m.id::int DESC`,
        [ids],
      );
      const files: { zipName: string; file: string }[] = [];
      for (const r of rows) {
        const seen = new Set<string>();
        for (const f of [r.main, ...(r.images as string[])]) {
          if (!f || seen.has(f)) continue;
          seen.add(f);
          files.push({ zipName: `${r.id}/${f}`, file: f });
        }
      }
      if (files.length === 0) return res.status(404).json({ error: "No images for the selected products" });

      // Pull any uncached images from the legacy host first (6 at a time).
      const paths = new Map<string, string | null>();
      for (let i = 0; i < files.length; i += 6) {
        await Promise.all(files.slice(i, i + 6).map(async (f) => paths.set(f.file, await ensureLegacyPostingFile(f.file))));
      }
      const available = files.filter((f) => paths.get(f.file));
      if (available.length === 0) return res.status(404).json({ error: "Images are not available from the old server" });

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="products-${stamp}.zip"`);
      res.setHeader("X-Missing-Files", String(files.length - available.length));
      const zip = new ZipStoreWriter(res);
      for (const f of available) {
        await zip.addFile(f.zipName, await fs.promises.readFile(paths.get(f.file)!));
      }
      await zip.finish();
      res.end();
    } catch (error: any) {
      console.error("Error building products zip:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to build zip" });
      else res.destroy(error);
    }
  });

  // Get product counts by category
  app.get("/api/posting-data/counts", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT category, COUNT(*) as count 
        FROM product_posting_data 
        GROUP BY category
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching posting data counts:", error);
      res.status(500).json({ error: "Failed to fetch counts" });
    }
  });

  // Create posting data
  app.post("/api/posting-data", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const userId = (req.user as any)?.userId;
      const { category, productLink, productTitle, companyName, quantity, price, status, notes } = req.body ?? {};
      const validatedData = insertProductPostingDataSchema.parse({
        category, productLink, productTitle, companyName, quantity, price, status, notes,
        userId
      });

      const [newItem] = await db.insert(productPostingData).values(validatedData).returning();
      await ActivityLogService.log({
        userId,
        action: "POSTING_DATA_CREATED",
        resourceType: "product_posting_data",
        resourceId: newItem.id,
        details: `Product: ${newItem.title}, Category: ${newItem.category}`,
      });
      res.status(201).json(newItem);
    } catch (error: any) {
      console.error("Error creating posting data:", error);
      res.status(400).json({ error: error.message || "Failed to create posting data" });
    }
  });

  // Bulk import (simplified for now, handles multiple entries)
  app.post("/api/posting-data/import", async (req: Request, res: Response) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"])) return;
      const userId = (req.user as any)?.userId;
      const items = Array.isArray(req.body) ? req.body : [req.body];
      
      const validatedItems = items.map((item: any) => {
        const { category, productLink, productTitle, companyName, quantity, price, notes } = item ?? {};
        return insertProductPostingDataSchema.parse({
          category, productLink, productTitle, companyName, quantity, price, notes,
          userId,
          status: "Pending"
        });
      });

      const newItems = await db.insert(productPostingData).values(validatedItems).returning();
      for (const item of newItems) {
        await ActivityLogService.log({
          userId,
          action: "POSTING_DATA_IMPORTED",
          resourceType: "product_posting_data",
          resourceId: item.id,
          details: `Imported product: ${item.title}`,
        });
      }
      res.status(201).json(newItems);
    } catch (error: any) {
      console.error("Error importing posting data:", error);
      res.status(400).json({ error: error.message || "Failed to import posting data" });
    }
  });

  // Update status (Verified/Pending)
  app.patch("/api/posting-data/:id/status", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const { id } = req.params;
      const _statusParsed = postingStatusUpdateSchema.safeParse(req.body);
      if (!_statusParsed.success) return res.status(400).json({ error: "Invalid status payload", issues: _statusParsed.error.issues });
      const { status } = _statusParsed.data;
      
      const [updatedItem] = await db.update(productPostingData)
        .set({ status, updatedAt: new Date() })
        .where(eq(productPostingData.id, id))
        .returning();
        
      if (!updatedItem) return res.status(404).json({ error: "Item not found" });

      await ActivityLogService.log({
        userId: (req.user as any)?.userId,
        action: "POSTING_DATA_STATUS_UPDATED",
        resourceType: "product_posting_data",
        resourceId: id,
        details: `Status set to: ${status}`,
      });

      res.json(updatedItem);
    } catch (error: any) {
      console.error("Error updating posting data status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // ── Restricted Keywords ───────────────────────────────────────────────────
  // Includes the old-DRM list (webxl_attribute refId 13), copied in by
  // scripts/migration/migrate-legacy-restricted-keywords.sql.
  const restrictedKeywordTaken = async (keyword: string, exceptId?: string) => {
    const { rows } = await pool.query(
      `SELECT 1 FROM drm.restricted_keywords WHERE lower(btrim(keyword)) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1`,
      [keyword, exceptId ?? null],
    );
    return rows.length > 0;
  };


  app.get("/api/restricted-keywords", async (_req, res) => {
    try {
      // Newest first; the imported old-DRM list shares one timestamp, so then A-Z.
      const data = await db
        .select()
        .from(restrictedKeywords)
        .orderBy(desc(restrictedKeywords.createdAt), sql`lower(${restrictedKeywords.keyword})`);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching restricted keywords:", error);
      res.status(500).json({ error: "Failed to fetch restricted keywords" });
    }
  });

  app.post("/api/restricted-keywords", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const validated = insertRestrictedKeywordSchema.parse({ ...req.body, keyword: String(req.body?.keyword ?? "").trim() });
      if (!validated.keyword) return res.status(400).json({ error: "Keyword is required" });
      if (await restrictedKeywordTaken(validated.keyword)) {
        return res.status(409).json({ error: "This keyword is already in the restricted list" });
      }
      const [newItem] = await db.insert(restrictedKeywords).values(validated).returning();
      await ActivityLogService.log({
        userId: (req.user as any)?.userId,
        action: "RESTRICTED_KEYWORD_ADDED",
        resourceType: "restricted_keyword",
        resourceId: newItem.id,
        details: `Keyword: ${newItem.keyword}`,
      });
      res.status(201).json(newItem);
    } catch (error: any) {
      console.error("Error adding restricted keyword:", error);
      res.status(400).json({ error: error.message || "Failed to add restricted keyword" });
    }
  });

  app.patch("/api/restricted-keywords/:id", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const { id } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: "Keyword not found" });
      const keyword = String(req.body?.keyword ?? "").trim();
      if (!keyword) return res.status(400).json({ error: "Keyword is required" });
      if (await restrictedKeywordTaken(keyword, id)) {
        return res.status(409).json({ error: "This keyword is already in the restricted list" });
      }
      const [updated] = await db
        .update(restrictedKeywords)
        .set({ keyword })
        .where(eq(restrictedKeywords.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Keyword not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating restricted keyword:", error);
      res.status(500).json({ error: "Failed to update restricted keyword" });
    }
  });

  app.delete("/api/restricted-keywords/:id", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const { id } = req.params;
      await db.delete(restrictedKeywords).where(eq(restrictedKeywords.id, id));
      await ActivityLogService.log({
        userId: (req.user as any)?.userId,
        action: "RESTRICTED_KEYWORD_DELETED",
        resourceType: "restricted_keyword",
        resourceId: id,
      });
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting restricted keyword:", error);
      res.status(500).json({ error: "Failed to delete" });
    }
  });
}
