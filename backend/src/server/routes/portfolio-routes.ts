import { Router } from "express";
import { pool } from "../db";
import { portfolios } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import multer from "multer";
import path from "path";
import fs from "fs";

import { ActivityLogService } from "./services/activity-service";
import { AuditLogService } from "./services/audit-log.service";
import { requireRole } from "../middleware/auth.middleware";

const db = drizzle(pool);
const router = Router();

// MD-21: Portfolio Reserve — 48h time-boxed lock on a portfolio while it's
// being presented to a customer/company for booking.
const RESERVATION_LOCK_HOURS = 48;

const LEGACY_PORTFOLIO_ASSET_BASE =
    (process.env.LEGACY_PORTFOLIO_ASSET_BASE || "https://webexcels.pk/drm/assets/images/portfolio/").replace(/\/?$/, "/");

function legacyPortfolioAssetUrl(fileName?: string | null): string {
    if (!fileName || !String(fileName).trim()) return "";
    const trimmed = String(fileName).trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) return trimmed;
    return `${LEGACY_PORTFOLIO_ASSET_BASE}${trimmed}`;
}

function parseLegacySliderList(raw?: string | null): string[] {
    if (!raw) return [];
    return String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => legacyPortfolioAssetUrl(name));
}

function normalizePortfolioStatus(raw?: string | null): string {
    const s = (raw || "un-used").trim().toLowerCase();
    if (s === "used") return "Used";
    if (s === "un-used" || s === "unused") return "Un-Used";
    if (s === "rejected") return "Rejected";
    if (s === "changing") return "Changing";
    if (s === "reserved") return "Reserved";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

let portfolioInfraEnsured = false;
async function ensurePortfolioInfrastructure() {
    if (portfolioInfraEnsured) return;
    portfolioInfraEnsured = true;

    await pool.query(`
        alter table drm.portfolios
            add column if not exists created_by_user_id uuid references drm.users(id) on delete set null;
        alter table drm.portfolios
            add column if not exists status text default 'un-used';
    `);

    await pool.query(`
        create table if not exists drm.portfolio_reservations (
            id uuid primary key default gen_random_uuid(),
            portfolio_id uuid references drm.portfolios(id) on delete cascade,
            portfolio_ref text,
            customer_id uuid references drm.customers(id) on delete set null,
            company_name text,
            status text not null default 'active',
            reserved_by_user_id uuid not null references drm.users(id),
            reserved_at timestamptz not null default now(),
            expires_at timestamptz not null,
            resolved_by_user_id uuid references drm.users(id),
            resolved_at timestamptz,
            resolution_reason text,
            extension_count integer not null default 0,
            last_extended_at timestamptz,
            last_extended_by_user_id uuid references drm.users(id),
            last_extension_reason text,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );
        alter table drm.portfolio_reservations
            add column if not exists portfolio_ref text;
        alter table drm.portfolio_reservations
            alter column portfolio_id drop not null;
        alter table drm.portfolio_reservations
            drop constraint if exists portfolio_reservations_portfolio_id_fkey;
        alter table drm.portfolio_reservations
            add constraint portfolio_reservations_portfolio_id_fkey
                foreign key (portfolio_id) references drm.portfolios(id) on delete cascade;
        create index if not exists portfolio_reservations_portfolio_id_idx
            on drm.portfolio_reservations(portfolio_id);
        create index if not exists portfolio_reservations_portfolio_ref_idx
            on drm.portfolio_reservations(portfolio_ref);
        update drm.portfolio_reservations
           set portfolio_ref = portfolio_id::text
         where portfolio_ref is null and portfolio_id is not null;
    `);
}

async function fetchMergedPortfolios(): Promise<any[]> {
    const modernResult = await pool.query(`
        select
            p.id::text as id,
            p.keyword,
            p.main_category as "mainCategory",
            p.sub_category as "subCategory",
            p.server_link as "serverLink",
            p.top_header_image as "topHeaderImage",
            p.body_image as "bodyImage",
            p.full_image as "fullImage",
            p.sliders,
            p.status,
            p.created_at as "createdAt",
            p.updated_at as "updatedAt",
            p.created_by_user_id as "createdByUserId",
            coalesce(u.full_name, u.name) as "designBy",
            false as "legacyReadOnly",
            null::text as "legacyPk"
        from drm.portfolios p
        left join drm.users u on u.id = p.created_by_user_id
        order by p.created_at desc
    `);

    const legacyResult = await pool.query(`
        with cats as (
            select
                _legacy_pk::text as id,
                trim(name) as name,
                trim(coalesce(ref_id, '0')) as ref_id
            from legacy_archive.webxl_portfolio_categories
        )
        select
            ('legacy-portfolio-' || p._legacy_pk) as id,
            trim(p.keyword) as keyword,
            coalesce(mc.name, 'Uncategorized') as "mainCategory",
            nullif(trim(sc.name), '') as "subCategory",
            nullif(trim(p.server_link), '') as "serverLink",
            nullif(trim(p.top_header_img), '') as "topHeaderImageRaw",
            nullif(trim(p.body_img), '') as "bodyImageRaw",
            nullif(trim(p.main_img), '') as "fullImageRaw",
            nullif(trim(p.main_sliders), '') as "mainSlidersRaw",
            trim(p.status) as status,
            coalesce(nullif(trim(p.create_date), '')::timestamptz, now()) as "createdAt",
            coalesce(nullif(trim(p.create_date), '')::timestamptz, now()) as "updatedAt",
            m.modern_id::text as "createdByUserId",
            coalesce(u.full_name, u.name, 'Staff #' || trim(p.user_id)) as "designBy",
            true as "legacyReadOnly",
            p._legacy_pk::text as "legacyPk"
        from legacy_archive.webxl_portfolio p
        left join cats mc on mc.id = trim(p.category)
        left join cats sc on sc.id = trim(p.sub_cate)
        left join migration_meta.migration_legacy_ids m
            on m.legacy_table = 'webxl_user' and m.legacy_id = trim(p.user_id)
        left join drm.users u on u.id = m.modern_id::uuid
        order by coalesce(nullif(trim(p.create_date), '')::timestamptz, now()) desc
    `);

    const modern = modernResult.rows.map((row) => ({
        ...row,
        status: normalizePortfolioStatus(row.status),
        sliders: Array.isArray(row.sliders) ? row.sliders : [],
    }));

    const legacy = legacyResult.rows.map((row) => ({
        id: row.id,
        keyword: row.keyword,
        mainCategory: row.mainCategory,
        subCategory: row.subCategory,
        serverLink: row.serverLink,
        topHeaderImage: legacyPortfolioAssetUrl(row.topHeaderImageRaw),
        bodyImage: legacyPortfolioAssetUrl(row.bodyImageRaw),
        fullImage: legacyPortfolioAssetUrl(row.fullImageRaw),
        sliders: parseLegacySliderList(row.mainSlidersRaw),
        status: normalizePortfolioStatus(row.status),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdByUserId: row.createdByUserId,
        designBy: row.designBy,
        legacyReadOnly: true,
        legacyPk: row.legacyPk,
    }));

    const combined = [...modern, ...legacy];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
}

async function fetchPortfolioById(id: string): Promise<any | null> {
    const all = await fetchMergedPortfolios();
    return all.find((p) => p.id === id) ?? null;
}

// Live-computed status: the DB row only ever stores a human decision
// ('active' | 'confirmed' | 'rejected'). Whether an 'active' reservation has
// auto-released after 48h with no verification action is derived here by
// comparing expires_at to now(), not by a background job flipping a flag —
// same lazy-expiry approach as server/utils/service-expiry.ts.
function computeReservationLiveStatus(row: { status: string; expiresAt: string | Date }): "active" | "confirmed" | "rejected" | "expired" {
    if (row.status === "active" && new Date(row.expiresAt).getTime() <= Date.now()) return "expired";
    return row.status as "active" | "confirmed" | "rejected";
}

function isLockingStatus(liveStatus: string): boolean {
    return liveStatus === "active" || liveStatus === "confirmed";
}

router.use(async (_req, _res, next) => {
    try {
        await ensurePortfolioInfrastructure();
        next();
    } catch (err) {
        next(err);
    }
});

// Directory where uploaded portfolio images are stored on disk.
// Served statically from /uploads (see server/index.ts) so the saved URLs are directly browsable/downloadable.
const PORTFOLIO_UPLOAD_DIR = path.join(process.cwd(), "uploads", "portfolio");
fs.mkdirSync(PORTFOLIO_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PORTFOLIO_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const PORTFOLIO_MAX_IMAGE_BYTES = 40 * 1024 * 1024; // 40MB per image (matches legacy DRM uploads)

const upload = multer({
    storage,
    limits: { fileSize: PORTFOLIO_MAX_IMAGE_BYTES },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image files are allowed"));
            return;
        }
        cb(null, true);
    },
});

