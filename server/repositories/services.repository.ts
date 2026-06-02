import { db, pool } from "../db";
import { services, followupServices, type Service } from "@shared/schema";
import { asc, eq, inArray } from "drizzle-orm";

let ensured = false;

export async function ensureServicesSchema() {
  if (ensured) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`create extension if not exists "pgcrypto";`);

    await client.query(`
      create table if not exists services (
        id uuid primary key default gen_random_uuid(),
        code text not null unique,
        name text not null,
        is_active boolean not null default true,
        created_at timestamptz not null default now()
      );
    `);
    await client.query(`alter table services alter column id type uuid using id::uuid;`);

    await client.query(`
      create table if not exists followup_services (
        followup_id uuid not null references follow_ups(id) on delete cascade,
        service_id uuid not null references services(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (followup_id, service_id)
      );
    `);
    await client.query(`
      alter table followup_services
        alter column followup_id type uuid using followup_id::uuid,
        alter column service_id type uuid using service_id::uuid;
    `);
    await client.query(`create index if not exists idx_followup_services_followup on followup_services(followup_id);`);
    await client.query(`create index if not exists idx_followup_services_service on followup_services(service_id);`);

    await client.query(`
      insert into services (code, name, is_active)
      values 
        ('ALIBABA_MEMBERSHIP','Alibaba Membership', true),
        ('ALIBABA_SERVICES','Alibaba Services', true),
        ('DESIGN_DEVELOPMENT','Design Development', true),
        ('DOMAIN_HOSTING','Domain Hosting', true)
      on conflict (code) do update set name = excluded.name, is_active = excluded.is_active;
    `);

    await client.query(`
      create table if not exists service_subservices (
        id uuid primary key default gen_random_uuid(),
        service_id uuid not null references services(id) on delete cascade,
        code text not null,
        name text not null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        unique(service_id, code),
        unique(code)
      );
    `);
    
    await client.query(`alter table services add column if not exists description text;`);
    await client.query(`alter table service_subservices add column if not exists description text;`);
    await client.query(`
      alter table service_subservices
        alter column id type uuid using id::uuid,
        alter column service_id type uuid using service_id::uuid;
    `);

    await client.query(`
      create table if not exists followup_subservices (
        followup_id uuid not null references follow_ups(id) on delete cascade,
        subservice_id uuid not null references service_subservices(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (followup_id, subservice_id)
      );
    `);
    await client.query(`
      alter table followup_subservices
        alter column followup_id type uuid using followup_id::uuid,
        alter column subservice_id type uuid using subservice_id::uuid;
    `);
    await client.query(`create index if not exists idx_service_subservices_service on service_subservices(service_id);`);
    await client.query(`create index if not exists idx_followup_subservices_followup on followup_subservices(followup_id);`);

    await client.query(`
        insert into service_subservices (service_id, code, name, is_active, description)
        select s.id, sub_code, sub_name, true, sub_desc
        from (values
          -- Newly added from invoice items list
          ('DOMAIN_HOSTING','DOMAIN_REG_1Y_COM_NET','.com / .net / .org', '1 Year .com / .net / .org'),
          ('DOMAIN_HOSTING','DOMAIN_REG_COUNTRY','.co.uk / .org.uk / etc', 'country Base .co.uk / .org.uk'),
          ('DOMAIN_HOSTING','DOMAIN_REG_ANY_CCTLD','Any ccTLD', 'On Request Any ccTLD'),
          ('DOMAIN_HOSTING','DOMAIN_REG_PK','.pk / .com.pk', 'Pk Domain .pk / .com.pk'),
          
          ('DOMAIN_HOSTING','HOSTING_ALUMINUM','Aluminum Disk', 'Hosting Plan'),
          ('DOMAIN_HOSTING','HOSTING_COPPER','Copper Host Disk', 'Hosting Plan'),
          ('DOMAIN_HOSTING','HOSTING_SILVER','Silver Host Disk', 'Hosting Plan'),
          ('DOMAIN_HOSTING','HOSTING_GOLD','Gold Host Disk', 'Hosting Plan'),
          ('DOMAIN_HOSTING','HOSTING_DIAMOND','Diamond Host Disk', 'Hosting Plan'),
          ('DOMAIN_HOSTING','HOSTING_PLATINUM','Platinum Host Disk', 'Hosting Plan'),
          
          ('ALIBABA_MEMBERSHIP','ALIBABA_MEMBERSHIP_PRIORITY','Alibaba Membership Priority', 'Priority:'),
          
          ('DESIGN_DEVELOPMENT','EBAY_STORE_COMPLETE','EBay Store', 'Complete'),
          ('DESIGN_DEVELOPMENT','AMAZON_STORE_COMPLETE','Amazon Store', 'Complete'),
          
          ('DESIGN_DEVELOPMENT','DYN_WEB_BASIC','Basic Dynamic', 'Domain'),
          ('DESIGN_DEVELOPMENT','DYN_WEB_PRO','Professional', 'Domain'),
          ('DESIGN_DEVELOPMENT','DYN_WEB_ENT','Enterprise', 'Domain'),
          ('DESIGN_DEVELOPMENT','DYN_WEB_ECOMM','E-Commerce', 'Store/web'),
          
          ('DESIGN_DEVELOPMENT','SEO_OLD','SEO Old', ''),
          ('DESIGN_DEVELOPMENT','SEO_TARGETED','SEO', 'Targeted'),
          
          ('ALIBABA_SERVICES','ALIBABA_MINISITE_GRAPHICAL','Alibaba Minisite', 'Graphically'),
          ('DESIGN_DEVELOPMENT','LOGO_DESIGN_CUSTOM','Logo Design', 'Custom Logo'),
          ('DESIGN_DEVELOPMENT','SMO','SMO', ''),
          
          ('DESIGN_DEVELOPMENT','EBAY_POSTING','Ebay per Product', 'product posting'),
          ('ALIBABA_SERVICES','ALIBABA_POSTING','Alibaba Product', 'product posting'),
          
          ('DOMAIN_HOSTING','SSL_CERT','SSL Certificate', 'SSL certificate'),
          ('DESIGN_DEVELOPMENT','LISTING_PAGE_ONE','Listing Page', 'One Listing'),
          ('ALIBABA_SERVICES','ALIBABA_BANNER_SHOWCASE','Alibaba Banner', 'ShowCase'),
          ('ALIBABA_SERVICES','ALIBABA_ON_PAGE_SEO','Alibaba on Page SEO', 'Alibaba on page'),
          ('DESIGN_DEVELOPMENT','ANDROID_APP_CONVERT','Android App', 'Convert'),
          ('DESIGN_DEVELOPMENT','SHOPIFY_STORE_WILL','Shopify Store', 'Store will'),
          ('DESIGN_DEVELOPMENT','WELC_TRAIN','Welc', 'Welc train'),
          ('DESIGN_DEVELOPMENT','BROCHURE','Brochure', ''),
          ('DESIGN_DEVELOPMENT','BRONZE_PAGE','Bronze', 'Page'),
          ('DESIGN_DEVELOPMENT','SMM_SILVER_PAGE','SMM Silver', 'Page'),
          ('DOMAIN_HOSTING','CLOUD_VPS_DOMAIN_1','Cloud Vps', 'Domain'),
          ('DOMAIN_HOSTING','CLOUD_VPS_DOMAIN_2','Cloud Vps 2', 'Domain'),
          ('DESIGN_DEVELOPMENT','SOFTWARE_DEV','Software Development', ''),
          ('ALIBABA_SERVICES','VAT_PRODUCT_PO','VAT', 'Product Po'),
          ('DESIGN_DEVELOPMENT','VIDEO_EDITING','Video Editing', ''),
          ('DESIGN_DEVELOPMENT','SOLE_PROPRIETOR_COMP','Sole Proprieter Company', ''),
          ('DESIGN_DEVELOPMENT','PARTNERSHIP_COMP','Partnership Company', ''),
          ('DESIGN_DEVELOPMENT','ETSY_STORE_NULL','Etsy Store', 'NULL'),
          ('DESIGN_DEVELOPMENT','ETSY_BASIC_ACC','Etsy Basic', 'Etsy account'),
          ('DESIGN_DEVELOPMENT','ETSY_STAND_STORE','Etsy Stand', 'Store'),
          ('DESIGN_DEVELOPMENT','ETSY_PREMI_FULL','Etsy Premi', 'Full Store'),
          ('DESIGN_DEVELOPMENT','SOCIAL_MEC_SETUP','Social Media', 'Setup and'),
          ('ALIBABA_SERVICES','ALIBABA_VA_NULL','Alibaba VA', 'NULL'),
          ('ALIBABA_SERVICES','ALIBABA_VA_PRODUCT','AliBaba VA Product', 'Product'),
          ('DOMAIN_HOSTING','DOMAIN_TEST','Domain test', 'this is test'),
          ('DESIGN_DEVELOPMENT','TEST_WITH_C','test with c', 'testing'),
          ('DESIGN_DEVELOPMENT','XLSERP_FRE','Xlserp - Fre', 'NULL')

        ) as v(service_code, sub_code, sub_name, sub_desc)
        join services s on s.code = v.service_code
      on conflict (service_id, code) do update set
        name = excluded.name,
        is_active = excluded.is_active,
        description = excluded.description;
    `);

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error("Failed ensuring services schema (continuing):", err);
  } finally {
    client.release();
    ensured = true;
  }
}

