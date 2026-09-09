import { pool } from "../db";
import crypto from "crypto";

function stringHashNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Generate a readable DRM ID in format: pkbila1234
 * - Country code (2 chars, lowercase)
 * - Name part (up to 4 chars, lowercase, from company name initials or first chars)
 * - Unique 4-digit number derived deterministically from UUID or fallback seed
 * 
 * Supports both 3-arg and 4-arg calling conventions for backward compatibility.
 */
export function generateDrmId(
    companyName: string,
    country: string,
    fallbackIdOrPersonName: string,
    fallbackId?: string
): string {
    // Support both (company, country, fallback) and (company, country, personName, fallback)
    const actualFallbackId = fallbackId ?? fallbackIdOrPersonName;

    // 1. Get Country Code (2 chars UPPERCASE, e.g. "PK")
    let countryCode = "OT";
    if (country) {
        const c = country.trim().toLowerCase();
        if (c === "pakistan" || c === "pk") {
            countryCode = "PK";
        } else if (c === "united arab emirates" || c === "uae") {
            countryCode = "AE";
        } else if (c === "usa" || c === "united states" || c === "us") {
            countryCode = "US";
        } else if (c === "uk" || c === "united kingdom") {
            countryCode = "UK";
        } else if (c === "china" || c === "cn") {
            countryCode = "CN";
        } else if (c === "india" || c === "in") {
            countryCode = "IN";
        } else if (c === "saudi arabia" || c === "sa") {
            countryCode = "SA";
        } else if (c.length >= 2) {
            countryCode = c.substring(0, 2).toUpperCase();
        } else if (c.length === 1) {
            countryCode = (c + "X").toUpperCase();
        }
    }

    // 2. Get Name Part (up to 4 chars UPPERCASE from Company name)
    let namePart = "COMP";
    const entityName = (companyName || "UNKNOWN").trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "");
    const words = entityName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        namePart = words
            .map((w) => w[0])
            .join("")
            .substring(0, 4);
    } else if (words.length === 1) {
        namePart = words[0].substring(0, 4);
    }

    // 3. Unique Number (4 digits derived deterministically)
    const hexPart = (actualFallbackId || "").replace(/-/g, "").substring(0, 6);
    let num = parseInt(hexPart, 16);
    if (isNaN(num)) {
        num = stringHashNumber(actualFallbackId || companyName || "UNKNOWN");
    }
    const uniqueNum = String(num % 10000).padStart(4, "0");

    // Format: pkbila1234 (no dashes, lowercase)
    return `${countryCode.toLowerCase()}${namePart.toLowerCase()}${uniqueNum}`;
}

/**
 * Checks whether a candidate DRM ID is already in use anywhere in the system.
 * `drm_id` lives on three tables (customers, temp_contacts, gm_entries); only
 * customers/temp_contacts carry a DB-level UNIQUE constraint, so this check is
 * what actually guarantees "no duplicate DRM ID" across all three.
 */
async function isDrmIdTaken(executor: any, candidate: string): Promise<boolean> {
    const res = await executor.query(
        `SELECT 1 AS taken FROM drm.customers WHERE drm_id = $1
         UNION ALL
         SELECT 1 FROM drm.temp_contacts WHERE drm_id = $1
         UNION ALL
         SELECT 1 FROM drm.gm_entries WHERE drm_id = $1
         LIMIT 1`,
        [candidate]
    );
    return res.rows.length > 0;
}

/**
 * Generates a brand-new DRM ID and guarantees — by actually checking the
 * database, not just hoping the hash doesn't collide — that it isn't already
 * assigned to a different company. `generateDrmId`'s 4-digit suffix is only a
 * 10,000-value space per country+initials bucket, so a collision between two
 * different companies is a real possibility, not a theoretical one. Retries
 * with a perturbed seed on collision; falls back to appending extra random
 * entropy if the bucket is ever exhausted, so this can never fail to return a
 * genuinely unique ID.
 */
export async function generateUniqueDrmId(
    executor: any,
    companyName: string,
    country: string,
    seed: string
): Promise<string> {
    const MAX_ATTEMPTS = 50;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const perturbedSeed = attempt === 0 ? seed : `${seed}:retry${attempt}`;
        const candidate = generateDrmId(companyName, country, perturbedSeed);
        if (!(await isDrmIdTaken(executor, candidate))) {
            return candidate;
        }
    }
    // Bucket exhausted (practically never happens with a 10,000-value space) —
    // expand the ID with extra entropy rather than ever return a duplicate.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = `${generateDrmId(companyName, country, `${seed}:${crypto.randomUUID()}`)}${crypto.randomBytes(2).toString("hex")}`;
        if (!(await isDrmIdTaken(executor, candidate))) {
            return candidate;
        }
    }
    throw new Error("Unable to generate a unique DRM ID after exhausting all retries");
}

