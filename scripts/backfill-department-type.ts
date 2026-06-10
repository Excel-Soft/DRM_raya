/**
 * One-time, idempotent back-fill of `drm.projects.department_type` for legacy
 * projects created before the structured routing column existed.
 *
 * Why: `resolveWorkflowRouting` (server/services/workflow-transition.service.ts)
 * only guesses a project's department from free-text names when the structured
 * `department_type` column is null — flagging it with `derivedFromText: true`.
 * Populating the column makes routing deterministic so it stops re-guessing.
 *
 * Resolution order mirrors `resolveWorkflowRouting` and the lazy back-fill in
 * `server/repositories/projects.repository.ts` exactly:
 *   1. SOFTWARE   — a software_workflows row exists (structural signal).
 *   2. DND        — the sanctioned text guess: name/invoice matches the DND hints
 *                   (minisite | mini site | listing | alibaba).
 *   3. PRODUCT_POSTING — a product_posting_workflows row exists OR the project is
 *                   linked to an invoice (the default product-posting subtype).
 *
 * Anything with none of those signals genuinely cannot be classified — it is
 * left NULL and reported, never force-guessed.
 *
 * Safe to run repeatedly: every UPDATE is guarded by `department_type is null`,
 * so already-classified rows are never touched.
 *
 * Run with:  npx tsx scripts/backfill-department-type.ts
 */
import { pool } from "../server/db";
import { resolveWorkflowRouting } from "../server/services/workflow-transition.service";

const DND_HINT_REGEX = "(minisite|mini site|listing|alibaba)";

async function backfill() {
  const client = await pool.connect();
  try {
    console.log("=== department_type back-fill ===\n");

    // 1. Ensure the column exists (idempotent) so the script is self-contained
    //    even on a DB where the lazy schema-ensure has never run.
    await client.query(
      `alter table drm.projects add column if not exists department_type text;`,
    );

    const before = await client.query<{ total: string; missing: string }>(
      `select count(*)::text as total,
              count(*) filter (where department_type is null)::text as missing
         from drm.projects;`,
    );
    const totalProjects = Number(before.rows[0]?.total ?? 0);
    const missingBefore = Number(before.rows[0]?.missing ?? 0);
    console.log(`Projects total:            ${totalProjects}`);
    console.log(`Missing department_type:   ${missingBefore}\n`);

    if (missingBefore === 0) {
      console.log("Nothing to back-fill — every project already has a stored department.\n");
      await reportRemaining(client);
      return;
    }

    await client.query("begin");

    // 1. SOFTWARE — structural: owns a software_workflows row.
    const software = await client.query(
      `update drm.projects p set department_type = 'SOFTWARE'
         where p.department_type is null
           and exists (select 1 from drm.software_workflows sw where sw.project_id = p.id);`,
    );

    // 2. DND — the single sanctioned text guess (matches resolveWorkflowRouting).
    const dnd = await client.query(
      `update drm.projects p set department_type = 'DND'
         where p.department_type is null
           and (
             lower(coalesce(p.name, '')) ~ '${DND_HINT_REGEX}'
             or exists (
               select 1 from drm.product_posting_invoices i
               where i.id = p.invoice_id
                 and lower(coalesce(i.project_name, '')) ~ '${DND_HINT_REGEX}'
             )
           );`,
    );

    // 3. PRODUCT_POSTING — has a product-posting workflow or an invoice link.
    const productPosting = await client.query(
      `update drm.projects p set department_type = 'PRODUCT_POSTING'
         where p.department_type is null
           and (
             exists (select 1 from drm.product_posting_workflows pw where pw.project_id = p.id)
             or p.invoice_id is not null
           );`,
    );

    await client.query("commit");

    console.log("Back-filled this run:");
    console.log(`  SOFTWARE (structural):        ${software.rowCount ?? 0}`);
    console.log(`  DND (text hint):              ${dnd.rowCount ?? 0}`);
    console.log(`  PRODUCT_POSTING (workflow/invoice): ${productPosting.rowCount ?? 0}\n`);

    await reportRemaining(client);
    await verifyDeterministic(client);
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore rollback errors */
    }
    console.error("Back-fill failed (no changes committed):", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Report the rows that genuinely could not be classified. These are left NULL on
 * purpose so routing can still fall back to a text guess at request time rather
 * than locking in a wrong department.
 */
async function reportRemaining(client: import("pg").PoolClient) {
  const remaining = await client.query<{ id: string; name: string | null }>(
    `select id, name from drm.projects
       where department_type is null
       order by created_at asc nulls last;`,
  );
  if (remaining.rowCount === 0) {
    console.log("Unclassifiable (left NULL):   0 — every project now has a stored department.\n");
    return;
  }
  console.log(
    `Unclassifiable (left NULL):   ${remaining.rowCount} — no software workflow, no DND hint, no product-posting workflow, no invoice:`,
  );
  for (const row of remaining.rows) {
    console.log(`    - ${row.id}  ${row.name ?? "(no name)"}`);
  }
  console.log("");
}

/**
 * Spot-check that back-filled rows now resolve deterministically: a row with a
 * stored department_type must return derivedFromText: false.
 */
async function verifyDeterministic(client: import("pg").PoolClient) {
  const sample = await client.query<{ department_type: string }>(
    `select distinct department_type from drm.projects where department_type is not null;`,
  );
  const offenders = sample.rows.filter(
    (r) => resolveWorkflowRouting({ departmentType: r.department_type }).derivedFromText !== false,
  );
  if (offenders.length === 0) {
    console.log(
      "Verification: every stored department_type resolves with derivedFromText=false ✓",
    );
  } else {
    console.warn(
      "Verification WARNING: these stored values still derive from text:",
      offenders.map((o) => o.department_type),
    );
  }
}

backfill();
