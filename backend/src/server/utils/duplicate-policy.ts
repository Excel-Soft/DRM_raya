import { pool } from "../db";
import { normalizeRole } from "./role-utils";

/**
 * Stage 6 — single duplicate policy shared across Add Customer, Temporary Contact,
 * Lead import, Lead pool promotion, and the Duplicate Checker.
 *
 * Policy:
 *  - A record is a duplicate if its normalized email, phone, OR company name matches
 *    an existing customer or temporary contact.
 *  - Duplicates are blocked by default. Privileged roles may override with a reason.
 *  - Every override must be audited by the caller.
 */

export type DuplicateMatchType = "email" | "phone" | "company";
export type DuplicateRecordType = "customer" | "temp_contact";

export interface DuplicateMatch {
  recordType: DuplicateRecordType;
  id: string;
  drmId?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  matchType: DuplicateMatchType;
}

export interface DuplicateLookupInput {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

/** Roles permitted to override a blocked duplicate (with a required reason). */
export const DUPLICATE_OVERRIDE_ROLES = [
  "admin",
  "super_admin",
  "sales_manager",
];

export function normalizeEmail(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function normalizePhone(value?: string | null): string {
  return (value || "").replace(/\D+/g, "");
}

export function normalizeCompany(value?: string | null): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Whether the given role may override a blocked duplicate. */
export function canOverrideDuplicates(role?: string | null): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  if (DUPLICATE_OVERRIDE_ROLES.includes(normalized)) return true;
  // super_admin is sometimes represented as the raw role string only.
  return DUPLICATE_OVERRIDE_ROLES.includes((role || "").toLowerCase().trim());
}

/**
 * Find existing customers / temporary contacts that duplicate the given
 * email, phone, or company name. Returns one entry per matching record with the
 * field that caused the match. Never throws — on DB error it returns [] so the
 * caller can decide how strict to be (callers should treat lookup failure as
 * "could not verify", not "no duplicates").
 */
export async function findDuplicates(
  input: DuplicateLookupInput,
  opts: { excludeCustomerId?: string | null } = {},
): Promise<DuplicateMatch[]> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const company = normalizeCompany(input.company);

  if (!email && !phone && !company) return [];

  const matches: DuplicateMatch[] = [];

  try {
    const custParams: any[] = [email, phone, company, opts.excludeCustomerId || null];
    const custRes = await pool.query(
      `select id, drm_id, company_name, email, phone, mobile,
              (lower(trim(coalesce(email,''))) = $1 and $1 <> '') as match_email,
              ((regexp_replace(coalesce(phone_normalized, phone, ''), '\\D', '', 'g') = $2
                or regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = $2) and $2 <> '') as match_phone,
              ((regexp_replace(lower(coalesce(company_name, '')), '[^a-z0-9]', '', 'g') = $3 or lower(trim(coalesce(drm_id, ''))) = $3) and $3 <> '') as match_company
         from drm.customers
        where coalesce(is_deleted, false) = false
          and ($4::uuid is null or id <> $4::uuid)
          and (
            (lower(trim(coalesce(email,''))) = $1 and $1 <> '')
            or ((regexp_replace(coalesce(phone_normalized, phone, ''), '\\D', '', 'g') = $2
                 or regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = $2) and $2 <> '')
            or ((regexp_replace(lower(coalesce(company_name, '')), '[^a-z0-9]', '', 'g') = $3 or lower(trim(coalesce(drm_id, ''))) = $3) and $3 <> '')
          )
        limit 25`,
      custParams,
    );

    for (const row of custRes.rows) {
      const matchType: DuplicateMatchType = row.match_email
        ? "email"
        : row.match_phone
          ? "phone"
          : "company";
      matches.push({
        recordType: "customer",
        id: row.id,
        drmId: row.drm_id ?? null,
        name: row.company_name ?? null,
        email: row.email ?? null,
        phone: row.phone ?? row.mobile ?? null,
        matchType,
      });
    }

    // Temp contacts have no company column; only email/phone are comparable.
    if (email || phone) {
      const tempRes = await pool.query(
        `select id, drm_id, person_name, email, mobile,
                (lower(trim(coalesce(email,''))) = $1 and $1 <> '') as match_email
           from drm.temp_contacts
          where (lower(trim(coalesce(email,''))) = $1 and $1 <> '')
             or (regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = $2 and $2 <> '')
          limit 25`,
        [email, phone],
      );
      for (const row of tempRes.rows) {
        matches.push({
          recordType: "temp_contact",
          id: row.id,
          drmId: row.drm_id ?? null,
          name: row.person_name ?? null,
          email: row.email ?? null,
          phone: row.mobile ?? null,
          matchType: row.match_email ? "email" : "phone",
        });
      }
    }
  } catch (err) {
    // Fail closed: callers must never treat a failed lookup as "no duplicate".
    // Re-throw so the import flow can refuse to insert unverified rows.
    console.error("[duplicate-policy] lookup failed:", err);
    throw new Error("Duplicate verification failed");
  }

  return matches;
}
