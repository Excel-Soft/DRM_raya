import { Express, Request, Response } from "express";
import { db } from "./db";
import { productPostingData, insertProductPostingDataSchema, restrictedKeywords, insertRestrictedKeywordSchema } from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "./auth.middleware";
import { normalizeRole } from "./utils/role-utils";

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
      const validatedData = insertProductPostingDataSchema.parse({
        ...req.body,
        userId
      });

      const [newItem] = await db.insert(productPostingData).values(validatedData).returning();
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
      
      const validatedItems = items.map(item => insertProductPostingDataSchema.parse({
        ...item,
        userId,
        status: "Pending"
      }));

      const newItems = await db.insert(productPostingData).values(validatedItems).returning();
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
      const { status } = req.body;
      
      const [updatedItem] = await db.update(productPostingData)
        .set({ status, updatedAt: new Date() })
        .where(eq(productPostingData.id, id))
        .returning();
        
      if (!updatedItem) return res.status(404).json({ error: "Item not found" });
      res.json(updatedItem);
    } catch (error: any) {
      console.error("Error updating posting data status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // ── Restricted Keywords ───────────────────────────────────────────────────


  app.get("/api/restricted-keywords", async (_req, res) => {
    try {
      const data = await db.select().from(restrictedKeywords).orderBy(desc(restrictedKeywords.createdAt));
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching restricted keywords:", error);
      res.status(500).json({ error: "Failed to fetch restricted keywords" });
    }
  });

  app.post("/api/restricted-keywords", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const validated = insertRestrictedKeywordSchema.parse(req.body);
      const [newItem] = await db.insert(restrictedKeywords).values(validated).returning();
      res.status(201).json(newItem);
    } catch (error: any) {
      console.error("Error adding restricted keyword:", error);
      res.status(400).json({ error: error.message || "Failed to add restricted keyword" });
    }
  });

  app.delete("/api/restricted-keywords/:id", async (req, res) => {
    try {
      if (!ensurePostingRole(req, res, ["admin", "product_posting_manager"])) return;
      const { id } = req.params;
      await db.delete(restrictedKeywords).where(eq(restrictedKeywords.id, id));
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting restricted keyword:", error);
      res.status(500).json({ error: "Failed to delete" });
    }
  });
}