const portfolioUpload = upload.fields([
    { name: "topHeaderImage", maxCount: 1 },
    { name: "bodyImage", maxCount: 1 },
    { name: "fullImage", maxCount: 1 },
    { name: "sliders", maxCount: 20 },
]);

const toPublicUrl = (file?: Express.Multer.File) => (file ? `/uploads/portfolio/${file.filename}` : "");

// GET all portfolios (modern + legacy archive)
router.get("/", async (_req, res) => {
    try {
        const results = await fetchMergedPortfolios();
        res.json(results);
    } catch (err: any) {
        console.error("Error fetching portfolios:", err);
        res.status(500).json({ success: false, message: "Failed to fetch portfolios" });
    }
});

router.get("/test", (req, res) => res.json({ ok: true }));

// Main / sub categories from legacy portfolio taxonomy (webxl_portfolio_categories)
router.get("/categories", async (_req, res) => {
    try {
        const { rows } = await pool.query<{
            _legacy_pk: string;
            name: string;
            ref_id: string | null;
        }>(`
          SELECT _legacy_pk, trim(name) AS name, trim(coalesce(ref_id, '0')) AS ref_id
            FROM legacy_archive.webxl_portfolio_categories
           ORDER BY _legacy_pk::int
        `);

        const mainCategories = rows
            .filter((r) => !r.ref_id || r.ref_id === "0")
            .map((r) => ({ id: String(r._legacy_pk), name: r.name }));

        const subCategoriesByMainId: Record<string, { id: string; name: string }[]> = {};
        for (const main of mainCategories) {
            subCategoriesByMainId[main.id] = rows
                .filter((r) => r.ref_id === main.id)
                .map((r) => ({ id: String(r._legacy_pk), name: r.name }));
        }

        res.json({ mainCategories, subCategoriesByMainId });
    } catch (error) {
        console.error("Error fetching portfolio categories:", error);
        res.status(500).json({ error: "Failed to fetch portfolio categories" });
    }
});

