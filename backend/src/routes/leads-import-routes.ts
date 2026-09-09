import type { Express, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { pool, db } from "../db";
import { customers } from "@models/schema";
import crypto from "crypto";
import { generateDrmId, resolveOrCreateCanonicalDrmId } from "../utils/drm-id-utils";
import {
  findDuplicates,
  canOverrideDuplicates,
  normalizeEmail,
  normalizePhone,
  normalizeCompany,
  type DuplicateMatch,
} from "../utils/duplicate-policy";
import { ActivityLogService } from "../services/activity-service";
import { ensureServicesSchema } from "../repositories/services.repository";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

// Canonical lead fields and the header aliases used to auto-map uploaded columns.
const FIELD_ALIASES: Record<string, string[]> = {
  companyName: ["company name", "company", "companyname", "organization", "organisation", "org", "business", "business name"],
  personName: ["contact person", "contact", "person", "person name", "contact name", "full name", "name", "account holder"],
  phone: ["phone", "mobile", "contact number", "phone number", "number", "cell", "whatsapp", "contact no"],
  email: ["email", "e-mail", "mail", "email address"],
  city: ["city", "town"],
  country: ["country", "nation"],
  source: ["source", "lead source"],
  serviceInterest: ["service/product interest", "service interest", "product interest", "service", "product", "interest", "services"],
  notes: ["notes", "note", "comment", "comments", "remarks", "description"],
  assignedUser: ["assigned user", "assigned to", "owner", "assigned", "salesperson", "executive", "assigned user optional"],
};

const TEMPLATE_COLUMNS = [
  "Company Name",
  "Contact Person",
  "Phone",
  "Email",
  "City",
  "Country",
  "Source",
  "Service/Product Interest",
  "Notes",
  "Assigned User",
];

type CanonicalRow = {
  companyName: string;
  personName: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  source: string;
  serviceInterest: string;
  notes: string;
  assignedUser: string;
};

function normHeader(h: string): string {
  return (h || "").toString().trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<string>();

  // Score a header against a field's aliases: 3 = exact match, 2 = word-boundary
  // match, 1 = loose substring match, 0 = no match. Higher is more specific so a
  // header like "Company Name" maps to companyName rather than personName's
  // generic "name" alias.
  const scoreHeader = (header: string, aliases: string[]): number => {
    const nh = normHeader(header);
    let best = 0;
    for (const a of aliases) {
      if (nh === a) best = Math.max(best, 3);
      else if (new RegExp(`(^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`).test(nh))
        best = Math.max(best, 2);
      else if (nh.includes(a)) best = Math.max(best, 1);
    }
    return best;
  };

  // Pass over each field, choosing the highest-scoring unclaimed header.
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let bestHeader: string | null = null;
    let bestScore = 0;
    for (const h of headers) {
      if (claimed.has(h)) continue;
      const score = scoreHeader(h, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = h;
      }
    }
    if (bestHeader && bestScore > 0) {
      mapping[field] = bestHeader;
      claimed.add(bestHeader);
    }
  }
  return mapping;
}

