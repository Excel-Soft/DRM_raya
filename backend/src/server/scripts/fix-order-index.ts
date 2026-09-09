import { pool } from "./db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Add order_index column
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS order_index integer`);
    
    // 2. The exact ordered items
    const newItems = [
      "Domain Registration",
      "1 Year",
      "country Base Domain",
      "On Request (Custom Price)",
      "Pk Domain (2 Years)",
      "Hosting Plan",
      "Aluminum Hosting Plan",
      "Copper Hosting Plan",
      "Silver Hosting Plan",
      "Gold Hosting Plan",
      "Diamond Hosting Plan",
      "Platinum Hosting Plan",
      "Alibaba Membership",
      "Alibaba Membership Standard Plan",
      "Alibaba Membership Premium Plan",
      "EBay Store Design",
      "Amazon Store Design",
      "Dynamic Website",
      "Basic Dynamic Website",
      "Professional Dynamic Website",
      "Enterprise Dynamic Website",
      "E-Commerce Store",
      "SEO Old",
      "SEO",
      "Alibaba Minisite",
      "Logo Design",
      "Catalog Design",
      "SMO",
      "Ebay per Product Posting",
      "Alibaba Product Posting",
      "Product photoshoot",
      "SSL Certificate",
      "Listing Page",
      "Alibaba Basic Plus Membership",
      "Alibaba online training",
      "Android App",
      "Shopify Store",
      "Welc",
      "VM Video",
      "Brochure",
      "Bronze",
      "SMM Silver",
      "Cloud Vps Professional",
      "Cloud Vps Business",
      "Software Development",
      "VAT",
      "Video Editing",
      "Sole Proprieter Company",
      "Partnership Company",
      "Etsy Store Creation or Posting",
      "Etsy Basic Store Setup (Without Products Upload)",
      "Etsy Standard Package (With Product Listing)",
      "Etsy Premium / Complete Automation Package",
      "Social Media Account Handling",
      "Alibaba VA",
      "AliBaba VA with RFQs",
      "AliBaba VA without RFQs",
      "Domain test",
      "test with other department",
      "Xlserp - Free Website"
    ];
    
    // 3. Update order_index for each
    for (let i = 0; i < newItems.length; i++) {
        await client.query(
            "UPDATE drm.service_subservices SET order_index = $1 WHERE name = $2 AND is_active = true",
            [i, newItems[i]]
        );
    }

    await client.query("COMMIT");
    console.log("Order index updated successfully.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
