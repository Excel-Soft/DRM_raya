import { pool } from "../server/db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Add new columns to service_subservices
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS legacy_id integer`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS legacy_main_id integer`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS discount numeric(10,2)`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS min_day integer`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS max_day integer`);
    await client.query(`ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS dep_id integer`);

    // Deactivate everything in service_subservices to clear
    await client.query(`UPDATE drm.service_subservices SET is_active = false`);

    const rawData = [
        [5, 0, "Domain Registration", "", 18, 0, null, null, 13],
        [6, 5, "1 Year", ".com / .net / .org / .biz / .info / .us", 18, 0, null, null, 13],
        [8, 5, "country Base Domain", ".co.uk / .org.uk / .me.uk", 18, 0, null, null, 13],
        [9, 5, "On Request (Custom Price)", "Any ccTLd Domain / .eu / .es / .de / .ca / .dk / .nl / .it / .ch / .ae / .be / etc.", 50, 0, null, null, 13],
        [10, 5, "Pk Domain (2 Years)", ".pk / .com.pk / .net.pk / .org.pk / .edu.pk / .web.pk / .biz.pk", 36, 0, null, null, 13],
        [28, 0, "Hosting Plan", "", 0, 0, 0, 0, 13],
        [29, 28, "Aluminum Hosting Plan", "Disk Space: 50MB<br/>", 10, 0, 1, 2, 13],
        [30, 28, "Copper Hosting Plan", "Disk Space: 100MB<br/>", 14, 0, 1, 2, 13],
        [31, 28, "Silver Hosting Plan", "Disk Space: 250MB<br/>", 24, 0, 1, 2, 13],
        [32, 28, "Gold Hosting Plan", "Disk Space: 500MB<br/>", 42, 0, 1, 2, 13],
        [33, 28, "Diamond Hosting Plan", "Disk Space: 1GB<br/>", 59, 0, 1, 2, 13],
        [34, 28, "Platinum Hosting Plan", "Disk Space: Unlimited<br/>", 79, 0, 1, 2, 13],
        [35, 0, "Alibaba Membership", "", 0, 0, 0, 0, null],
        [37, 35, "Alibaba Membership Standard Plan", "Priority: 2nd <br/>", 2999, 0, 3, 7, null],
        [38, 35, "Alibaba Membership Premium Plan", "Priority: 1st<br/>", 4999, 0, 3, 7, null],
        [39, 0, "EBay Store Design", "Complete professional custom eBay store shop design and installation +", 249, 0, 20, 25, 10],
        [40, 0, "Amazon Store Design", "Complete professional custom Amazon store design and installation +", 249, 0, 20, 25, 10],
        [41, 0, "Dynamic Website", "", 0, 0, 0, 0, 10],
        [42, 41, "Basic Dynamic Website", "Domain Name (yourdomain.com): Yes<br/>", 159, 0, 15, 20, 10],
        [43, 41, "Professional Dynamic Website", "Domain Name (yourdomain.com): Yes<br/>", 249, 0, 18, 22, 10],
        [44, 41, "Enterprise Dynamic Website", "Domain Name (yourdomain.com): Yes<br/>", 319, 0, 20, 25, 10],
        [45, 0, "E-Commerce Store", "Store/website Design will be Mobile Responsive<br/>", 649, 0, 20, 25, 10],
        [46, 0, "SEO Old", "", 0, 0, 0, 0, null],
        [47, 0, "SEO", "Targeted Keywords<br/>", 199, 0, 30, 45, 8],
        [48, 0, "Alibaba Minisite", "Graphically Rich Title Page theme designing<br/>", 199, 0, 5, 8, 10],
        [49, 0, "Logo Design", "Custom Logo design", 19, 0, 0, 0, 10],
        [50, 0, "Catalog Design", "", 0, 0, 0, 0, 10],
        [51, 0, "SMO", "", 0, 0, 0, 0, null],
        [53, 0, "Ebay per Product Posting", "", 2.99, 0, 0, 0, 9],
        [54, 0, "Alibaba Product Posting", "product posting 200 per month", 200, 0, 15, 18, 9],
        [55, 0, "Product photoshoot", "", 250, 0, 0, 0, 10],
        [56, 0, "SSL Certificate", "SSL certificate", 35, 0, 0, 0, 13],
        [57, 0, "Listing Page", "One Listing Page", 62, 0, 2, 3, 10],
        [58, 35, "Alibaba Basic Plus Membership", "ShowCase : 20 <br/>", 1999, 0, 3, 7, 9],
        [59, 0, "Alibaba online training", "Alibaba online training", 160, 0, 1, 7, null],
        [62, 0, "Android App", "Convert Website Into Android App<br/>Registration play store <br/>", 250, 0, 10, 15, 10],
        [63, 0, "Shopify Store", "Store will be Mobile Responsive<br/>", 500, 0, 25, 30, 10],
        [64, 0, "Welc", "Welc training", 150, 0, 30, 60, null],
        [65, 0, "VM Video", "", 170, 85, 5, 8, null],
        [66, 0, "Brochure", "", 55, 3, 3, 5, 10],
        [67, 0, "Bronze", "Page setup and management", 150, 0, 30, 35, 10],
        [68, 0, "SMM Silver", "Page setup and management", 250, 0, 30, 45, 10],
        [69, 0, "Cloud Vps Professional", "Domain (yourdomain.com) <br/>", 250, 0, 3, 5, 13],
        [70, 0, "Cloud Vps Business", "Domain (yourdomain.com) <br/>", 450, 0, 3, 5, 13],
        [71, 0, "Software Development", "", 1000, 50, 20, 30, 27],
        [72, 0, "VAT", "Product Posting , Product  Optimization, Rfq template", 90, 0, 30, 40, 9],
        [73, 0, "Video Editing", "", 100, 0, 5, 15, 24],
        [74, 0, "Sole Proprieter Company", "", 55, 0, 7, 10, 2],
        [75, 0, "Partnership Company", "", 90, 0, 7, 10, 2],
        [78, 0, "Etsy Store Creation or Posting", "NULL", null, null, 30, 45, 10],
        [79, 78, "Etsy Basic Store Setup (Without Products Upload)", "Etsy account + Store setup<br/>Logo/Banner basic design", 50, 0, 30, 45, 10],
        [80, 78, "Etsy Standard Package (With Product Listing)", "Store Setup + Branding<br/>", 80, 0, 30, 45, 10],
        [81, 78, "Etsy Premium / Complete Automation Package", "Full Store Setup<br/>", 200, 0, 30, 45, 10],
        [82, 0, "Social Media Account Handling", "Setup and Branding<br/>", 200, 0, 30, 45, 8],
        [83, 0, "Alibaba VA", "NULL", null, null, null, null, 9],
        [84, 83, "AliBaba VA with RFQs", "Product Posting Services (200 posts per month)", 50000, 10, 30, 45, 10],
        [85, 83, "AliBaba VA without RFQs", "Product Posting Services (200 posts per month)", 35000, 15, 30, 45, 10],
        [86, 5, "Domain test", "this is test domain for testing the main account", 10, 1, 5, 10, 13],
        [87, 28, "test with other department", "testing", 12, 2, 2, 5, 5],
        [88, 0, "Xlserp - Free Website", "NULL", 90, 0, 30, 45, 10]
    ];

    // Get a valid parent service_id
    const res = await client.query("SELECT id FROM drm.services ORDER BY created_at ASC LIMIT 1");
    const serviceId = res.rows[0].id;

    for (let i = 0; i < rawData.length; i++) {
        const [id, main_id, name, detail, price, discount, min_day, max_day, dep_id] = rawData[i];
        const code = "EXCEL_PROD_" + id;
        
        await client.query(
            `INSERT INTO drm.service_subservices 
            (service_id, code, name, description, price, order_index, is_active, legacy_id, legacy_main_id, discount, min_day, max_day, dep_id) 
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12)`,
            [serviceId, code, name, detail, price, i, id, main_id, discount, min_day, max_day, dep_id]
        );
    }

    await client.query("COMMIT");
    console.log("Full spreadsheet migration complete.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
