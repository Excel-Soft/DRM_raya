import { Router, type Express } from "express";
import { servicePoolRepository } from "./repositories/service-pool.repository";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { isManagerialRole } from "./utils/role-utils";

export function registerServicePoolRoutes(app: Express) {
    const router = Router();

    // Ensure table on registration (idempotent)
    servicePoolRepository.ensureTable();

    router.get("/service-pool/list", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });

            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 10));
            const search = (req.query.search as string) || "";
            const status = (req.query.status as string) || "";
            const dropoutCategory = (req.query.dropoutCategory as string) || "";
            const showDuplicates = req.query.duplicates === "true";
            const currentQ = req.query.currentQ === "true";

            const isManager = isManagerialRole((req.user as any).activeRoleId || req.user.roleId);
            const allowedUserIds = isManager ? await getDepartmentFilterUserIds(req) : [req.user.userId];

            const result = await servicePoolRepository.list({
                search,
                status,
                dropoutCategory,
                page,
                pageSize,
                showDuplicates,
                currentQ,
                userIds: allowedUserIds
            });

            res.json(result);
        } catch (err) {
            console.error("Error listing service pool:", err);
            res.status(500).json({ error: "Failed to fetch service pool list" });
        }
    });

    router.get("/service-pool/summary", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const isManager = isManagerialRole((req.user as any).activeRoleId || req.user.roleId);
            const allowedUserIds = isManager ? await getDepartmentFilterUserIds(req) : [req.user.userId];
            const summary = await servicePoolRepository.getSummary(allowedUserIds);
            res.json(summary);
        } catch (err) {
            console.error("Error fetching service pool summary:", err);
            res.status(500).json({ error: "Failed to fetch service pool summary" });
        }
    });

    // Assign a service person to a pool entry
    router.patch("/service-pool/:id/assign", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const { servicePersonId } = req.body || {};
            if (!servicePersonId) return res.status(400).json({ error: "servicePersonId is required." });
            const result = await servicePoolRepository.assign(req.params.id, servicePersonId, req.user.userId);
            if (!result) return res.status(404).json({ error: "Pool entry not found" });
            res.json({ success: true });
        } catch (err) {
            console.error("Error assigning service pool entry:", err);
            res.status(500).json({ error: "Failed to assign pool entry" });
        }
    });

    // Transfer a pool entry to another service person
    router.patch("/service-pool/:id/transfer", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const { servicePersonId } = req.body || {};
            if (!servicePersonId) return res.status(400).json({ error: "servicePersonId is required." });
            const result = await servicePoolRepository.transfer(req.params.id, servicePersonId, req.user.userId);
            if (!result) return res.status(404).json({ error: "Pool entry not found" });
            res.json({ success: true });
        } catch (err) {
            console.error("Error transferring service pool entry:", err);
            res.status(500).json({ error: "Failed to transfer pool entry" });
        }
    });

    // Record a follow-up message draft (no external WhatsApp integration; draft only)
    router.post("/service-pool/:id/message-draft", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const { channel, message } = req.body || {};
            if (!message || !String(message).trim()) {
                return res.status(400).json({ error: "Message text is required." });
            }
            const draft = await servicePoolRepository.recordMessageDraft(
                req.params.id,
                channel || "whatsapp",
                String(message).trim(),
                req.user.userId,
            );
            if (!draft) return res.status(404).json({ error: "Pool entry not found" });
            res.json(draft);
        } catch (err) {
            console.error("Error recording message draft:", err);
            res.status(500).json({ error: "Failed to record message draft" });
        }
    });

    app.use("/api/sales", router);
}

export default registerServicePoolRoutes;
