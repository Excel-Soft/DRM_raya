import { db } from "../../db";
import {
  linkReports,
  linkReportCommissionVerifications,
  productPostingEvidenceLinks,
  projects,
  customers,
  users,
  targetSystemUserTargets,
  notifications,
} from "@shared/schema";
import { eq, and, gte, lte, inArray, asc } from "drizzle-orm";

/**
 * Real implementation of the Link Report (legacy's linkreport.php + func.php's
 * user_id_links_view handler). Replaces a stub that resolved `undefined` and
 * crashed every request with a 500 — the route layer (team-report-link-report-routes.ts)
 * and frontend were already complete, just calling into nothing.
 *
 * Legacy sourced this from webxl_task_links (one row per link posted against a
 * task). linkReports looked like the obvious modern equivalent (same shape,
 * already Drizzle-declared with a full commission-verification table beside
 * it) but turned out to be entirely unused by the live app — 0 rows, nothing
 * writes to it. The real links Product Posting staff submit land in
 * product_posting_evidence_links instead (confirmed live), so the listing
 * reads from there, joined to projects/customers for the company name.
 * linkReportCommissionVerifications is still used as-is for verification
 * tracking — it just stores opaque link ids in a jsonb array, so it doesn't
 * care which table those ids came from.
 */

export interface LinkReportUser {
  id: string;
  name: string;
  fullName?: string | null;
  email?: string;
}

