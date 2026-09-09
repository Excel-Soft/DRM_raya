import { type Express, type Request, type Response } from "express";
import { serviceReportsRepository, type ServiceListOptions } from "./repositories/service-reports.repository";
import { serviceDocumentsRepository, type ServiceDocType } from "./repositories/service-documents.repository";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { isManagerialRole } from "./utils/role-utils";
import { isServiceGradeKey } from "./utils/service-grade";

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function scopedUserIds(req: Request): Promise<string[] | null> {
  const isManager = isManagerialRole((req.user as any).activeRoleId || req.user!.roleId);
  return isManager ? await getDepartmentFilterUserIds(req) : [req.user!.userId];
}

function listOpts(req: Request, userIds: string[] | null): ServiceListOptions {
  return {
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 25,
    search: (req.query.search as string) || undefined,
    executive: (req.query.executive as string) || undefined,
    status: (req.query.status as string) || undefined,
    dateFrom: (req.query.dateFrom as string) || undefined,
    dateTo: (req.query.dateTo as string) || undefined,
    userIds,
  };
}

export async function registerServiceReportsRoutes(app: Express) {
  // Make sure derived storage / columns exist (idempotent). Awaited so the
  // first requests cannot race against missing columns/tables; if schema prep
  // fails we fail fast rather than serving a half-initialized state.
  await serviceReportsRepository.ensureComplaintColumns();
  await serviceDocumentsRepository.ensureTable();

  // ---- Grade customers ----------------------------------------------------
  app.get("/api/service/customers", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const grade = (req.query.grade as string) || "";
      if (!isServiceGradeKey(grade)) {
        return res.status(400).json({ error: "Invalid or missing grade. Use one of A, B_PLUS, B, B_MINUS." });
      }
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.listCustomersByGrade(grade, listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error listing service customers by grade:", err);
      res.status(500).json({ error: "Failed to fetch service customers" });
    }
  });

  // ---- Follow-ups ---------------------------------------------------------
  app.get("/api/service/followups/monthly", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.monthlyFollowups(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error listing monthly followups:", err);
      res.status(500).json({ error: "Failed to fetch monthly followups" });
    }
  });

  app.get("/api/service/followups/not-followed", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.notFollowed(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error listing not-followed customers:", err);
      res.status(500).json({ error: "Failed to fetch not-followed customers" });
    }
  });

  // ---- Dropouts (joined + paginated) --------------------------------------
  app.get("/api/service/dropouts/report", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.dropouts(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error listing dropouts:", err);
      res.status(500).json({ error: "Failed to fetch dropouts" });
    }
  });

  app.get("/api/service/dropouts/weekly", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.dropouts({ ...listOpts(req, userIds), weeklyOnly: true });
      res.json(result);
    } catch (err) {
      console.error("Error listing weekly dropouts:", err);
      res.status(500).json({ error: "Failed to fetch weekly dropouts" });
    }
  });

  // ---- Due VAS payments ---------------------------------------------------
  app.get("/api/service/payments/due", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.dueVasPayments(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error listing due VAS payments:", err);
      res.status(500).json({ error: "Failed to fetch due payments" });
    }
  });

  // ---- Dashboard counts ---------------------------------------------------
  app.get("/api/service/dashboard/counts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.dashboardCounts(userIds);
      res.json(result);
    } catch (err) {
      console.error("Error fetching service dashboard counts:", err);
      res.status(500).json({ error: "Failed to fetch dashboard counts" });
    }
  });

  // ---- Documents (BV / VAS) ----------------------------------------------
  app.get("/api/service/documents", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const isManager = isManagerialRole((req.user as any).activeRoleId || req.user.roleId);
      const userIds = isManager ? await getDepartmentFilterUserIds(req) : [req.user.userId];
      const result = await serviceDocumentsRepository.list({
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 25,
        search: (req.query.search as string) || undefined,
        docType: (req.query.docType as ServiceDocType) || undefined,
        verificationStatus: (req.query.verificationStatus as string) || undefined,
        userIds,
      });
      res.json(result);
    } catch (err) {
      console.error("Error listing service documents:", err);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/service/documents", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { docType, name, url } = req.body || {};
      if (docType !== "BV" && docType !== "VAS") {
        return res.status(400).json({ error: "docType must be 'BV' or 'VAS'." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Document name is required." });
      }
      if (url && !isValidHttpUrl(String(url).trim())) {
        return res.status(400).json({ error: "Attachment URL must be a valid http(s) URL." });
      }
      const created = await serviceDocumentsRepository.create({
        customerId: req.body.customerId,
        serviceCustomerId: req.body.serviceCustomerId,
        docType,
        name: String(name).trim(),
        url: url ? String(url).trim() : null,
        packageName: req.body.packageName,
        dueDate: req.body.dueDate,
        remarks: req.body.remarks,
        userId: req.user.userId,
      });
      res.json(created);
    } catch (err) {
      console.error("Error creating service document:", err);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.patch("/api/service/documents/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (req.body.url && !isValidHttpUrl(String(req.body.url).trim())) {
        return res.status(400).json({ error: "Attachment URL must be a valid http(s) URL." });
      }
      const updated = await serviceDocumentsRepository.update(req.params.id, {
        name: req.body.name,
        url: req.body.url ? String(req.body.url).trim() : undefined,
        packageName: req.body.packageName,
        dueDate: req.body.dueDate,
        remarks: req.body.remarks,
        userId: req.user.userId,
      });
      if (!updated) return res.status(404).json({ error: "Document not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating service document:", err);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.patch("/api/service/documents/:id/verify", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const status = (req.body.verificationStatus as string) || "";
      if (!["pending", "verified", "rejected"].includes(status)) {
        return res.status(400).json({ error: "verificationStatus must be pending, verified or rejected." });
      }
      const updated = await serviceDocumentsRepository.setVerification(req.params.id, status, req.user.userId);
      if (!updated) return res.status(404).json({ error: "Document not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error verifying service document:", err);
      res.status(500).json({ error: "Failed to verify document" });
    }
  });

  app.delete("/api/service/documents/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await serviceDocumentsRepository.remove(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting service document:", err);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });
}

export default registerServiceReportsRoutes;