// POST new portfolio — real multer-backed image upload (disk storage), replacing the previous mock that
// discarded the uploaded files and stored empty strings.
router.post("/", (req, res, next) => {
    portfolioUpload(req, res, (err: any) => {
        if (err) {
            console.error("Error uploading portfolio images:", err);
            if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    success: false,
                    message: "Each image must be 40MB or smaller.",
                });
            }
            return res.status(400).json({ success: false, message: err.message || "Failed to upload images" });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { keyword, mainCategory, subCategory, serverLink } = req.body;
        const files = (req.files || {}) as Record<string, Express.Multer.File[]>;

        const topHeaderImage = toPublicUrl(files.topHeaderImage?.[0]);
        const bodyImage = toPublicUrl(files.bodyImage?.[0]);
        const fullImage = toPublicUrl(files.fullImage?.[0]);
        const sliders = (files.sliders || []).map((f) => toPublicUrl(f));

        const [newPortfolio] = await db.insert(portfolios).values({
            keyword,
            mainCategory,
            subCategory,
            serverLink,
            topHeaderImage,
            bodyImage,
            fullImage,
            sliders,
            createdByUserId: req.user?.userId ?? null,
            status: "un-used",
        }).returning();

        let designBy: string | null = null;
        if (req.user?.userId) {
            const nameRow = await pool.query(
                `select coalesce(full_name, name) as name from drm.users where id = $1`,
                [req.user.userId],
            );
            designBy = nameRow.rows[0]?.name ?? null;
        }

        await ActivityLogService.log({
            userId: req.user?.userId || "SYSTEM",
            action: "PORTFOLIO_CREATED",
            resourceType: "portfolio",
            resourceId: newPortfolio.id,
            details: `Keyword: ${newPortfolio.keyword}, Category: ${newPortfolio.mainCategory}`,
        });

        res.json({
            success: true,
            data: {
                ...newPortfolio,
                status: normalizePortfolioStatus(newPortfolio.status),
                designBy,
                legacyReadOnly: false,
            },
        });
    } catch (err: any) {
        console.error("Error creating portfolio:", err);
        res.status(500).json({ success: false, message: err?.message || "Failed to create portfolio" });
    }
});

