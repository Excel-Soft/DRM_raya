import type { Express } from "express";
import { authMiddleware } from "./auth.middleware";

export function registerFormRoutes(app: Express) {
    // Auth is enforced globally
    app.use("/api/forms", authMiddleware);

    // POST /api/forms/send-message - Send message for online form
    app.post("/api/forms/send-message", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { message } = req.body;

            // For now, just log and return success
            // In production, you'd process the form message and return a response
            console.log("[Form Message]", {
                message,
                userId: req.user.userId,
            });

            res.json({
                success: true,
                response: "Form message received. How can I help you?"
            });
        } catch (error) {
            console.error("Error sending form message:", error);
            res.status(500).json({ error: "Failed to send message" });
        }
    });
}
