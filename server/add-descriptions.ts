import { pool } from "./db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const details = [
        "",
        ".com / .net / .org / .biz / .info / .us",
        ".co.uk / .org.uk / .me.uk",
        "Any ccTLd Domain / .eu / .es / .de / .ca / .dk / .nl / .it / .ch / .ae / .be / etc.",
        ".pk / .com.pk / .net.pk / .org.pk / .edu.pk / .web.pk / .biz.pk",
        "",
        "Disk Space: 50MB<br/>",
        "Disk Space: 100MB<br/>",
        "Disk Space: 250MB<br/>",
        "Disk Space: 500MB<br/>",
        "Disk Space: 1GB<br/>",
        "Disk Space: Unlimited<br/>",
        "",
        "Priority: 2nd <br/>",
        "Priority: 1st<br/>",
        "Complete professional custom eBay store shop design and installation +",
        "Complete professional custom Amazon store design and installation +",
        "",
        "Domain Name (yourdomain.com): Yes<br/>",
        "Domain Name (yourdomain.com): Yes<br/>",
        "Domain Name (yourdomain.com): Yes<br/>",
        "Store/website Design will be Mobile Responsive<br/>",
        "",
        "Targeted Keywords<br/>",
        "Graphically Rich Title Page theme designing<br/>",
        "Custom Logo design",
        "",
        "",
        "",
        "product posting 200 per month",
        "",
        "SSL certificate",
        "One Listing Page",
        "ShowCase : 20 <br/>",
        "Alibaba online training",
        "Convert Website Into Android App<br/>Registration play store <br/>",
        "Store will be Mobile Responsive<br/>",
        "Welc training",
        "",
        "",
        "Page setup and management",
        "Page setup and management",
        "Domain (yourdomain.com) <br/>",
        "Domain (yourdomain.com) <br/>",
        "",
        "Product Posting , Product  Optimization, Rfq template",
        "",
        "",
        "",
        "NULL",
        "Etsy account + Store setup<br/>Logo/Banner basic design",
        "Store Setup + Branding<br/>",
        "Full Store Setup<br/>",
        "Setup and Branding<br/>",
        "NULL",
        "Product Posting Services (200 posts per month)",
        "Product Posting Services (200 posts per month)",
        "this is test domain for testing the main account",
        "testing",
        "NULL"
    ];

    for (let i = 0; i < details.length; i++) {
        await client.query(
            "UPDATE drm.service_subservices SET description = $1 WHERE order_index = $2 AND is_active = true",
            [details[i], i]
        );
    }

    await client.query("COMMIT");
    console.log("Descriptions updated successfully.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
