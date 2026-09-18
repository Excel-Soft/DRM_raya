import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { services, serviceSubservices } from "../../shared/schema";

// Seeds the real production "Service for Quotation" catalogue (level 1 +
// level 2 only — the legacy data this comes from never had a 3rd level;
// level 3 is available for manual entry via the new Add UI once this is
// seeded). The rows below are copied verbatim from
// backend/src/server/scripts/full-spreadsheet-migration.ts, which already
// carries the real numbers (price/discount/min-max days/legacy dep id) but
// attaches every row to whichever `services` row happens to be oldest —
// this script instead groups them correctly using the same mainId===0
// (top-level) vs mainId!==0 (child, linked by legacy id) logic already
// established in backend/src/server/db/migrate_services.ts.
//
// [legacyId, mainId, name, detail, price, discount, minDay, maxDay, depId]
const rawData: Array<[number, number, string, string, number | null, number | null, number | null, number | null, number | null]> = [
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
  [78, 0, "Etsy Store Creation or Posting", "", null, null, 30, 45, 10],
  [79, 78, "Etsy Basic Store Setup (Without Products Upload)", "Etsy account + Store setup<br/>Logo/Banner basic design", 50, 0, 30, 45, 10],
  [80, 78, "Etsy Standard Package (With Product Listing)", "Store Setup + Branding<br/>", 80, 0, 30, 45, 10],
  [81, 78, "Etsy Premium / Complete Automation Package", "Full Store Setup<br/>", 200, 0, 30, 45, 10],
  [82, 0, "Social Media Account Handling", "Setup and Branding<br/>", 200, 0, 30, 45, 8],
  [83, 0, "Alibaba VA", "", null, null, null, null, 9],
  [84, 83, "AliBaba VA with RFQs", "Product Posting Services (200 posts per month)", 50000, 10, 30, 45, 10],
  [85, 83, "AliBaba VA without RFQs", "Product Posting Services (200 posts per month)", 35000, 15, 30, 45, 10],
  [86, 5, "Domain test", "this is test domain for testing the main account", 10, 1, 5, 10, 13],
  [87, 28, "test with other department", "testing", 12, 2, 2, 5, 5],
  [88, 0, "Xlserp - Free Website", "", 90, 0, 30, 45, 10],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const oldToNewId = new Map<number, string>();
  const topLevel = rawData.filter((r) => r[1] === 0);
  const children = rawData.filter((r) => r[1] !== 0);

  let servicesInserted = 0;
  for (const [legacyId, , name, detail, price, discount, minDay, maxDay, depId] of topLevel) {
    const code = `LEGACY_SVC_${legacyId}`;
    const result = await db
      .insert(services)
      .values({
        code,
        name,
        description: detail || null,
        price: price != null ? String(price) : null,
        discount: discount != null ? String(discount) : null,
        minDay,
        maxDay,
        depId,
      })
      .onConflictDoUpdate({
        target: services.code,
        set: {
          name,
          description: detail || null,
          price: price != null ? String(price) : null,
          discount: discount != null ? String(discount) : null,
          minDay,
          maxDay,
          depId,
        },
      })
      .returning({ id: services.id });
    if (result[0]) {
      oldToNewId.set(legacyId, result[0].id);
      servicesInserted++;
    }
  }
  console.log(`Seeded ${servicesInserted} top-level services.`);

  let subservicesInserted = 0;
  let skipped = 0;
  for (const [legacyId, mainId, name, detail, price, discount, minDay, maxDay, depId] of children) {
    const parentId = oldToNewId.get(mainId);
    if (!parentId) {
      console.warn(`Skipping "${name}" (legacy id ${legacyId}) — no parent found for legacy main id ${mainId}`);
      skipped++;
      continue;
    }
    const code = `LEGACY_SUB_${legacyId}`;
    await db
      .insert(serviceSubservices)
      .values({
        serviceId: parentId,
        code,
        name,
        description: detail || null,
        price: price != null ? String(price) : null,
        discount: discount != null ? String(discount) : null,
        minDay,
        maxDay,
        depId,
      })
      .onConflictDoUpdate({
        target: serviceSubservices.code,
        set: {
          name,
          description: detail || null,
          price: price != null ? String(price) : null,
          discount: discount != null ? String(discount) : null,
          minDay,
          maxDay,
          depId,
        },
      });
    subservicesInserted++;
  }
  console.log(`Seeded ${subservicesInserted} sub-services (${skipped} skipped for missing parent).`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
