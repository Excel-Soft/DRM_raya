import { Router, Request, Response } from "express";
import { tempContactsRepository } from "./repositories/temp-contacts.repository";
import { insertTempContactSchema } from "@shared/schema";
import { z } from "zod";
import { generateDrmId } from "./utils/drm-id-utils";
import crypto from "crypto";
import { pool } from "./db";

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr"];
const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const SOURCES = [
  "Website",
  "Referral",
  "Cold Call",
  "Social Media",
  "Trade Show",
  "Advertisement",
  "Email Campaign",
  "Walk-in",
  "Other",
];
const SERVICE_TYPES = [
  "Mobile Responsive Website",
  "Domain Registration / Hosting",
  "Facebook Fan Page Design",
  "Graphic Designing & Logo Desig",
  "Product mockups design service",
  "Amazon Store / Posting",
  "Amazon Product Hunting",
  "Instagram Page Design Manage",
  "Social Media followers",
  "VM",
  "Alibaba VA",
  "E-Commerce Store",
  "Photo Shooting & Video Documen",
  "EBay Store / Posting",
  "Daraz Store & Product Posting",
  "Designing Services",
  "Alibaba listing page",
  "Amazon Product Listing",
  "Instagram Ads",
  "Minisite professional",
  "Etsy Store Creation or Posting",
  "Alibaba Services",
  "SEO & SEM Services",
  "Web Design & Development",
  "Digital Marketing",
  "CONSULTANCY & CERTIFICATION",
  "Videography Service",
  "Amazon Account Creation",
  "Facebook Ads",
  "Android App",
  "Social Media Account Handling",
];

const createTempContactSchema = z.object({
  title: z.string().min(1, "Title is required"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z
    .string()
    .min(7, "Mobile is required")
    .refine((value) => normalizePhone(value).length >= 7, { message: "Enter a valid mobile number" }),
  comment: z.string().optional(),
  source: z.string().min(1, "Source is required"),
  grade: z.string().min(1, "Grade is required"),
  country: z.string().optional(),
  serviceTypes: z.array(z.string()).default([]),
});

type DuplicateContact = {
  id: string;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  grade?: string | null;
  source?: string | null;
  status?: string | null;
  recordType: "customer" | "temporary_contact";
};

const router = Router();

let customerColumnSupport: {
  checked: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasMobile: boolean;
} = { checked: false, hasEmail: false, hasPhone: false, hasMobile: false };

let tempContactsSchemaEnsured = false;
async function ensureTempContactsSchema() {
  if (tempContactsSchemaEnsured) return;
  const ddl = `
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'temp_contact_status') then
        create type temp_contact_status as enum ('Pending', 'Promoted', 'Rejected');
      end if;
    end$$;

    alter table temp_contacts
      add column if not exists user_id uuid references users(id),
      add column if not exists title text,
      add column if not exists person_name text,
      add column if not exists email text,
      add column if not exists mobile text,
      add column if not exists source text,
      add column if not exists grade text,
      add column if not exists country text,
      add column if not exists drm_id text unique,
      add column if not exists comment text,
      add column if not exists service_types text[] default '{}'::text[],
      add column if not exists status temp_contact_status default 'Pending',
      add column if not exists promoted_to_customer_id uuid references customers(id),
      add column if not exists promoted_at timestamptz,
      add column if not exists promoted_by_user_id uuid references users(id),
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    update temp_contacts
    set
      person_name = coalesce(person_name, raw_name),
      mobile = coalesce(mobile, phone),
      grade = coalesce(grade, 'C'),
      status = coalesce(status, 'Pending'),
      updated_at = now()
    where person_name is null
       or mobile is null
       or grade is null
       or status is null;

    create index if not exists idx_temp_contacts_email_lower on temp_contacts (lower(email));
    create index if not exists idx_temp_contacts_mobile_digits on temp_contacts (regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'));
  `;
  try {
    await pool.query(ddl);
    tempContactsSchemaEnsured = true;
  } catch (err) {
    console.error("Failed to ensure temp_contacts schema (continuing):", err);
  }
}

function normalizePhone(value?: string) {
  return (value || "").replace(/\D+/g, "");
}

async function findDuplicateContacts(email: string, mobile: string): Promise<{
  customers: DuplicateContact[];
  tempContacts: DuplicateContact[];
}> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMobileDigits = normalizePhone(mobile);

  if (!normalizedEmail && !normalizedMobileDigits) {
    return { customers: [], tempContacts: [] };
  }

  try {
    if (!customerColumnSupport.checked) {
      const colRes = await pool.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name = 'customers'",
      );
      const cols = colRes.rows.map((c) => c.column_name);
      customerColumnSupport = {
        checked: true,
        hasEmail: cols.includes("email"),
        hasPhone: cols.includes("phone"),
        hasMobile: cols.includes("mobile"),
      };
    }

    const canCheckEmail = customerColumnSupport.hasEmail && normalizedEmail;
    const canCheckPhone =
      normalizedMobileDigits && (customerColumnSupport.hasMobile || customerColumnSupport.hasPhone);

    const customerMatches = canCheckEmail || canCheckPhone
      ? await pool.query<{
        id: string;
        companyName: string | null;
        email?: string | null;
        phone?: string | null;
        mobile?: string | null;
        grade?: string | null;
        source?: string | null;
      }>(
        (() => {
          const selectEmail = customerColumnSupport.hasEmail ? ", email" : "";
          const selectPhone = customerColumnSupport.hasPhone ? ", phone" : "";
          const selectMobile = customerColumnSupport.hasMobile ? ", mobile" : "";

          const clauses: string[] = [];
          const params: any[] = [];
          let p = 1;
          if (canCheckEmail) {
            clauses.push(`($${p} <> '' and lower(email) = $${p})`);
            params.push(normalizedEmail);
            p += 1;
          }
          if (canCheckPhone) {
            clauses.push(
              `($${p} <> '' and regexp_replace(coalesce(${customerColumnSupport.hasMobile ? "mobile" : "phone"}, ''), '\\D','','g') = $${p})`,
            );
            params.push(normalizedMobileDigits);
            p += 1;
          }

          return {
            text: `
                select 
                  id,
                  company_name as "companyName"
                  ${selectEmail}
                  ${selectPhone}
                  ${selectMobile}
                  , grade, source
                from drm.customers
                where ${clauses.join(" or ")}
                limit 5
              `,
            values: params,
          };
        })(),
      )
      : { rows: [] as any[] };

    const tempContactMatches = await pool.query<{
      id: string;
      personName: string | null;
      email: string | null;
      mobile: string | null;
      grade: string | null;
      source: string | null;
      status: string | null;
    }>(
      `
          select 
            id,
            person_name as "personName",
            email,
            mobile,
            grade,
            source,
            status
          from temp_contacts
          where
            (($1 <> '' and lower(email) = $1)
              or ($2 <> '' and regexp_replace(coalesce(mobile, ''), '\\D','','g') = $2))
          limit 5
        `,
      [normalizedEmail, normalizedMobileDigits],
    );

    return {
      customers: customerMatches.rows.map((row) => ({
        id: row.id,
        name: row.companyName,
        email: row.email,
        mobile: row.mobile || row.phone,
        grade: row.grade,
        source: row.source,
        recordType: "customer" as const,
      })),
      tempContacts: tempContactMatches.rows.map((row) => ({
        id: row.id,
        name: row.personName,
        email: row.email,
        mobile: row.mobile,
        grade: row.grade,
        source: row.source,
        status: row.status,
        recordType: "temporary_contact" as const,
      })),
    };
  } catch (err) {
    console.error("Duplicate check failed, skipping duplicate enforcement", err);
    return { customers: [], tempContacts: [] };
  }
}

