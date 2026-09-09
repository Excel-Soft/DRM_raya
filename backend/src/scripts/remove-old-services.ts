import { pool } from "../db";

async function run() {
  const client = await pool.connect();
  try {
    const oldCodes = [
      'GGS_DIGITAL', 'BASIC_BASIC_PLUS', 'GGS_PRO', 'STANDARD', 'VERIFIED_SUPPLIER_RC_UP', 'KAP', 'KWA_PSA', 'KWA_KAP', 'CAT', 'AI', 'S_BRAND', 'CHINA_TRIP', 'RFQS', 'ALIBABA_MINISITE', 'ALIBABA_PRODUCT_POSTING', 'ALIBABA_ONLINE_TRAINING', 'ALIBABA_VA', 'VATS', 'BD_RFQ', 'AMS', 'KWA_CM', 'DYNAMIC_WEBSITE', 'ECOMMERCE_STORE', 'SEO', 'LOGO_DESIGN', 'CATALOG_DESIGN', 'BROCHURE_DESIGN', 'SOFTWARE_DEVELOPMENT', 'VIDEO_DOCUMENTARY', 'SOLE_PROPRIETOR_COMPANY', 'PARTNERSHIP_COMPANY', 'ETSY_STORE_CREATION_OR_POSTING', 'SOCIAL_MEDIA_ACCOUNT_HANDLING', 'EBAY_STORE_DESIGN', 'AMAZON_STORE_DESIGN', 'SHOPIFY_STORE_DESIGN', 'EBAY_PER_PRODUCT_POSTING', 'PRODUCT_PHOTOSHOOT', 'LISTING_PAGE_DESIGN', 'ANDROID_APP_IOS', 'WELC_TRAINING', 'VM_VIDEO', 'DOMAIN_REGISTRATION', 'HOSTING', 'SSL', 'CLOUD_VPS_PRO', 'CLOUD_VPS_BUS'
    ];
    
    await client.query(`UPDATE drm.service_subservices SET is_active = false WHERE code = ANY($1::text[])`, [oldCodes]);
    console.log("Deactivated old services.");
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
