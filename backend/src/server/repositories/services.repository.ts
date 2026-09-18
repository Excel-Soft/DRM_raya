import { db, pool } from "../db";
import { services, followupServices, type Service } from "@shared/schema";
import { asc, eq, inArray } from "drizzle-orm";

export interface ServiceInput {
  name: string;
  description?: string | null;
  price?: number | null;
  discount?: number | null;
  minDay?: number | null;
  maxDay?: number | null;
  depId?: number | null;
  routeDepartments?: string[] | null;
}

export interface ServiceNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number | null;
  discount: number | null;
  minDay: number | null;
  maxDay: number | null;
  depId: number | null;
  routeDepartments: string[] | null;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceWithChildren extends ServiceNode {
  subServices: Array<ServiceNode & { subSubservices: ServiceNode[] }>;
}

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

    // Older deployments created service_subservices without the unique
    // constraints declared in the table definition above. Without them the seed
    // below (which relies on ON CONFLICT (service_id, code)) fails with 42P10 and
    // silently rolls back the whole transaction, leaving the catalogue empty.
    // The table is empty in that state, so adding the indexes is safe.
    await client.query(
      `create unique index if not exists uq_service_subservices_service_code on service_subservices (service_id, code);`,
    );
    await client.query(
      `create unique index if not exists uq_service_subservices_code on service_subservices (code);`,
    );

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

  async listActiveWithSubservices(): Promise<ServiceWithChildren[]> {
    // service_subservices has historically gained optional columns (price,
    // discount, min_day, max_day, dep_id, route_departments, legacy_id,
    // legacy_main_id, order_index) in some deployments but not others. Detect
    // which exist so the query never fails on a missing column. The base
    // columns id/code/name/is_active/created_at/description are always present.
    const colRes = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'drm' and table_name = 'service_subservices'`,
    );
    const cols = new Set(colRes.rows.map((r) => r.column_name));
    const opt = (name: string) => (cols.has(name) ? `ss.${name}` : "null");
    const hasDesc = cols.has("description");
    const orderInner = cols.has("order_index")
      ? "ss.order_index ASC NULLS LAST, ss.created_at ASC, ss.id ASC"
      : "ss.created_at ASC, ss.id ASC";

    // services itself may also predate dep_id/route_departments in some
    // deployments — probe the same way rather than assuming this migration
    // has landed everywhere.
    const svcColRes = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'drm' and table_name = 'services'`,
    );
    const svcCols = new Set(svcColRes.rows.map((r) => r.column_name));
    const svcOpt = (name: string) => (svcCols.has(name) ? `s.${name}` : "null");

    const res = await pool.query(`
      select
        s.id,
        s.code,
        s.name,
        ${hasDesc ? "s.description" : "null as description"},
        s.price,
        s.discount,
        s.min_day,
        s.max_day,
        ${svcOpt("dep_id")} as dep_id,
        ${svcOpt("route_departments")} as route_departments,
        s.is_active,
        s.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', ss.id,
              'code', ss.code,
              'name', ss.name,
              'description', ${opt("description")},
              'price', ${opt("price")},
              'discount', ${opt("discount")},
              'min_day', ${opt("min_day")},
              'max_day', ${opt("max_day")},
              'dep_id', ${opt("dep_id")},
              'route_departments', ${opt("route_departments")},
              'is_active', ss.is_active,
              'created_at', ss.created_at,
              'sub_subservices', (
                select coalesce(json_agg(
                  json_build_object(
                    'id', sss.id,
                    'code', sss.code,
                    'name', sss.name,
                    'description', sss.description,
                    'price', sss.price,
                    'discount', sss.discount,
                    'min_day', sss.min_day,
                    'max_day', sss.max_day,
                    'dep_id', sss.dep_id,
                    'route_departments', sss.route_departments,
                    'is_active', sss.is_active,
                    'created_at', sss.created_at
                  ) order by sss.created_at asc, sss.id asc
                ), '[]')
                from drm.service_sub_subservices sss
                where sss.subservice_id = ss.id and sss.is_active = true
              )
            ) order by ${orderInner}
          ) filter (where ss.id is not null),
          '[]'
        ) as sub_services
      from drm.services s
      left join drm.service_subservices ss on ss.service_id = s.id and ss.is_active = true
      where s.is_active = true
      group by s.id, s.code, s.name, ${hasDesc ? "s.description," : ""} s.price, s.discount, s.min_day, s.max_day, s.is_active, s.created_at${svcCols.has("dep_id") ? ", s.dep_id" : ""}${svcCols.has("route_departments") ? ", s.route_departments" : ""}
      order by s.name
    `);
    return res.rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      price: row.price,
      discount: row.discount,
      minDay: row.min_day,
      maxDay: row.max_day,
      depId: row.dep_id,
      routeDepartments: row.route_departments,
      isActive: row.is_active,
      createdAt: row.created_at,
      subServices: (row.sub_services || []).map((sub: any) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        description: sub.description,
        price: sub.price,
        discount: sub.discount,
        minDay: sub.min_day,
        maxDay: sub.max_day,
        depId: sub.dep_id,
        routeDepartments: sub.route_departments,
        isActive: sub.is_active,
        createdAt: sub.created_at,
        subSubservices: (sub.sub_subservices || []).map((leaf: any) => ({
          id: leaf.id,
          code: leaf.code,
          name: leaf.name,
          description: leaf.description,
          price: leaf.price,
          discount: leaf.discount,
          minDay: leaf.min_day,
          maxDay: leaf.max_day,
          depId: leaf.dep_id,
          routeDepartments: leaf.route_departments,
          isActive: leaf.is_active,
          createdAt: leaf.created_at,
        })),
      })),
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

  // ── Write methods (level 1: services) ──────────────────────────────────
  async createService(data: ServiceInput): Promise<ServiceNode> {
    const code = codeFromName(data.name);
    const res = await pool.query(
      `insert into drm.services (code, name, description, price, discount, min_day, max_day, dep_id, route_departments)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      [
        code, data.name, data.description ?? null, data.price ?? null, data.discount ?? null,
        data.minDay ?? null, data.maxDay ?? null, data.depId ?? null, data.routeDepartments ?? null,
      ],
    );
    return mapServiceRow(res.rows[0]);
  },

  async updateService(id: string, data: Partial<ServiceInput>): Promise<ServiceNode | null> {
    const { setClause, params } = buildSetClause(data);
    if (!setClause) return this.findServiceRowById(id);
    params.push(id);
    const res = await pool.query(
      `update drm.services set ${setClause} where id = $${params.length} and is_active = true
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      params,
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },

  async softDeleteService(id: string): Promise<boolean> {
    const res = await pool.query(`update drm.services set is_active = false where id = $1 and is_active = true`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async findServiceRowById(id: string): Promise<ServiceNode | null> {
    const res = await pool.query(
      `select id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at
       from drm.services where id = $1 and is_active = true`,
      [id],
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },

  // ── Write methods (level 2: sub-services) ──────────────────────────────
  async createSubservice(serviceId: string, data: ServiceInput): Promise<ServiceNode> {
    const code = codeFromName(data.name);
    const res = await pool.query(
      `insert into drm.service_subservices (service_id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      [
        serviceId, code, data.name, data.description ?? null, data.price ?? null, data.discount ?? null,
        data.minDay ?? null, data.maxDay ?? null, data.depId ?? null, data.routeDepartments ?? null,
      ],
    );
    return mapServiceRow(res.rows[0]);
  },

  async updateSubservice(id: string, data: Partial<ServiceInput>): Promise<ServiceNode | null> {
    const { setClause, params } = buildSetClause(data);
    if (!setClause) return this.findSubserviceRowById(id);
    params.push(id);
    const res = await pool.query(
      `update drm.service_subservices set ${setClause} where id = $${params.length} and is_active = true
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      params,
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },

  async softDeleteSubservice(id: string): Promise<boolean> {
    const res = await pool.query(`update drm.service_subservices set is_active = false where id = $1 and is_active = true`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async findSubserviceRowById(id: string): Promise<ServiceNode | null> {
    const res = await pool.query(
      `select id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at
       from drm.service_subservices where id = $1 and is_active = true`,
      [id],
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },

  // ── Write methods (level 3: sub-sub-services) ──────────────────────────
  async createSubSubservice(subserviceId: string, data: ServiceInput): Promise<ServiceNode> {
    const code = codeFromName(data.name);
    const res = await pool.query(
      `insert into drm.service_sub_subservices (subservice_id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      [
        subserviceId, code, data.name, data.description ?? null, data.price ?? null, data.discount ?? null,
        data.minDay ?? null, data.maxDay ?? null, data.depId ?? null, data.routeDepartments ?? null,
      ],
    );
    return mapServiceRow(res.rows[0]);
  },

  async updateSubSubservice(id: string, data: Partial<ServiceInput>): Promise<ServiceNode | null> {
    const { setClause, params } = buildSetClause(data);
    if (!setClause) return this.findSubSubserviceRowById(id);
    params.push(id);
    const res = await pool.query(
      `update drm.service_sub_subservices set ${setClause} where id = $${params.length} and is_active = true
       returning id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at`,
      params,
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },

  async softDeleteSubSubservice(id: string): Promise<boolean> {
    const res = await pool.query(`update drm.service_sub_subservices set is_active = false where id = $1 and is_active = true`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async findSubSubserviceRowById(id: string): Promise<ServiceNode | null> {
    const res = await pool.query(
      `select id, code, name, description, price, discount, min_day, max_day, dep_id, route_departments, is_active, created_at
       from drm.service_sub_subservices where id = $1 and is_active = true`,
      [id],
    );
    return res.rows[0] ? mapServiceRow(res.rows[0]) : null;
  },
};

function mapServiceRow(row: any): ServiceNode {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: row.price,
    discount: row.discount,
    minDay: row.min_day,
    maxDay: row.max_day,
    depId: row.dep_id,
    routeDepartments: row.route_departments,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Slug-ish unique code derived from the name plus a short random suffix so two
// services/sub-services with the same display name never collide on the
// unique `code` column.
function codeFromName(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${base || "SERVICE"}_${suffix}`;
}

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  description: "description",
  price: "price",
  discount: "discount",
  minDay: "min_day",
  maxDay: "max_day",
  depId: "dep_id",
  routeDepartments: "route_departments",
};

function buildSetClause(data: Partial<ServiceInput>): { setClause: string; params: any[] } {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if ((data as any)[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      params.push((data as any)[key]);
    }
  }
  return { setClause: fields.join(", "), params };
}