export async function listUsersForReport(allowed: string[] | null): Promise<LinkReportUser[]> {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, username: users.username, email: users.email })
    .from(users)
    .where(allowed ? inArray(users.id, allowed) : undefined);
  return rows
    .map((u) => ({ id: u.id, name: u.fullName || u.username, fullName: u.fullName, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface LinkReportRow {
  id: string;
  displayId: string;
  company: string;
  links: string;
  date: string | null;
  sourceModule: string;
  sourceRecordId: string | null;
  verifyStatus: string;
  verifyNote: string | null;
}

export async function listLinkReport(userId: string, startDate: string, endDate: string): Promise<LinkReportRow[]> {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const rows = await db
    .select({
      id: productPostingEvidenceLinks.id,
      displayId: productPostingEvidenceLinks.displayId,
      companyName: customers.companyName,
      url: productPostingEvidenceLinks.url,
      createdAt: productPostingEvidenceLinks.createdAt,
      taskId: productPostingEvidenceLinks.taskId,
      verifyStatus: productPostingEvidenceLinks.verifyStatus,
      verifyNote: productPostingEvidenceLinks.verifyNote,
    })
    .from(productPostingEvidenceLinks)
    .leftJoin(projects, eq(projects.id, productPostingEvidenceLinks.projectId))
    .leftJoin(customers, eq(customers.id, projects.customerId))
    .where(
      and(
        eq(productPostingEvidenceLinks.createdByUserId, userId),
        gte(productPostingEvidenceLinks.createdAt, start),
        lte(productPostingEvidenceLinks.createdAt, end),
      ),
    )
    .orderBy(asc(productPostingEvidenceLinks.createdAt));
  return rows.map((r) => ({
    id: r.id,
    displayId: String(r.displayId),
    company: r.companyName ?? "-",
    links: r.url,
    date: r.createdAt ? r.createdAt.toISOString() : null,
    sourceModule: "product_posting",
    sourceRecordId: r.taskId,
    verifyStatus: r.verifyStatus,
    verifyNote: r.verifyNote,
  }));
}

export interface LinkReportSummary {
  totalLinks: number;
  totalDuplicates: number;
  actualLinks: number;
  reward: number;
}

/**
 * Legacy's exact formula from func.php: totalDuplicates counts DISTINCT link
 * URLs that occur more than once (not the number of extra rows) — e.g. a URL
 * repeated 3 times counts as 1 duplicate, not 2. actualLinks = totalLinks -
 * totalDuplicates, clamped to 0. Reproduced as-is rather than "fixed" since
 * the ask was specifically to match func.php's own calculation.
 */
function countDistinctDuplicatedUrls(urls: string[]): number {
  const counts = new Map<string, number>();
  for (const u of urls) {
    const key = u.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let distinctDuplicated = 0;
  for (const c of Array.from(counts.values())) {
    if (c > 1) distinctDuplicated++;
  }
  return distinctDuplicated;
}

/**
 * Tiered reward lookup — legacy's SalaryMakeFunPPppComm2(), minus the ~15
 * hardcoded special-case users by old numeric id (no reliable mapping to
 * modern accounts, so not reproduced). Finds the user's currently-active
 * "PP Link" category assignment whose [price, maxPrice] range contains
 * actualLinks, returning that assignment's reward; 0 if none matches.
 */
export async function getPpLinkReward(userId: string, actualLinks: number): Promise<number> {
  const rows = await db
    .select()
    .from(targetSystemUserTargets)
    .where(and(eq(targetSystemUserTargets.userId, userId), eq(targetSystemUserTargets.category, "PP Link")));

  const today = new Date();
  const candidates = rows
    .filter((r) => {
      const afterStart = !r.startDate || new Date(r.startDate) <= today;
      const beforeEnd = !r.endDate || new Date(r.endDate) >= today;
      return afterStart && beforeEnd;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const r of candidates) {
    const price = Number(r.price);
    const maxPrice = Number(r.maxPrice);
    if (actualLinks >= price && actualLinks <= maxPrice) {
      return Number(r.reward);
    }
  }
  return 0;
}

export async function getLinkReportSummary(userId: string, startDate: string, endDate: string): Promise<LinkReportSummary> {
  const rows = await listLinkReport(userId, startDate, endDate);
  const totalLinks = rows.length;
  const totalDuplicates = countDistinctDuplicatedUrls(rows.map((r) => r.links));
  const actualLinks = Math.max(0, totalLinks - totalDuplicates);
  const reward = await getPpLinkReward(userId, actualLinks);
  return { totalLinks, totalDuplicates, actualLinks, reward };
}

/** Per-link reviewer verdict — legacy's per-row Verify/Reject on webxl_task_links. */
export async function verifyLink(params: {
  linkId: string;
  status: "Verified" | "Rejected";
  verifiedByUserId: string;
  note?: string;
}) {
  const [updated] = await db
    .update(productPostingEvidenceLinks)
    .set({
      verifyStatus: params.status,
      verifyNote: params.note ?? null,
      verifiedByUserId: params.verifiedByUserId,
      verifiedAt: new Date(),
    })
    .where(eq(productPostingEvidenceLinks.id, params.linkId))
    .returning();
  if (!updated) {
    const err: any = new Error("Link not found.");
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

export async function getVerification(userId: string, startDate: string, endDate: string) {
  const [row] = await db
    .select()
    .from(linkReportCommissionVerifications)
    .where(
      and(
        eq(linkReportCommissionVerifications.userId, userId),
        eq(linkReportCommissionVerifications.startDate, startDate),
        eq(linkReportCommissionVerifications.endDate, endDate),
      ),
    );
  return row ?? null;
}

/**
 * Creates the commission request — the manager/admin action. Recomputes
 * totalLinks/reward server-side (never trusts a client-supplied count for a
 * financial figure); status starts "Pending" until the link-submitter
 * themselves confirms via confirmCommission. A real notification is created
 * for them at the same time, matching the same two-step pattern already used
 * for GM/BV commission verification.
 */
export async function verifyCommission(params: {
  userId: string;
  verifiedByUserId: string;
  startDate: string;
  endDate: string;
}) {
  const existing = await getVerification(params.userId, params.startDate, params.endDate);
  if (existing) {
    const err: any = new Error("Commission already verified for this period.");
    err.statusCode = 400;
    throw err;
  }

  const rows = await listLinkReport(params.userId, params.startDate, params.endDate);
  if (rows.length === 0) {
    const err: any = new Error("No links found for this user in this date range.");
    err.statusCode = 400;
    throw err;
  }
  const summary = await getLinkReportSummary(params.userId, params.startDate, params.endDate);

  const [created] = await db
    .insert(linkReportCommissionVerifications)
    .values({
      userId: params.userId,
      verifiedByUserId: params.verifiedByUserId,
      startDate: params.startDate,
      endDate: params.endDate,
      linkReportIds: rows.map((r) => r.id),
      totalLinks: summary.actualLinks,
      reward: String(summary.reward),
      status: "Pending",
    })
    .returning();

  await db.insert(notifications).values({
    userId: params.userId,
    message: `Your Product Posting link commission for ${params.startDate} to ${params.endDate} has been calculated (${summary.actualLinks} links, reward ${summary.reward}). Please confirm it.`,
    type: "INFO",
    readStatus: "UNREAD",
    targetUrl: "/posting-data/link-report",
    module: "link-report-commission",
    entityType: "LinkReportCommissionVerification",
    entityId: created.id,
  });

  return created;
}

/** Only the record's own userId may confirm — the link-submitter accepting their own commission. */
export async function confirmCommission(verificationId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(linkReportCommissionVerifications)
    .where(eq(linkReportCommissionVerifications.id, verificationId));
  if (!existing) {
    const err: any = new Error("Verification record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (existing.userId !== userId) {
    const err: any = new Error("You can only confirm your own commission.");
    err.statusCode = 403;
    throw err;
  }
  if (existing.status === "Verified") {
    return existing;
  }
  const [updated] = await db
    .update(linkReportCommissionVerifications)
    .set({ status: "Verified", confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(linkReportCommissionVerifications.id, verificationId))
    .returning();
  return updated;
}

export async function createLinkReport(params: {
  submittedByUserId: string;
  companyName: string;
  linkUrl: string;
  companyId: string | null;
}) {
  const [created] = await db
    .insert(linkReports)
    .values({
      submittedByUserId: params.submittedByUserId,
      companyName: params.companyName,
      linkUrl: params.linkUrl,
      companyId: params.companyId,
      sourceModule: "manual",
    })
    .returning();
  return created;
}