// GET all reservations, with live-computed status. Used both to render the
// "Reserved" badge/count on portfolio-list.tsx and the Verification Manager's
// confirm/reject/extend queue.
router.get("/reservations", async (req, res) => {
    try {
        const result = await pool.query(`
            select
                r.id,
                coalesce(r.portfolio_ref, r.portfolio_id::text) as "portfolioId",
                r.customer_id as "customerId",
                r.company_name as "companyName", r.status,
                r.reserved_by_user_id as "reservedByUserId", ru.full_name as "reservedByName",
                r.reserved_at as "reservedAt", r.expires_at as "expiresAt",
                r.resolved_by_user_id as "resolvedByUserId", r.resolved_at as "resolvedAt",
                r.resolution_reason as "resolutionReason", r.extension_count as "extensionCount",
                r.last_extended_at as "lastExtendedAt", r.last_extension_reason as "lastExtensionReason",
                c.company_name as "customerCompanyName"
            from drm.portfolio_reservations r
            left join drm.users ru on ru.id = r.reserved_by_user_id
            left join drm.customers c on c.id = r.customer_id
            order by r.reserved_at desc
        `);
        const rows = result.rows.map((row: any) => ({
            ...row,
            liveStatus: computeReservationLiveStatus(row),
        }));
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching portfolio reservations:", err);
        res.status(500).json({ success: false, message: "Failed to fetch portfolio reservations" });
    }
});