router.use((req: Request, res: Response, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
});

router.get("/meta", (_req: Request, res: Response) => {
  return res.json({
    titles: TITLES,
    sources: SOURCES,
    grades: GRADES,
    serviceTypes: SERVICE_TYPES,
  });
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { status, grade, search } = req.query;

    const contacts = await tempContactsRepository.findAllWithFilters({
      userId,
      status: status as string,
      grade: grade as string,
      search: search as string,
    });

    res.json(contacts);
  } catch (error) {
    console.error("Error fetching temp contacts:", error);
    res.status(500).json({ error: "Failed to fetch temporary contacts" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await tempContactsRepository.getStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching temp contact stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/no-grade", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const contacts = await tempContactsRepository.getNoGradeContacts(userId);
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts without grade:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await tempContactsRepository.findById(id, req.user!.userId);

    if (!contact) {
      return res.status(404).json({ error: "Temporary contact not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error fetching temp contact:", error);
    res.status(500).json({ error: "Failed to fetch temporary contact" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await ensureTempContactsSchema();

    const userId = req.user!.userId;

    console.log("[temp-contacts] incoming body", req.body);

    const parsedBody = createTempContactSchema.parse({
      ...req.body,
      serviceTypes: Array.isArray(req.body?.serviceTypes) ? req.body.serviceTypes : [],
    });

    const duplicates = await findDuplicateContacts(parsedBody.email, parsedBody.mobile);
    const hasDuplicates = duplicates.customers.length > 0 || duplicates.tempContacts.length > 0;
    if (hasDuplicates) {
      console.warn("[temp-contacts] duplicate detected, creating anyway", duplicates);
    }

    // Generate DRM ID for lead
    const drmId = generateDrmId(
      parsedBody.fullName,
      parsedBody.country || "Other",
      parsedBody.fullName,
      crypto.randomUUID()
    );

    const validatedData = insertTempContactSchema.parse({
      userId,
      title: parsedBody.title,
      personName: parsedBody.fullName,
      email: parsedBody.email.trim(),
      mobile: parsedBody.mobile.trim(),
      country: parsedBody.country || "Other",
      drmId: drmId,
      source: parsedBody.source,
      grade: parsedBody.grade,
      comment: parsedBody.comment?.trim() || null,
      serviceTypes: parsedBody.serviceTypes ?? [],
    });

    console.log("[temp-contacts] validated insert", validatedData);

    const contact = await tempContactsRepository.create(validatedData);
    res.status(201).json(hasDuplicates ? { ...contact, duplicateWarning: duplicates } : contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating temp contact:", error);
    res.status(500).json({
      error: "Failed to create temporary contact",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/:id/promote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;
    const userId = req.user!.userId;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID is required for promotion" });
    }

    const contact = await tempContactsRepository.promoteToCustomer(id, customerId, userId, userId);

    if (!contact) {
      return res.status(404).json({ error: "Temporary contact not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error promoting temp contact:", error);
    res.status(500).json({ error: "Failed to promote temporary contact" });
  }
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await tempContactsRepository.reject(id, req.user!.userId);

    if (!contact) {
      return res.status(404).json({ error: "Temporary contact not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error rejecting temp contact:", error);
    res.status(500).json({ error: "Failed to reject temporary contact" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await tempContactsRepository.delete(id, req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting temp contact:", error);
    res.status(500).json({ error: "Failed to delete temporary contact" });
  }
});

export default router;