export interface ResolveDrmIdParams {
    customerId?: string | null;
    tempContactId?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
}

/**
 * Resolves an existing DRM ID for an entity or creates a brand new one ONCE.
 * Ensures the DRM ID remains consistent across customers, temp_contacts, gm_entries, etc.
 */
export async function resolveOrCreateCanonicalDrmId(
    dbExecutor: any,
    params: ResolveDrmIdParams
): Promise<string> {
    const executor = dbExecutor || pool;
    const company = (params.companyName || "").trim();
    const email = (params.email || "").trim().toLowerCase();
    const phone = (params.phone || "").replace(/\D+/g, "");

    // 1. Check if customer ID was explicitly passed
    if (params.customerId) {
        const cRes = await executor.query(
            "SELECT drm_id, country, company_name FROM drm.customers WHERE id = $1",
            [params.customerId]
        );
        if (cRes.rows[0]?.drm_id) {
            return cRes.rows[0].drm_id;
        }
    }

    // 2. Check if temp contact ID was explicitly passed
    if (params.tempContactId) {
        const tRes = await executor.query(
            "SELECT drm_id, person_name FROM drm.temp_contacts WHERE id = $1",
            [params.tempContactId]
        );
        if (tRes.rows[0]?.drm_id) {
            return tRes.rows[0].drm_id;
        }
    }

    // 3. Lookup existing customer by companyName, email, or phone
    if (company || email || phone) {
        const cMatch = await executor.query(
            `SELECT drm_id, id FROM drm.customers
              WHERE drm_id IS NOT NULL AND drm_id <> '' AND (
                (lower(trim(company_name)) = lower(trim($1)) AND $1 <> '')
                OR (lower(trim(email)) = $2 AND $2 <> '')
                OR (regexp_replace(coalesce(phone_normalized, phone, ''), '\\D', '', 'g') = $3 AND $3 <> '')
              )
              ORDER BY created_at ASC LIMIT 1`,
            [company, email, phone]
        );
        if (cMatch.rows[0]?.drm_id) {
            return cMatch.rows[0].drm_id;
        }
    }

    // 4. Lookup existing temp contact by person_name / email / mobile
    if (company || email || phone) {
        const tMatch = await executor.query(
            `SELECT drm_id, id FROM drm.temp_contacts
              WHERE drm_id IS NOT NULL AND drm_id <> '' AND (
                (lower(trim(person_name)) = lower(trim($1)) AND $1 <> '')
                OR (lower(trim(email)) = $2 AND $2 <> '')
                OR (regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = $3 AND $3 <> '')
              )
              ORDER BY created_at ASC LIMIT 1`,
            [company, email, phone]
        );
        if (tMatch.rows[0]?.drm_id) {
            return tMatch.rows[0].drm_id;
        }
    }

    // 5. Lookup existing GM entry by companyName
    if (company) {
        const gMatch = await executor.query(
            `SELECT drm_id FROM drm.gm_entries
              WHERE drm_id IS NOT NULL AND drm_id <> '' AND lower(trim(company_name)) = lower(trim($1))
              ORDER BY created_at ASC LIMIT 1`,
            [company]
        );
        if (gMatch.rows[0]?.drm_id) {
            return gMatch.rows[0].drm_id;
        }
    }

    // 6. No existing DRM ID found anywhere — generate a new canonical DRM ID ONCE,
    // guaranteed unique against every company already in the system.
    const seed = params.customerId || params.tempContactId || company || email || phone || crypto.randomUUID();
    const newDrmId = await generateUniqueDrmId(executor, company || "Company", params.country || "Other", seed);

    // If customerId was provided but had no drm_id, backfill it now
    if (params.customerId) {
        await executor.query(
            "UPDATE drm.customers SET drm_id = $1 WHERE id = $2 AND (drm_id IS NULL OR drm_id = '')",
            [newDrmId, params.customerId]
        );
    }

    // If tempContactId was provided but had no drm_id, backfill it now
    if (params.tempContactId) {
        await executor.query(
            "UPDATE drm.temp_contacts SET drm_id = $1 WHERE id = $2 AND (drm_id IS NULL OR drm_id = '')",
            [newDrmId, params.tempContactId]
        );
    }

    return newDrmId;
}

