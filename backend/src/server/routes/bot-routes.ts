import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";

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

    // POST /api/bot/send-message - Send message to bot
    app.post("/api/bot/send-message", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { message } = req.body;

            // For now, just log and return success
            // In production, you'd process the message and return a bot response
            console.log("[Bot Message]", {
                message,
                userId: req.user.userId,
            });

            res.json({
                success: true,
                response: "Message received. How can I help you?"
            });
        } catch (error) {
            console.error("Error sending bot message:", error);
            res.status(500).json({ error: "Failed to send message" });
        }
    });
}