// POST reserve a portfolio for a customer/company — starts a 48h lock.
router.post("/:portfolioId/reserve", async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
        const { portfolioId } = req.params;
        const { customerId, companyName } = req.body || {};

        const isLegacy = portfolioId.startsWith("legacy-portfolio-");
        if (isLegacy) {
            const legacyPk = portfolioId.slice("legacy-portfolio-".length);
            const legacyCheck = await pool.query(
                `select _legacy_pk from legacy_archive.webxl_portfolio where _legacy_pk = $1`,
                [legacyPk],
            );
            if (legacyCheck.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Portfolio not found" });
            }
        } else {
            const portfolioCheck = await pool.query(`select id from drm.portfolios where id = $1`, [portfolioId]);
            if (portfolioCheck.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Portfolio not found" });
            }
        }

        const existing = await pool.query(
            `select id, status, expires_at as "expiresAt" from drm.portfolio_reservations
             where coalesce(portfolio_ref, portfolio_id::text) = $1
             order by reserved_at desc limit 1`,
            [portfolioId]
        );
        if (existing.rows[0] && isLockingStatus(computeReservationLiveStatus(existing.rows[0] as any))) {
            return res.status(409).json({ success: false, message: "This portfolio is already reserved/locked" });
        }

        const reservedAt = new Date();
        const expiresAt = new Date(reservedAt.getTime() + RESERVATION_LOCK_HOURS * 60 * 60 * 1000);
        const inserted = await pool.query(
            `insert into drm.portfolio_reservations
                (portfolio_id, portfolio_ref, customer_id, company_name, status, reserved_by_user_id, reserved_at, expires_at)
             values ($1, $2, $3, $4, 'active', $5, $6, $7)
             returning id,
                      coalesce(portfolio_ref, portfolio_id::text) as "portfolioId",
                      status, reserved_at as "reservedAt", expires_at as "expiresAt"`,
            [
                isLegacy ? null : portfolioId,
                portfolioId,
                customerId || null,
                companyName || null,
                req.user.userId,
                reservedAt,
                expiresAt,
            ]
        );
        const reservation = inserted.rows[0];

        await AuditLogService.record({
            actorUserId: req.user.userId,
            activeRole: req.user.activeRoleId || req.user.roleId,
            action: "PORTFOLIO_RESERVATION_CREATED",
            module: "portfolio",
            entityType: "portfolio_reservation",
            entityId: reservation.id,
            after: reservation,
            reason: companyName ? `Reserved for ${companyName}` : undefined,
            req,
        });

        res.json({ success: true, data: { ...reservation, liveStatus: "active" } });
    } catch (err: any) {
        console.error("Error creating portfolio reservation:", err);
        res.status(500).json({ success: false, message: err?.message || "Failed to reserve portfolio" });
    }
});

