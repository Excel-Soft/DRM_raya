import { Router, type Express } from "express";
import { servicePoolRepository } from "../repositories/service-pool.repository";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { isManagerialRole, normalizeRole, ROLES } from "../utils/role-utils";

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

            const roleForScoping = (req.user as any).activeRoleId || req.user.roleId;
            const isManager = isManagerialRole(roleForScoping);
            const isSalesManagerRole = normalizeRole(roleForScoping) === ROLES.SALES_MANAGER;
            const allowedUserIds = isSalesManagerRole
                ? [req.user.userId]
                : isManager
                    ? await getDepartmentFilterUserIds(req)
                    : [req.user.userId];

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
            const roleForScoping = (req.user as any).activeRoleId || req.user.roleId;
            const isManager = isManagerialRole(roleForScoping);
            const isSalesManagerRole = normalizeRole(roleForScoping) === ROLES.SALES_MANAGER;
            const allowedUserIds = isSalesManagerRole
                ? [req.user.userId]
                : isManager
                    ? await getDepartmentFilterUserIds(req)
                    : [req.user.userId];
            const summary = await servicePoolRepository.getSummary(allowedUserIds, isManager);
            res.json(summary);
        } catch (err) {
            console.error("Error fetching service pool summary:", err);
            res.status(500).json({ error: "Failed to fetch service pool summary" });
        }
    });

    // GM accounts (approved GM sales) whose company was never pulled into the
    // service pool — the legacy "GM Account Not In Service Pool" report tab.
    // Managerial roles only, same gate as assigning/transferring pool entries.
    router.get("/service-pool/gm-not-in-pool", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const roleForScoping = (req.user as any).activeRoleId || req.user.roleId;
            if (!isManagerialRole(roleForScoping)) return res.status(403).json({ error: "Forbidden" });
            const items = await servicePoolRepository.listGmAccountsNotInServicePool();
            res.json({ items });
        } catch (err) {
            console.error("Error fetching GM accounts not in service pool:", err);
            res.status(500).json({ error: "Failed to fetch GM accounts not in service pool" });
        }
    });

    // Assign a GM-sourced company (surfaced above) to a Service Person,
    // pulling it into the pool for the first time.
    router.post("/service-pool/gm-not-in-pool/assign", async (req, res) => {
        try {
            if (!req.user) return res.status(401).json({ error: "Not authenticated" });
            const roleForScoping = (req.user as any).activeRoleId || req.user.roleId;
            if (!isManagerialRole(roleForScoping)) return res.status(403).json({ error: "Forbidden" });
            const { customerId, servicePersonId, note } = req.body || {};
            if (!customerId || !servicePersonId) {
                return res.status(400).json({ error: "customerId and servicePersonId are required." });
            }
            const result = await servicePoolRepository.assignGmAccountToPool(customerId, servicePersonId, note, req.user.userId);
            res.json({ success: true, id: result.id });
        } catch (err) {
            console.error("Error assigning GM account to service pool:", err);
            res.status(500).json({ error: "Failed to assign GM account to service pool" });
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
