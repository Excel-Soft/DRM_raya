import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool } from "../db";
import { handleDrmSystemBotMessage, type BotApiCaller } from "../services/drm-system-bot.service";

export function registerBotRoutes(app: Express) {
    // Auth is enforced globally
    app.use("/api/bot", authMiddleware);

    // GET /api/bot/department-stats - Get department statistics
    app.get("/api/bot/department-stats", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            // For now, return empty stats
            // In production, you'd query the database for actual stats
            res.json({});
        } catch (error) {
            console.error("Error fetching bot department stats:", error);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    });

    // POST /api/bot/department-assignment - Save department assignment
    app.post("/api/bot/department-assignment", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { department, assign, ratio } = req.body;

            // For now, just log and return success
            // In production, you'd save this to a database table
            console.log("[Bot Department Assignment]", {
                department,
                assign,
                ratio,
                userId: req.user.userId,
            });

            res.json({ success: true, data: req.body });
        } catch (error) {
            console.error("Error saving bot department assignment:", error);
            res.status(500).json({ error: "Failed to save assignment" });
        }
    });

    // POST /api/bot/send-message - DRM system bot (legacy command parser)
    app.post("/api/bot/send-message", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const message = typeof req.body?.message === "string" ? req.body.message : "";
            // Menu commands fetch the page's own API as this user (same token and role),
            // so the bot never shows data the user could not open on the page itself.
            const port = process.env.PORT || "5001";
            const callApi: BotApiCaller = async (path) => {
                const headers: Record<string, string> = {};
                if (req.headers.authorization) headers.authorization = String(req.headers.authorization);
                for (const h of ["x-acting-role", "x-forwarded-for", "x-real-ip", "user-agent"]) {
                    if (req.headers[h]) headers[h] = String(req.headers[h]);
                }
                const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers, signal: AbortSignal.timeout(20000) });
                const body = await r.json().catch(() => null);
                return { status: r.status, body };
            };
            const { response, format } = await handleDrmSystemBotMessage(
                pool,
                message,
                (req.user as { userId?: string }).userId,
                callApi,
            );

            res.json({
                success: true,
                response,
                format: format || "text",
            });
        } catch (error) {
            console.error("Error sending bot message:", error);
            res.status(500).json({ error: "Failed to send message" });
        }
    });
}
