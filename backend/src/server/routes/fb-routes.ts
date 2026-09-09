import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";

export function registerFbRoutes(app: Express) {
    // Auth is enforced globally
    app.use("/api/fb", authMiddleware);

    // POST /api/fb/send-message - Send message for FB post
    app.post("/api/fb/send-message", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { message } = req.body;

            // For now, just log and return success
            // In production, you'd process the FB post message and return a response
            console.log("[FB Post Message]", {
                message,
                userId: req.user.userId,
            });

            res.json({
                success: true,
                response: "FB post message received. How can I help you?"
            });
        } catch (error) {
            console.error("Error sending FB post message:", error);
            res.status(500).json({ error: "Failed to send message" });
        }
    });
}
