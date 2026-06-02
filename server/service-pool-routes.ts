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

    app.use("/api/sales", router);
}

export default registerServicePoolRoutes;
