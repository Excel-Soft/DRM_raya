import type { Express, Request, Response } from "express";
import { pool } from "../db";

export function setupDebugRoutes(app: Express) {
  app.get("/api/debug/fakhar", async (req: Request, res: Response) => {
    try {
      const users = await pool.query("SELECT id FROM users WHERE lower(full_name) LIKE '%fakhar%'");
      if (users.rows.length === 0) return res.json({ error: "no fakhar" });
      const userId = users.rows[0].id;
      const leads = await pool.query("SELECT c.id, c.company_name, c.owner_user_id, c.created_at as c_created_at, op.id as op_id, op.stage, op.created_at as op_created_at, op.owner_id as op_owner_id FROM drm.customers c LEFT JOIN drm.opportunities op ON c.id = op.customer_id WHERE c.owner_user_id = $1 OR op.owner_id = $1", [userId]);
      res.json({ fakharId: userId, leads: leads.rows });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
