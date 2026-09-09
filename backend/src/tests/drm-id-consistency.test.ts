import { describe, it, expect } from "vitest";
import { generateDrmId, resolveOrCreateCanonicalDrmId, generateUniqueDrmId } from "./utils/drm-id-utils";
import { pool } from "./db";

describe("DRM ID Consistency and Immutability Tests", () => {
  it("should generate deterministic DRM IDs for string seeds", () => {
    const drmId1 = generateDrmId("Acme Corporation", "Pakistan", "Acme Corporation");
    const drmId2 = generateDrmId("Acme Corporation", "Pakistan", "Acme Corporation");
    expect(drmId1).toBe(drmId2);
    expect(drmId1).toMatch(/^pkac\d{4}$/);
  });

  it("should resolve existing DRM ID from customer record", async () => {
    const testCompany = `Test Company ${Date.now()}`;
    const testEmail = `test_${Date.now()}@domain.com`;

    // 1. Resolve or create canonical DRM ID
    const drmId1 = await resolveOrCreateCanonicalDrmId(pool, {
      companyName: testCompany,
      email: testEmail,
      country: "Pakistan",
    });
    expect(drmId1).toBeDefined();
    expect(drmId1.length).toBeGreaterThan(4);

    // 2. Second lookup with same details must return the EXACT SAME DRM ID
    const drmId2 = await resolveOrCreateCanonicalDrmId(pool, {
      companyName: testCompany,
      email: testEmail,
      country: "Pakistan",
    });
    expect(drmId2).toBe(drmId1);
  });

  it("should keep DRM ID consistent when creating GM and looking up in Duplicate Check", async () => {
    const testCompany = `GM Check Test ${Date.now()}`;
    const testEmail = `gm_check_${Date.now()}@domain.com`;

    // Fetch a valid user ID for FK constraint
    const userRes = await pool.query(`SELECT id FROM drm.users LIMIT 1`);
    const validUserId = userRes.rows[0]?.id;
    expect(validUserId).toBeDefined();

    // Resolve DRM ID as happens in GM creation
    const drmId = await resolveOrCreateCanonicalDrmId(pool, {
      companyName: testCompany,
      email: testEmail,
      country: "UAE",
    });

    // Insert dummy customer & GM record with this DRM ID
    const custRes = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
       VALUES ($1, $1, $2, '1234567890', 'Other', 'A', $3)
       RETURNING id`,
      [testCompany, testEmail, drmId]
    );
    const customerId = custRes.rows[0].id;

    await pool.query(
      `INSERT INTO drm.gm_entries (company_name, drm_id, customer_id, package_type, entry_type, amount, created_by)
       VALUES ($1, $2, $3, 'Standard', 'GM', 100, $4)`,
      [testCompany, drmId, customerId, validUserId]
    );

    // Verify Duplicate Check query returns the EXACT SAME drm_id
    const dupRes = await pool.query(
      `SELECT c.id, c.drm_id as "drmId", c.company_name as "companyName"
         FROM drm.customers c
        WHERE lower(trim(c.company_name)) = lower(trim($1))`,
      [testCompany]
    );

    expect(dupRes.rows.length).toBeGreaterThan(0);
    expect(dupRes.rows[0].drmId).toBe(drmId);

    // Clean up test rows
    await pool.query(`DELETE FROM drm.gm_entries WHERE customer_id = $1`, [customerId]);
    await pool.query(`DELETE FROM drm.customers WHERE id = $1`, [customerId]);
  });

  it("should return the correct record when searching specifically by DRM ID in Duplicate Check", async () => {
    const testCompany = `DRM ID Search Test ${Date.now()}`;
    const testEmail = `drm_search_${Date.now()}@domain.com`;

    const drmId = await resolveOrCreateCanonicalDrmId(pool, {
      companyName: testCompany,
      email: testEmail,
      country: "Pakistan",
    });

    const custRes = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
       VALUES ($1, $1, $2, '9876543210', 'Other', 'B', $3)
       RETURNING id`,
      [testCompany, testEmail, drmId]
    );
    const customerId = custRes.rows[0].id;

    // Search by DRM ID in Duplicate Check query
    const dupRes = await pool.query(
      `SELECT c.id, c.drm_id as "drmId", c.company_name as "companyName"
         FROM drm.customers c
        WHERE ($1 <> '' and (c.company_name ilike ('%' || $1 || '%') or c.drm_id ilike ('%' || $1 || '%')))`,
      [drmId]
    );

    expect(dupRes.rows.length).toBeGreaterThan(0);
    expect(dupRes.rows[0].drmId).toBe(drmId);
    expect(dupRes.rows[0].companyName).toBe(testCompany);

    // Clean up
    await pool.query(`DELETE FROM drm.customers WHERE id = $1`, [customerId]);
  });

  it("never returns a DRM ID that's already taken by a different company, even when the natural hash collides", async () => {
    // generateDrmId's 4-digit suffix is only a 10,000-value space per
    // country+initials bucket, so two different companies/seeds can legitimately
    // hash to the same candidate. Force that exact collision and prove the
    // generator detects it and returns something else instead of a duplicate.
    const seedA = `collision-seed-A-${Date.now()}`;
    const collidingCandidate = generateDrmId("Collision Co", "Pakistan", seedA);

    const custRes = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
       VALUES ($1, $1, $2, '1112223333', 'Other', 'C', $3)
       RETURNING id`,
      [`Collision Co Owner ${Date.now()}`, `collision_${Date.now()}@domain.com`, collidingCandidate]
    );
    const takenById = custRes.rows[0].id;

    try {
      // Ask for the exact same seed/company/country that would naturally produce
      // `collidingCandidate` again — the taken slot must be skipped.
      const resolved = await generateUniqueDrmId(pool, "Collision Co", "Pakistan", seedA);
      expect(resolved).not.toBe(collidingCandidate);

      // And the ID it did return must not itself be in use anywhere.
      const clash = await pool.query(
        `SELECT 1 FROM drm.customers WHERE drm_id = $1
         UNION ALL SELECT 1 FROM drm.temp_contacts WHERE drm_id = $1
         UNION ALL SELECT 1 FROM drm.gm_entries WHERE drm_id = $1`,
        [resolved]
      );
      expect(clash.rows.length).toBe(0);
    } finally {
      await pool.query(`DELETE FROM drm.customers WHERE id = $1`, [takenById]);
    }
  });

  it("resolveOrCreateCanonicalDrmId never assigns a brand-new company an already-used DRM ID, even on a natural hash collision", async () => {
    const newCompanyName = `Dup Risk New Co ${Date.now()}`;
    // This is exactly the candidate resolveOrCreateCanonicalDrmId's generation step
    // would naturally produce for `newCompanyName` (no customerId/email/phone given,
    // so it seeds on the company name itself). Simulate an unrelated OTHER company
    // having already claimed that exact ID.
    const naturalCandidate = generateDrmId(newCompanyName, "Pakistan", newCompanyName);

    const otherCompanyName = `Some Unrelated Co ${Date.now()}`;
    const custRes = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
       VALUES ($1, $1, $2, '4445556666', 'Other', 'C', $3)
       RETURNING id`,
      [otherCompanyName, `dupriskother_${Date.now()}@domain.com`, naturalCandidate]
    );
    const otherCompanyId = custRes.rows[0].id;

    try {
      // newCompanyName has no existing record anywhere, so this must fall through
      // to generation — and must NOT return naturalCandidate, since that ID now
      // belongs to a different company.
      const resolved = await resolveOrCreateCanonicalDrmId(pool, {
        companyName: newCompanyName,
        country: "Pakistan",
      });
      expect(resolved).not.toBe(naturalCandidate);
      // No customerId/tempContactId was passed, so step 6 only returns the ID —
      // it doesn't create or backfill any row for newCompanyName, nothing else to clean up.
    } finally {
      await pool.query(`DELETE FROM drm.customers WHERE id = $1`, [otherCompanyId]);
    }
  });
});