function parseUpload(file: Express.Multer.File): { headers: string[]; rows: Record<string, any>[] } {
  const name = (file.originalname || "").toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type "${ext}". Use CSV, XLS or XLSX.`);
  }

  if (ext === ".csv") {
    const text = file.buffer.toString("utf-8");
    const records = parseCsv(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, any>[];
    const headers = records.length ? Object.keys(records[0]) : [];
    return { headers, rows: records };
  }

  const wb = XLSX.read(file.buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function applyMapping(raw: Record<string, any>, mapping: Record<string, string>): CanonicalRow {
  const get = (field: string) => {
    const col = mapping[field];
    if (!col) return "";
    const v = raw[col];
    return v === undefined || v === null ? "" : v.toString().trim();
  };
  return {
    companyName: get("companyName"),
    personName: get("personName"),
    phone: get("phone"),
    email: get("email"),
    city: get("city"),
    country: get("country"),
    source: get("source"),
    serviceInterest: get("serviceInterest"),
    notes: get("notes"),
    assignedUser: get("assignedUser"),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(row: CanonicalRow): string[] {
  const errors: string[] = [];
  if (!row.companyName) errors.push("Company Name is required");
  if (!row.email && !row.phone) errors.push("Either Email or Phone is required");
  if (row.email && !EMAIL_RE.test(row.email)) errors.push("Email format is invalid");
  return errors;
}

let leadImportsSchemaReady = false;
async function ensureLeadImportsSchema() {
  if (leadImportsSchemaReady) return;
  await pool.query(`
    create table if not exists drm.lead_imports (
      id uuid primary key default gen_random_uuid(),
      imported_by uuid,
      file_name text,
      total_rows integer not null default 0,
      inserted_count integer not null default 0,
      skipped_duplicates integer not null default 0,
      invalid_count integer not null default 0,
      override_used boolean not null default false,
      override_reason text,
      errors jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    );
  `);
  leadImportsSchemaReady = true;
}

export function registerLeadsImportRoutes(app: Express) {
  // ── A. Lead import template (real CSV download) ──────────────────────────
  app.get("/api/leads/template", (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const header = TEMPLATE_COLUMNS.join(",");
    const example = [
      "Acme Trading Co",
      "John Smith",
      "+92 300 1234567",
      "john@acme.com",
      "Karachi",
      "Pakistan",
      "Website",
      "Web Design & Development",
      "Interested in e-commerce store",
      "",
    ]
      .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
      .join(",");
    const csv = `${header}\n${example}\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="lead-import-template.csv"');
    return res.send(csv);
  });

  // ── B. Import preview ────────────────────────────────────────────────────
  app.post("/api/leads/import/preview", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      let parsed: { headers: string[]; rows: Record<string, any>[] };
      try {
        parsed = parseUpload(req.file);
      } catch (e: any) {
        return res.status(400).json({ error: e.message || "Could not read file" });
      }

      if (parsed.rows.length === 0) {
        return res.status(400).json({ error: "The file contains no data rows" });
      }
      if (parsed.rows.length > 5000) {
        return res.status(400).json({ error: "Too many rows (max 5000 per import)" });
      }

      const mapping =
        req.body?.mapping && typeof req.body.mapping === "string"
          ? { ...suggestMapping(parsed.headers), ...JSON.parse(req.body.mapping) }
          : suggestMapping(parsed.headers);

      const seen = new Set<string>();
      let validCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;

      const previewRows = [] as any[];
      // Limit duplicate DB lookups to a reasonable preview window for performance.
      const PREVIEW_LIMIT = 500;

      for (let i = 0; i < parsed.rows.length; i++) {
        const raw = parsed.rows[i];
        const data = applyMapping(raw, mapping);
        const errors = validateRow(data);
        let duplicates: DuplicateMatch[] = [];
        let withinFileDuplicate = false;
        let duplicateCheckFailed = false;

        if (errors.length === 0) {
          const key = [normalizeEmail(data.email), normalizePhone(data.phone), normalizeCompany(data.companyName)]
            .filter(Boolean)
            .join("|");
          if (key && seen.has(key)) withinFileDuplicate = true;
          if (key) seen.add(key);

          if (i < PREVIEW_LIMIT) {
            try {
              duplicates = await findDuplicates({
                email: data.email,
                phone: data.phone,
                company: data.companyName,
              });
            } catch {
              // Fail closed: surface that the row could not be verified rather
              // than implying it is unique.
              duplicateCheckFailed = true;
            }
          }
        }

        const isDuplicate = withinFileDuplicate || duplicates.length > 0 || duplicateCheckFailed;
        if (errors.length > 0) invalidCount++;
        else if (isDuplicate) duplicateCount++;
        else validCount++;

        previewRows.push({
          rowNumber: i + 2, // +2: header row + 1-based
          data,
          raw,
          valid: errors.length === 0,
          errors,
          duplicate: isDuplicate,
          withinFileDuplicate,
          duplicateCheckFailed,
          duplicateMatches: duplicates,
        });
      }

      return res.json({
        fileName: req.file.originalname,
        headers: parsed.headers,
        suggestedMapping: suggestMapping(parsed.headers),
        appliedMapping: mapping,
        totalRows: parsed.rows.length,
        counts: { total: parsed.rows.length, valid: validCount, duplicates: duplicateCount, invalid: invalidCount },
        duplicateLookupLimited: parsed.rows.length > PREVIEW_LIMIT,
        rows: previewRows,
      });
    } catch (error: any) {
      console.error("Lead import preview failed:", error);
      return res.status(500).json({ error: error.message || "Failed to preview import" });
    }
  });

  // ── B. Import commit ─────────────────────────────────────────────────────
  app.post("/api/leads/import/commit", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureLeadImportsSchema();

      const body = req.body || {};
      const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
      const fileName: string = (body.fileName || "import").toString();
      const wantsOverride = body.override === true;
      const overrideReason = (body.overrideReason || "").toString().trim();

      if (rows.length === 0) return res.status(400).json({ error: "No rows to import" });
      if (rows.length > 5000) return res.status(400).json({ error: "Too many rows (max 5000 per import)" });

      const role = (req.user as any).role as string | undefined;
      const overrideAllowed = wantsOverride && canOverrideDuplicates(role);
      if (wantsOverride && !canOverrideDuplicates(role)) {
        return res.status(403).json({ error: "Your role is not permitted to override duplicate leads." });
      }
      if (overrideAllowed && !overrideReason) {
        return res.status(400).json({ error: "A reason is required to override duplicate leads." });
      }

      const errors: Array<{ rowNumber: number; companyName: string; reason: string; type: string }> = [];
      const seen = new Set<string>();
      let inserted = 0;
      let skippedDuplicates = 0;
      let invalid = 0;
      let overriddenInserts = 0;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {};
        const data: CanonicalRow = {
          companyName: (r.companyName || "").toString().trim(),
          personName: (r.personName || "").toString().trim(),
          phone: (r.phone || "").toString().trim(),
          email: (r.email || "").toString().trim(),
          city: (r.city || "").toString().trim(),
          country: (r.country || "").toString().trim(),
          source: (r.source || "").toString().trim(),
          serviceInterest: (r.serviceInterest || "").toString().trim(),
          notes: (r.notes || "").toString().trim(),
          assignedUser: (r.assignedUser || "").toString().trim(),
        };
        const rowNumber = Number(r.rowNumber) || i + 2;

        const validationErrors = validateRow(data);
        if (validationErrors.length > 0) {
          invalid++;
          errors.push({ rowNumber, companyName: data.companyName, reason: validationErrors.join("; "), type: "invalid" });
          continue;
        }

        // Within-file duplicate guard (never insert the same lead twice in one batch).
        const key = [normalizeEmail(data.email), normalizePhone(data.phone), normalizeCompany(data.companyName)]
          .filter(Boolean)
          .join("|");
        if (key && seen.has(key)) {
          skippedDuplicates++;
          errors.push({ rowNumber, companyName: data.companyName, reason: "Duplicate row within file", type: "duplicate" });
          continue;
        }

        let dupes: Awaited<ReturnType<typeof findDuplicates>>;
        try {
          dupes = await findDuplicates({ email: data.email, phone: data.phone, company: data.companyName });
        } catch {
          // Fail closed: if duplicate verification cannot run, never insert —
          // record the row as an error so no silent duplicate slips through.
          invalid++;
          errors.push({ rowNumber, companyName: data.companyName, reason: "Duplicate check failed; row not imported", type: "error" });
          continue;
        }
        if (dupes.length > 0 && !overrideAllowed) {
          skippedDuplicates++;
          const why = dupes.map((d) => `${d.matchType} matches existing ${d.recordType}`).join(", ");
          errors.push({ rowNumber, companyName: data.companyName, reason: `Duplicate skipped (${why})`, type: "duplicate" });
          continue;
        }

        // Resolve optional assigned user (by email or name).
        let ownerUserId: string | null = null;
        if (data.assignedUser) {
          const u = await pool.query(
            `select id from drm.users where lower(trim(email)) = lower(trim($1)) or lower(trim(name)) = lower(trim($1)) limit 1`,
            [data.assignedUser],
          );
          ownerUserId = u.rows[0]?.id ?? null;
        }

        try {
          const drmId = await resolveOrCreateCanonicalDrmId(pool, {
            companyName: data.companyName,
            email: data.email,
            phone: data.phone,
            country: data.country,
          });
          await db
            .insert(customers)
            .values({
              companyName: data.companyName,
              accountName: data.personName || data.companyName,
              email: data.email || "",
              phone: data.phone || "",
              phoneNormalized: normalizePhone(data.phone) || null,
              region: data.country || "Other",
              grade: "C",
              status: "New",
              country: data.country || null,
              city: data.city || null,
              source: data.source || "Import",
              personName: data.personName || null,
              comment: data.notes || null,
              serviceTypes: data.serviceInterest ? [data.serviceInterest] : [],
              poolType: ownerUserId ? "Private" : "Public",
              ownerUserId: ownerUserId as any,
              createdBy: req.user.userId as any,
              drmId,
            } as any)
            .returning({ id: customers.id });
          inserted++;
          if (dupes.length > 0 && overrideAllowed) {
            overriddenInserts++;
            errors.push({ rowNumber, companyName: data.companyName, reason: `Inserted with duplicate override: ${overrideReason}`, type: "override" });
          }
          if (key) seen.add(key);
        } catch (insErr: any) {
          invalid++;
          errors.push({ rowNumber, companyName: data.companyName, reason: insErr.message || "Insert failed", type: "error" });
        }
      }

      const importRow = await pool.query(
        `insert into drm.lead_imports
           (imported_by, file_name, total_rows, inserted_count, skipped_duplicates, invalid_count, override_used, override_reason, errors)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         returning id`,
        [
          req.user.userId,
          fileName,
          rows.length,
          inserted,
          skippedDuplicates,
          invalid,
          overriddenInserts > 0,
          overriddenInserts > 0 ? overrideReason : null,
          JSON.stringify(errors),
        ],
      );
      const importId = importRow.rows[0]?.id as string;

      await ActivityLogService.log({
        userId: req.user.userId,
        action: "lead_import.commit",
        resourceType: "lead_import",
        resourceId: importId,
        details: `Imported ${inserted} leads from "${fileName}" (skipped ${skippedDuplicates} duplicates, ${invalid} invalid${
          overriddenInserts > 0 ? `, ${overriddenInserts} duplicate overrides` : ""
        })`,
      });

      return res.json({
        success: true,
        importId,
        fileName,
        inserted,
        skippedDuplicates,
        invalid,
        overriddenInserts,
        total: rows.length,
        errors,
      });
    } catch (error: any) {
      console.error("Lead import commit failed:", error);
      return res.status(500).json({ error: error.message || "Failed to import leads" });
    }
  });

  // ── B. Downloadable error report ─────────────────────────────────────────
  app.get("/api/leads/imports/:id/errors", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureLeadImportsSchema();
      const result = await pool.query(`select file_name, errors from drm.lead_imports where id = $1 limit 1`, [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: "Import not found" });
      const errors = (result.rows[0].errors as any[]) || [];

      const header = "Row,Company Name,Type,Reason";
      const lines = errors.map((e) => {
        const cells = [e.rowNumber, e.companyName || "", e.type || "", e.reason || ""].map((v) => {
          const s = (v ?? "").toString();
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        });
        return cells.join(",");
      });
      const csv = [header, ...lines].join("\n") + "\n";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lead-import-${req.params.id}-errors.csv"`);
      return res.send(csv);
    } catch (error: any) {
      console.error("Failed to fetch import errors:", error);
      return res.status(500).json({ error: "Failed to fetch import errors" });
    }
  });

  // ── D. Standardized products / packages endpoint ─────────────────────────
  app.get("/api/sales/products", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureServicesSchema();
      const search = (req.query.search as string | undefined)?.trim() || "";
      const includeInactive = req.query.includeInactive === "true";

      // The service_subservices table has historically gained optional columns
      // (price, max_price, tax, stock, order_index) in some deployments but not
      // others. Detect which exist so this endpoint never fails on a missing column.
      const colRes = await pool.query(
        `select column_name from information_schema.columns
          where table_schema = 'drm' and table_name = 'service_subservices'`,
      );
      const cols = new Set(colRes.rows.map((r: any) => r.column_name));
      const sel = (c: string) => (cols.has(c) ? `ss.${c}` : "null") + ` as ${c}`;
      const orderExpr = cols.has("order_index") ? "coalesce(ss.order_index, 2147483647)" : cols.has("n") ? "coalesce(ss.n, 2147483647)" : "ss.name";

      const params: any[] = [];
      let where = "";
      if (!includeInactive) where += " and ss.is_active = true and s.is_active = true";
      if (search) {
        params.push(`%${search}%`);
        where += ` and (ss.name ilike $${params.length} or s.name ilike $${params.length} or ss.code ilike $${params.length})`;
      }

      const result = await pool.query(
        `select
            ss.id            as id,
            ss.name          as name,
            ss.code          as code,
            s.name           as service_category,
            ss.is_active     as active,
            ${sel("price")},
            ${sel("max_price")},
            ${sel("tax")},
            ${sel("stock")}
         from drm.service_subservices ss
         join drm.services s on s.id = ss.service_id
         where 1=1 ${where}
         order by s.name asc, ${orderExpr} asc, ss.name asc`,
        params,
      );

      const items = result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        package: r.name,
        code: r.code,
        serviceCategory: r.service_category,
        active: r.active === null ? true : r.active,
        price: r.price !== null && r.price !== undefined ? Number(r.price) : null,
        maxPrice: r.max_price !== null && r.max_price !== undefined ? Number(r.max_price) : null,
        tax: r.tax !== null && r.tax !== undefined ? Number(r.tax) : null,
        stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : null,
      }));

      return res.json({ success: true, items });
    } catch (error: any) {
      console.error("Failed to fetch products:", error);
      return res.status(500).json({ error: "Failed to fetch products" });
    }
  });
}
