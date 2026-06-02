
import { Router } from "express";
import { db } from "./db";
import { attributes } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// GET /api/attributes/:category
router.get("/attributes/:category", async (req, res) => {
    try {
        const { category } = req.params;
        const entries = await db
            .select()
            .from(attributes)
            .where(eq(attributes.category, category))
            .orderBy(desc(attributes.createdAt));

        res.json(entries);
    } catch (error) {
        console.error("Error fetching attributes:", error);
        res.status(500).json({ error: "Failed to fetch attributes" });
    }
});

// POST /api/attributes
router.post("/attributes", async (req, res) => {
    try {
        const { category, name } = req.body;

        if (!category || !name) {
            return res.status(400).json({ error: "Category and Name are required" });
        }

        const [newEntry] = await db
            .insert(attributes)
            .values({ category, name })
            .returning();

        res.status(201).json(newEntry);
    } catch (error) {
        console.error("Error creating attribute:", error);
        res.status(500).json({ error: "Failed to create attribute" });
    }
});

// DELETE /api/attributes/:id
router.delete("/attributes/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await db.delete(attributes).where(eq(attributes.id, id));

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting attribute:", error);
        res.status(500).json({ error: "Failed to delete attribute" });
    }
});

export default router;
