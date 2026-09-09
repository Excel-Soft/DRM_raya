import { Router, Request, Response } from "express";
import { poolsRepository, PoolType } from "../repositories/pools.repository";
import { pool } from "../db";
import { isManagerialRole } from "../utils/role-utils";

const router = Router();

router.use((req: Request, res: Response, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userObj = req.user as any;
    const r = (userObj.role || (Array.isArray(userObj.roles) ? userObj.roles.join(" ") : "")).toLowerCase();
    const isManager = r.includes("admin") || r.includes("super_hod") || r.includes("hod") || r.includes("manager") || isManagerialRole(req.user!.roleId);
    const userId = (isManager && req.query.userId) ? (req.query.userId as string) : (isManager ? undefined : req.user!.userId);
    const { type, grade, serviceType, search, limit, offset, status, source } = req.query;
    
    if (!type || !["Private", "Service", "GMBV", "Public"].includes(type as string)) {
      return res.status(400).json({ error: "Valid pool type is required (Private, Service, GMBV, Public)" });
    }
    
    const customers = await poolsRepository.findByPoolType(type as PoolType, {
      userId,
      grade: grade as string,
      serviceType: serviceType as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json(customers);
  } catch (error) {
    console.error("Error fetching pool customers:", error);
    res.status(500).json({ error: "Failed to fetch pool customers" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const isManager = isManagerialRole(req.user!.roleId);
    const userId = (isManager && req.query.userId) ? (req.query.userId as string) : (isManager ? undefined : req.user!.userId);
    const stats = await poolsRepository.getPoolStats(userId as any);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    res.status(500).json({ error: "Failed to fetch pool statistics" });
  }
});

// Summary chips
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const isManager = isManagerialRole(req.user!.roleId);
    const userId = (isManager && req.query.userId) ? (req.query.userId as string) : (isManager ? undefined : req.user!.userId);
    const { rows } = await pool.query(
      `select
         count(*) filter (where status = 'New')::int as yet_to_contact,
         count(*) filter (where status <> 'New')::int as contacted,
         0::int as invoice_sent,
         0::int as whatsapp,
         0::int as email,
         0::int as sms,
         0::int as instagram
       from drm.customers
       where coalesce(is_deleted,false)=false and ($1::text is null or owner_user_id = $1 or pool_type = 'Public')`,
      [userId],
    );
    const chips = rows[0] || {};
    const pools = await poolsRepository.getPoolStats(userId as any);
    return res.json({ chips, pools });
  } catch (error) {
    console.error("Error fetching pool summary:", error);
    res.status(500).json({ error: "Failed to fetch pool summary" });
  }
});

router.get("/expiring", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { days } = req.query;
    const daysAhead = days ? parseInt(days as string) : 7;
    
    const leads = await poolsRepository.getExpiringLeads(userId, daysAhead);
    res.json(leads);
  } catch (error) {
    console.error("Error fetching expiring leads:", error);
    res.status(500).json({ error: "Failed to fetch expiring leads" });
  }
});

router.get("/public/available", async (req: Request, res: Response) => {
  try {
    const leads = await poolsRepository.getReassignablePublicLeads();
    res.json(leads);
  } catch (error) {
    console.error("Error fetching available public leads:", error);
    res.status(500).json({ error: "Failed to fetch available public leads" });
  }
});

router.post("/reassign", async (req: Request, res: Response) => {
  try {
    const { customerId, newOwnerUserId } = req.body;
    
    if (!customerId || !newOwnerUserId) {
      return res.status(400).json({ error: "Customer ID and new owner user ID are required" });
    }
    
    const customer = await poolsRepository.reassign(customerId, newOwnerUserId);
    
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.json(customer);
  } catch (error) {
    console.error("Error reassigning customer:", error);
    res.status(500).json({ error: "Failed to reassign customer" });
  }
});

router.post("/move", async (req: Request, res: Response) => {
  try {
    const { customerId, poolType } = req.body;
    
    if (!customerId || !poolType) {
      return res.status(400).json({ error: "Customer ID and pool type are required" });
    }
    
    if (!["Private", "Service", "GMBV", "Public"].includes(poolType)) {
      return res.status(400).json({ error: "Invalid pool type" });
    }
    
    const customer = await poolsRepository.moveToPool(customerId, poolType as PoolType);
    
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.json(customer);
  } catch (error) {
    console.error("Error moving customer to pool:", error);
    res.status(500).json({ error: "Failed to move customer to pool" });
  }
});

router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    const userId = req.user!.userId;
    
    if (!customerId) {
      return res.status(400).json({ error: "Customer ID is required" });
    }
    
    const customer = await poolsRepository.claimFromPool(customerId, userId);
    
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.json(customer);
  } catch (error) {
    console.error("Error claiming customer from pool:", error);
    res.status(500).json({ error: "Failed to claim customer from pool" });
  }
});

export default router;