export const servicesRepository = {
  async listActive(): Promise<Service[]> {
    return db
      .select()
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(asc(services.name));
  },

  async listActiveWithSubservices(): Promise<Array<Service & { subServices: Array<{ id: string; code: string; name: string }> }>> {
    const res = await pool.query(`
      select 
        s.id,
        s.code,
        s.name,
        s.description,
        s.is_active,
        s.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', ss.id,
              'code', ss.code,
              'name', ss.name,
              'description', ss.description,
              'price', ss.price,
              'discount', ss.discount,
              'min_day', ss.min_day,
              'max_day', ss.max_day,
              'dep_id', ss.dep_id,
              'legacy_id', ss.legacy_id,
              'legacy_main_id', ss.legacy_main_id
            ) order by ss.order_index ASC NULLS LAST, ss.created_at ASC, ss.id ASC
          ) filter (where ss.id is not null),
          '[]'
        ) as sub_services
      from drm.services s
      left join drm.service_subservices ss on ss.service_id = s.id and ss.is_active = true
      where s.is_active = true
      group by s.id, s.code, s.name, s.is_active, s.created_at
      order by s.name
    `);
    return res.rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      price: row.price,
      isActive: row.is_active,
      createdAt: row.created_at,
      subServices: row.sub_services || [],
    }));
  },

  async findByIds(ids: string[]): Promise<Service[]> {
    if (ids.length === 0) return [];
    return db.select().from(services).where(inArray(services.id, ids));
  },

  async findByCodes(codes: string[]): Promise<Service[]> {
    if (codes.length === 0) return [];
    const res = await pool.query(
      `select id, code, name, is_active, created_at from drm.services where code = any($1::text[]) and is_active = true`,
      [codes],
    );
    return res.rows as any;
  },

  async findSubservicesByIds(
    ids: string[],
  ): Promise<Array<{ id: string; code: string; name: string; serviceId: string; serviceCode: string }>> {
    if (ids.length === 0) return [];
    const res = await pool.query(
      `select ss.id, ss.code, ss.name, ss.service_id, s.code as service_code
         from drm.service_subservices ss
         join drm.services s on s.id = ss.service_id
        where ss.id = any($1::uuid[]) and ss.is_active = true`,
      [ids],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      serviceId: r.service_id,
      serviceCode: r.service_code,
    }));
  },

  async findSubservicesByCodes(
    pairs: Array<{ serviceCode: string; subServiceCode: string }>,
  ): Promise<Array<{ id: string; code: string; name: string; serviceId: string; serviceCode: string }>> {
    if (pairs.length === 0) return [];
    const serviceCodes = Array.from(new Set(pairs.map((p) => p.serviceCode)));
    const subCodes = Array.from(new Set(pairs.map((p) => p.subServiceCode)));
    if (serviceCodes.length === 0 || subCodes.length === 0) return [];
    const res = await pool.query(
      `select ss.id, ss.code, ss.name, ss.service_id, s.code as service_code
         from drm.service_subservices ss
         join drm.services s on s.id = ss.service_id
        where ss.is_active = true
          and s.code = any($1::text[])
          and ss.code = any($2::text[])`,
      [serviceCodes, subCodes],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      serviceId: r.service_id,
      serviceCode: r.service_code,
    }));
  },
};
