import { pool } from "./db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE drm.service_subservices SET name = '1 Year', description = '.com / .net / .org' WHERE code = 'DOMAIN_REG_1Y_COM_NET';
      UPDATE drm.service_subservices SET name = 'country Base', description = '.co.uk / .org.uk / etc' WHERE code = 'DOMAIN_REG_COUNTRY';
      UPDATE drm.service_subservices SET name = 'On Request', description = 'Any ccTLD' WHERE code = 'DOMAIN_REG_ANY_CCTLD';
      UPDATE drm.service_subservices SET name = 'Pk Domain', description = '.pk / .com.pk' WHERE code = 'DOMAIN_REG_PK';
      
      UPDATE drm.service_subservices SET name = 'Aluminum', description = 'Disk' WHERE code = 'HOSTING_ALUMINUM';
      UPDATE drm.service_subservices SET name = 'Copper Host', description = 'Disk' WHERE code = 'HOSTING_COPPER';
      UPDATE drm.service_subservices SET name = 'Silver Host', description = 'Disk' WHERE code = 'HOSTING_SILVER';
      UPDATE drm.service_subservices SET name = 'Gold Hosting', description = 'Disk' WHERE code = 'HOSTING_GOLD';
      UPDATE drm.service_subservices SET name = 'Diamond Host', description = 'Disk' WHERE code = 'HOSTING_DIAMOND';
      UPDATE drm.service_subservices SET name = 'Platinum Host', description = 'Disk' WHERE code = 'HOSTING_PLATINUM';
      
      UPDATE drm.service_subservices SET name = 'Alibaba Membership', description = 'Priority:' WHERE code = 'ALIBABA_MEMBERSHIP_PRIORITY';
      
      UPDATE drm.service_subservices SET name = 'Basic Dynamic', description = 'Domain' WHERE code = 'DYN_WEB_BASIC';
      UPDATE drm.service_subservices SET name = 'Professional', description = 'Domain' WHERE code = 'DYN_WEB_PRO';
      UPDATE drm.service_subservices SET name = 'Enterprise', description = 'Domain' WHERE code = 'DYN_WEB_ENT';
      UPDATE drm.service_subservices SET name = 'E-Commerce', description = 'Store/web' WHERE code = 'DYN_WEB_ECOMM';
      
      UPDATE drm.service_subservices SET name = 'Alibaba Minisite', description = 'Graphically' WHERE code = 'ALIBABA_MINISITE_GRAPHICAL';
      UPDATE drm.service_subservices SET name = 'Logo Design', description = 'Custom Logo' WHERE code = 'LOGO_DESIGN_CUSTOM';
      
      UPDATE drm.service_subservices SET name = 'Ebay per Product', description = 'product posting' WHERE code = 'EBAY_POSTING';
      UPDATE drm.service_subservices SET name = 'Alibaba Product', description = 'product posting' WHERE code = 'ALIBABA_POSTING';
      
      UPDATE drm.service_subservices SET name = 'Listing Page', description = 'One Listing' WHERE code = 'LISTING_PAGE_ONE';
      UPDATE drm.service_subservices SET name = 'Alibaba Banner', description = 'ShowCase' WHERE code = 'ALIBABA_BANNER_SHOWCASE';
      UPDATE drm.service_subservices SET name = 'Alibaba on Page SEO', description = 'Alibaba on page' WHERE code = 'ALIBABA_ON_PAGE_SEO';
      UPDATE drm.service_subservices SET name = 'Android App', description = 'Convert' WHERE code = 'ANDROID_APP_CONVERT';
      UPDATE drm.service_subservices SET name = 'Shopify Store', description = 'Store will' WHERE code = 'SHOPIFY_STORE_WILL';
      UPDATE drm.service_subservices SET name = 'Welc', description = 'Welc training' WHERE code = 'WELC_TRAIN';
      
      UPDATE drm.service_subservices SET name = 'Cloud Vps', description = 'Domain' WHERE code = 'CLOUD_VPS_DOMAIN_1';
      UPDATE drm.service_subservices SET name = 'Cloud Vps 2', description = 'Domain' WHERE code = 'CLOUD_VPS_DOMAIN_2';
      
      UPDATE drm.service_subservices SET name = 'VAT', description = 'Product Po' WHERE code = 'VAT_PRODUCT_PO';
      
      UPDATE drm.service_subservices SET name = 'Etsy Basic', description = 'Etsy account' WHERE code = 'ETSY_BASIC_ACC';
      UPDATE drm.service_subservices SET name = 'Etsy Stand', description = 'Store' WHERE code = 'ETSY_STAND_STORE';
      UPDATE drm.service_subservices SET name = 'Etsy Premi', description = 'Full Store' WHERE code = 'ETSY_PREMI_FULL';
      UPDATE drm.service_subservices SET name = 'Social Media', description = 'Setup and' WHERE code = 'SOCIAL_MEC_SETUP';
      
      UPDATE drm.service_subservices SET name = 'AliBaba VA Product', description = 'Product' WHERE code = 'ALIBABA_VA_PRODUCT';
      
      UPDATE drm.service_subservices SET name = 'Domain test', description = 'this is test' WHERE code = 'DOMAIN_TEST';
      UPDATE drm.service_subservices SET name = 'test with c', description = 'testing' WHERE code = 'TEST_WITH_C';
    `);
    console.log("Fixed names and descriptions.");
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
