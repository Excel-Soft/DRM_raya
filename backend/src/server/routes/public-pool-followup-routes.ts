import { type Express } from "express";
import { pool } from "../db";

export function registerPublicPoolFollowupRoutes(app: Express) {
  // Hardcoded sub-services exactly as they were in the legacy system
  const subServicesMap: Record<string, string[]> = {
    "1": [
      "GGS Digital", "Basic Package", "Basic Plus Package", "GGS Pro", "Standard",
      "Verified Supplier Rc-Up", "Verified Supplier Package", "KAP", "Kwa Psa",
      "KWA-KAP", "Cat", "Ai", "S-Brand", "China Trip", "RFQs", "2 Year VM Package",
      "DigiSME Verified Package", "DigiSME Plus Package", "DigiSME Basic Package",
    ],
    "2": [
      "Alibaba Minisite", "Alibaba Product Posting", "Alibaba online training",
      "Alibaba VA", "VATS", "BD/ RFQ", "AMS", "KWA-CM", "Sole Proprietor Company",
    ],
    "3": [
      "Dynamic Website", "Xlserp - Free Website", "Xlserp - Basic", "Basic Dynamic Website",
      "Professional Dynamic Website", "Enterprise Dynamic Website", "E-Commerce Store",
      "SEO", "Logo Design", "Catalog Design", "Brochure Design", "Software Development",
      "Video Documentary", "Sole Proprietor Company", "Partnership Company",
      "Etsy Store Creation or Posting", "Social Media Account Handling", "EBay Store Design",
      "Amazon Store Design", "Shopify Store", "Ebay per Product Posting", "Product photoshoot",
      "Listing Page", "Android App", "IOS App", "Welc Training", "VM Video",
    ],
    "4": [
      "Domain Registration", "1 Year", "country Base Domain", "On Request (Custom Price)",
      "Pk Domain (2 Years)", "Hosting Plan", "Aluminum Hosting Plan", "Copper Hosting Plan",
      "Silver Hosting Plan", "Gold Hosting Plan", "Diamond Hosting Plan", "Platinum Hosting Plan",
      "SSL Certificate", "Cloud Vps Professional", "Cloud Vps Business",
    ],
    "5": [
      "AI RAG ChatBot", "AI Leader Pro", "AI Websites Build", "AI Desingerly", "AI Cloud CRM",
      "My Leads Agent", "Ai Social Hubs", "AI Power Email", "AI SEO Agent", "eChamber.pk",
    ],
  };

  const mainServiceNames: Record<string, string> = {
    "1": "Alibaba Membership",
    "2": "Alibaba Services",
    "3": "Design Development",
    "4": "Domain Hosting",
    "5": "AI Services",
  };

  const getExcludedBaseQuery = `
    SELECT customer_id::text FROM drm.quotations WHERE created_at >= NOW() - INTERVAL '60 days'
    UNION
    SELECT customer_id::text FROM drm.invoices WHERE created_at >= NOW() - INTERVAL '60 days'
  `;

  // 1. GET /api/sales/public-pool-followup/main-services
  app.get("/api/sales/public-pool-followup/main-services", async (req, res) => {
    try {
      // Get total customers
      const totalRes = await pool.query("SELECT COUNT(*) as count FROM drm.customers");
      const totalCompanies = parseInt(totalRes.rows[0].count, 10);

      // Get base excluded
      const excludedBaseRes = await pool.query(getExcludedBaseQuery);
      const excludedBaseIds = new Set(excludedBaseRes.rows.map(r => r.customer_id));

      const result: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

      for (const [id, name] of Object.entries(mainServiceNames)) {
        // Exclude those with follow-ups for this main service category
        const excludedThis = new Set(excludedBaseIds);
        const followupRes = await pool.query(`
          SELECT DISTINCT customer_id 
          FROM drm.lead_activities 
          WHERE created_at >= NOW() - INTERVAL '60 days' 
            AND meta->>'service_for' ILIKE $1
        `, [`%${name}%`]); // Legacy matched service_for like %name%

        for (const row of followupRes.rows) {
          excludedThis.add(row.customer_id);
        }

        result[id] = totalCompanies - excludedThis.size;
      }

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching main-services counts:", err);
      res.status(500).json({ error: "Failed to fetch counts" });
    }
  });

  // 2. GET /api/sales/public-pool-followup/sub-services
  app.get("/api/sales/public-pool-followup/sub-services", async (req, res) => {
    try {
      const mainServiceId = req.query.mainServiceId as string;
      if (!mainServiceId || !subServicesMap[mainServiceId]) {
        return res.status(400).json({ error: "Invalid mainServiceId" });
      }

      const subServices = subServicesMap[mainServiceId];
      const countsMap: Record<string, number> = {};
      subServices.forEach(s => (countsMap[s.toLowerCase()] = 0));

      const totalRes = await pool.query("SELECT COUNT(*) as count FROM drm.customers");
      const totalCompanies = parseInt(totalRes.rows[0].count, 10);

      const excludedBaseRes = await pool.query(getExcludedBaseQuery);
      const excludedBaseIds = new Set(excludedBaseRes.rows.map(r => r.customer_id));

      // Fetch followups for all sub-services of this main service type in one go
      const followupRes = await pool.query(`
        SELECT customer_id, meta->>'service_type' as service_type
        FROM drm.lead_activities
        WHERE created_at >= NOW() - INTERVAL '60 days'
          AND meta->>'service_type' IS NOT NULL
      `);

      const subExclusions: Record<string, Set<string>> = {};
      for (const row of followupRes.rows) {
        const type = (row.service_type || "").toLowerCase().trim();
        if (!subExclusions[type]) subExclusions[type] = new Set();
        subExclusions[type].add(row.customer_id);
      }

      for (const sub of subServices) {
        const type = sub.toLowerCase().trim();
        const excludedThis = new Set(excludedBaseIds);
        if (subExclusions[type]) {
          for (const id of subExclusions[type]) {
            excludedThis.add(id);
          }
        }
        countsMap[type] = totalCompanies - excludedThis.size;
      }

      const result = subServices.map(sub => ({
        name: sub,
        count: countsMap[sub.toLowerCase()] || 0,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching sub-services counts:", err);
      res.status(500).json({ error: "Failed to fetch sub-services counts" });
    }
  });

  // 3. GET /api/sales/public-pool-followup/customers
  app.get("/api/sales/public-pool-followup/customers", async (req, res) => {
    try {
      const subService = (req.query.subService as string) || "";
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      if (!subService) {
        return res.status(400).json({ error: "subService is required" });
      }

      const query = `
        SELECT 
          c.id, c.drm_id as com_id, c.company_name as cname, c.account_name, 
          c.email, c.phone, u.name as assigned_to
        FROM drm.customers c
        LEFT JOIN drm.users u ON c.owner_user_id = u.id
        WHERE NOT EXISTS (
            SELECT 1 FROM drm.lead_activities la
            WHERE la.customer_id = c.id
              AND la.meta->>'service_type' = $1
              AND la.created_at >= NOW() - INTERVAL '60 days'
        )
        AND NOT EXISTS (
            SELECT 1 FROM drm.quotations q 
            WHERE q.customer_id = c.id::text AND q.created_at >= NOW() - INTERVAL '60 days'
        )
        AND NOT EXISTS (
            SELECT 1 FROM drm.invoices i 
            WHERE i.customer_id = c.id AND i.created_at >= NOW() - INTERVAL '60 days'
        )
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [subService, pageSize + 1, offset]);
      
      const hasNextPage = result.rows.length > pageSize;
      const data = hasNextPage ? result.rows.slice(0, pageSize) : result.rows;

      res.json({
        data,
        hasNextPage,
      });
    } catch (err: any) {
      console.error("Error fetching customers for follow-up:", err);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });
}
