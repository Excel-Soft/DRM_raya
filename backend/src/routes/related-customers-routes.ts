import { Router } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import { desc } from "drizzle-orm";

const router = Router();

// Schema for related customers - stored in a simple table
const relatedCustomerSchema = z.object({
    customerName: z.string().min(1, "Customer name is required"),
    relatedCustomer: z.string().min(1, "Related customer name is required"),
});

// GET /api/crm/related-customers - List all related customer relationships
router.get("/related-customers", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT id, customer_name as "customerName", related_customer as "relatedCustomer", created_at as "createdAt"
      FROM related_customers
      ORDER BY created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching related customers:", error);
        res.status(500).json({ error: "Failed to fetch related customers" });
    }
});

// POST /api/crm/related-customers - Add a new related customer relationship
router.post("/related-customers", async (req, res) => {
    try {
        const validatedData = relatedCustomerSchema.parse(req.body);

        const result = await pool.query(`
      INSERT INTO related_customers (customer_name, related_customer, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id, customer_name as "customerName", related_customer as "relatedCustomer", created_at as "createdAt"
    `, [validatedData.customerName, validatedData.relatedCustomer]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Invalid request data", details: error.errors });
        }
        console.error("Error creating related customer:", error);
        res.status(500).json({ error: "Failed to create related customer" });
    }
});

// DELETE /api/crm/related-customers/:id - Delete a related customer relationship
router.delete("/related-customers/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
      DELETE FROM related_customers
      WHERE id = $1
      RETURNING id
    `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Related customer not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting related customer:", error);
        res.status(500).json({ error: "Failed to delete related customer" });
    }
});

export default router;
