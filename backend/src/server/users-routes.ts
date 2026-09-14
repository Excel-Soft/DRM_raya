import { Router } from "express";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq, or, and, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const allUsers = await db.select({
            id: users.id,
            userId: users.id, // For backward compatibility with frontend code
            name: users.name,
            fullName: users.fullName,
            email: users.email,
            roleId: users.roleId,
            role: users.role,
        }).from(users);
        res.json(allUsers);
    } catch (e) {
        console.error("Error fetching users:", e);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

export default router;