async function getReservationOr404(id: string) {
    const result = await pool.query(
        `select id, portfolio_id as "portfolioId", customer_id as "customerId", company_name as "companyName",
                status, reserved_by_user_id as "reservedByUserId", reserved_at as "reservedAt", expires_at as "expiresAt",
                resolved_by_user_id as "resolvedByUserId", resolved_at as "resolvedAt", resolution_reason as "resolutionReason",
                extension_count as "extensionCount", last_extended_at as "lastExtendedAt", last_extension_reason as "lastExtensionReason"
         from drm.portfolio_reservations where id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

// Verification Manager confirms the reservation — the portfolio is now booked
// for this customer/company and is no longer subject to the 48h auto-release.
router.post("/reservations/:id/confirm", requireRole("verification_manager", "admin"), async (req, res) => {
    try {
        const reservation = await getReservationOr404(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });
        const liveStatus = computeReservationLiveStatus(reservation);
        if (liveStatus !== "active") {
            return res.status(409).json({ success: false, message: `Cannot confirm — reservation is already ${liveStatus}` });
        }

        const updated = await pool.query(
            `update drm.portfolio_reservations
             set status = 'confirmed', resolved_by_user_id = $1, resolved_at = now(), updated_at = now()
             where id = $2
             returning id, status, resolved_at as "resolvedAt"`,
            [req.user!.userId, reservation.id]
        );

        await AuditLogService.record({
            actorUserId: req.user!.userId,
            activeRole: req.user!.activeRoleId || req.user!.roleId,
            action: "PORTFOLIO_RESERVATION_CONFIRMED",
            module: "portfolio",
            entityType: "portfolio_reservation",
            entityId: reservation.id,
            previousStatus: "active",
            nextStatus: "confirmed",
            before: reservation,
            after: updated.rows[0],
            req,
        });

        res.json({ success: true, data: { ...updated.rows[0], liveStatus: "confirmed" } });
    } catch (err: any) {
        console.error("Error confirming portfolio reservation:", err);
        res.status(500).json({ success: false, message: err?.message || "Failed to confirm reservation" });
    }
});

// Verification Manager rejects the reservation — releases the lock immediately.
router.post("/reservations/:id/reject", requireRole("verification_manager", "admin"), async (req, res) => {
    try {
        const reservation = await getReservationOr404(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });
        const liveStatus = computeReservationLiveStatus(reservation);
        if (liveStatus !== "active") {
            return res.status(409).json({ success: false, message: `Cannot reject — reservation is already ${liveStatus}` });
        }
        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

        const updated = await pool.query(
            `update drm.portfolio_reservations
             set status = 'rejected', resolved_by_user_id = $1, resolved_at = now(), resolution_reason = $2, updated_at = now()
             where id = $3
             returning id, status, resolved_at as "resolvedAt", resolution_reason as "resolutionReason"`,
            [req.user!.userId, reason || null, reservation.id]
        );

        await AuditLogService.record({
            actorUserId: req.user!.userId,
            activeRole: req.user!.activeRoleId || req.user!.roleId,
            action: "PORTFOLIO_RESERVATION_REJECTED",
            module: "portfolio",
            entityType: "portfolio_reservation",
            entityId: reservation.id,
            previousStatus: "active",
            nextStatus: "rejected",
            before: reservation,
            after: updated.rows[0],
            reason: reason || undefined,
            req,
        });

        res.json({ success: true, data: { ...updated.rows[0], liveStatus: "rejected" } });
    } catch (err: any) {
        console.error("Error rejecting portfolio reservation:", err);
        res.status(500).json({ success: false, message: err?.message || "Failed to reject reservation" });
    }
});

// Verification Manager extends the lock before it expires. MD-21 requires a
// reason, a new expiry time, the acting user, and an audit log entry for every
// extension. Each extension is capped at 48h from the moment it's granted —
// bounding every lock period the same way, so extending never creates a
// permanent/indefinite lock.
router.post("/reservations/:id/extend", requireRole("verification_manager", "admin"), async (req, res) => {
    try {
        const reservation = await getReservationOr404(req.params.id);
        if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });
        const liveStatus = computeReservationLiveStatus(reservation);
        if (liveStatus !== "active") {
            return res.status(409).json({ success: false, message: `Cannot extend — reservation is already ${liveStatus}` });
        }

        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
        if (!reason) {
            return res.status(400).json({ success: false, message: "An extension reason is required" });
        }

        const requestedHours = Number(req.body?.hours);
        const hours = Number.isFinite(requestedHours) && requestedHours > 0
            ? Math.min(requestedHours, RESERVATION_LOCK_HOURS)
            : RESERVATION_LOCK_HOURS;

        const newExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

        const updated = await pool.query(
            `update drm.portfolio_reservations
             set expires_at = $1, extension_count = extension_count + 1,
                 last_extended_at = now(), last_extended_by_user_id = $2, last_extension_reason = $3,
                 updated_at = now()
             where id = $4
             returning id, status, expires_at as "expiresAt", extension_count as "extensionCount"`,
            [newExpiresAt, req.user!.userId, reason, reservation.id]
        );

        await AuditLogService.record({
            actorUserId: req.user!.userId,
            activeRole: req.user!.activeRoleId || req.user!.roleId,
            action: "PORTFOLIO_RESERVATION_EXTENDED",
            module: "portfolio",
            entityType: "portfolio_reservation",
            entityId: reservation.id,
            before: { expiresAt: reservation.expiresAt },
            after: { expiresAt: newExpiresAt },
            reason,
            req,
        });

        res.json({ success: true, data: { ...updated.rows[0], liveStatus: "active" } });
    } catch (err: any) {
        console.error("Error extending portfolio reservation:", err);
        res.status(500).json({ success: false, message: err?.message || "Failed to extend reservation" });
    }
});

// GET one portfolio by id (uuid or legacy-portfolio-{pk}) — must be last to avoid shadowing /categories, /reservations, etc.
router.get("/:portfolioId", async (req, res) => {
    try {
        const item = await fetchPortfolioById(req.params.portfolioId);
        if (!item) return res.status(404).json({ success: false, message: "Portfolio not found" });
        res.json(item);
    } catch (err: any) {
        console.error("Error fetching portfolio:", err);
        res.status(500).json({ success: false, message: "Failed to fetch portfolio" });
    }
});

export default router;
