import { pool } from "../db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Add price column if not exists
    await client.query(`ALTER TABLE drm.services ADD COLUMN IF NOT EXISTS price numeric(10,2)`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS price numeric(10,2)`);
    
    // 2. Deactivate EVERYTHING in service_subservices to clear the list
    await client.query(`UPDATE drm.service_subservices SET is_active = false`);
    
    // 3. Insert the new 60 items
    const newItems = [
      ["Domain Registration", 18],
      ["1 Year", 18],
      ["country Base Domain", 18],
      ["On Request (Custom Price)", 50],
      ["Pk Domain (2 Years)", 36],
      ["Hosting Plan", 0],
      ["Aluminum Hosting Plan", 10],
      ["Copper Hosting Plan", 14],
      ["Silver Hosting Plan", 24],
      ["Gold Hosting Plan", 42],
      ["Diamond Hosting Plan", 59],
      ["Platinum Hosting Plan", 79],
      ["Alibaba Membership", 0],
      ["Alibaba Membership Standard Plan", 2999],
      ["Alibaba Membership Premium Plan", 4999],
      ["EBay Store Design", 249],
      ["Amazon Store Design", 249],
      ["Dynamic Website", 0],
      ["Basic Dynamic Website", 159],
      ["Professional Dynamic Website", 249],
      ["Enterprise Dynamic Website", 319],
      ["E-Commerce Store", 649],
      ["SEO Old", 0],
      ["SEO", 199],
      ["Alibaba Minisite", 199],
      ["Logo Design", 19],
      ["Catalog Design", 0],
      ["SMO", 0],
      ["Ebay per Product Posting", 2.99],
      ["Alibaba Product Posting", 200],
      ["Product photoshoot", 250],
      ["SSL Certificate", 35],
      ["Listing Page", 62],
      ["Alibaba Basic Plus Membership", 1999],
      ["Alibaba online training", 160],
      ["Android App", 250],
      ["Shopify Store", 500],
      ["Welc", 150],
      ["VM Video", 170],
      ["Brochure", 55],
      ["Bronze", 150],
      ["SMM Silver", 250],
      ["Cloud Vps Professional", 250],
      ["Cloud Vps Business", 450],
      ["Software Development", 1000],
      ["VAT", 90],
      ["Video Editing", 100],
      ["Sole Proprieter Company", 55],
      ["Partnership Company", 90],
      ["Etsy Store Creation or Posting", null],
      ["Etsy Basic Store Setup (Without Products Upload)", 50],
      ["Etsy Standard Package (With Product Listing)", 80],
      ["Etsy Premium / Complete Automation Package", 200],
      ["Social Media Account Handling", 200],
      ["Alibaba VA", null],
      ["AliBaba VA with RFQs", 50000],
      ["AliBaba VA without RFQs", 35000],
      ["Domain test", 10],
      ["test with other department", 12],
      ["Xlserp - Free Website", 90]
    ];
    
    // Find a service_id to attach them to. 
    const res = await client.query("SELECT id FROM drm.services ORDER BY created_at ASC LIMIT 1");
    const serviceId = res.rows[0].id;

    for (let i = 0; i < newItems.length; i++) {
        const [name, price] = newItems[i];
        const code = "NEW_PROD_" + i + "_" + Date.now();
        await client.query(
            "INSERT INTO drm.service_subservices (service_id, code, name, is_active, price) VALUES ($1, $2, $3, true, $4)",
            [serviceId, code, name, price]
        );
    }

    await client.query("COMMIT");
    console.log("Done adding new items with prices.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
