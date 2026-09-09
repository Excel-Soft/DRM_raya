import { Router } from "express";
import { pool } from "../db";
import { portfolios } from "@shared/schema";
import { sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(pool);
const router = Router();

// GET all portfolios
router.get("/", async (req, res) => {
    try {
        const results = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));
        res.json(results);
    } catch (err: any) {
        console.error("Error fetching portfolios:", err);
        res.status(500).json({ success: false, message: "Failed to fetch portfolios" });
    }
});

// POST new portfolio
router.get("/test", (req, res) => res.json({ ok: true }));

router.post("/", async (req, res) => {
    try {
        const { keyword, mainCategory, subCategory, serverLink } = req.body;
        
        // For now, since handling file uploads requires multer which might need configuration,
        // we'll store the text fields. In a real scenario, we'd use multer to handle the FormData.
        const [newPortfolio] = await db.insert(portfolios).values({
            keyword,
            mainCategory,
            subCategory,
            serverLink,
            // Mocking image URLs for now as they are handled via FormData in the frontend
            topHeaderImage: "", 
            bodyImage: "",
            fullImage: "",
            sliders: [],
        }).returning();

        res.json({ success: true, data: newPortfolio });
    } catch (err: any) {
        console.error("Error creating portfolio:", err);
        res.status(500).json({ success: false, message: "Failed to create portfolio" });
    }
});

export default router;
