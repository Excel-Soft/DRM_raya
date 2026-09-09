import { Router } from "express";
import { generateAssistantResponse, type AssistantContext } from "./ai-assistant";
import { z } from "zod";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    currentScreen: z.string(),
    userRole: z.enum(["Sales Executive", "Assistant Manager", "Manager", "HOD", "Admin"]),
    screenData: z.record(z.any()).optional(),
    userName: z.string().optional(),
  }),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

router.post("/chat", async (req, res) => {
  try {
    const validated = chatRequestSchema.parse(req.body);
    
    const response = await generateAssistantResponse(
      validated.context as AssistantContext,
      validated.message,
      validated.conversationHistory || []
    );

    res.json({ 
      success: true, 
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI Chat Error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request format",
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to process your request. Please try again.",
    });
  }
});

export default router;
