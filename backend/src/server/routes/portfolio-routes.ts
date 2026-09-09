import { Router } from "express";
import { pool } from "../db";
import { portfolios } from "@shared/schema";
import { sql, desc } from "drizzle-orm";
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

let reservationInfraEnsured = false;
async function ensurePortfolioReservationInfrastructure() {
    if (reservationInfraEnsured) return;
    reservationInfraEnsured = true;
    await pool.query(`
        create table if not exists drm.portfolio_reservations (
            id uuid primary key default gen_random_uuid(),
            portfolio_id uuid not null references drm.portfolios(id) on delete cascade,
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
        create index if not exists portfolio_reservations_portfolio_id_idx
            on drm.portfolio_reservations(portfolio_id);
    `);
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
        await ensurePortfolioReservationInfrastructure();
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

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
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

// GET all portfolios
router.get("/", async (req, res) => {
    try {
        const results = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));
        res.json(results);
    } catch (err: any) {
        console.error("Error fetching portfolios:", err);
        res.status(500).json({ success: false, message: "Failed to fetch portfolios" });
    }
});

router.get("/test", (req, res) => res.json({ ok: true }));

// POST new portfolio — real multer-backed image upload (disk storage), replacing the previous mock that
// discarded the uploaded files and stored empty strings.
router.post("/", (req, res, next) => {
    portfolioUpload(req, res, (err: any) => {
        if (err) {
            console.error("Error uploading portfolio images:", err);
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
        }).returning();

        await ActivityLogService.log({
            userId: req.user?.userId || "SYSTEM",
            action: "PORTFOLIO_CREATED",
            resourceType: "portfolio",
            resourceId: newPortfolio.id,
            details: `Keyword: ${newPortfolio.keyword}, Category: ${newPortfolio.mainCategory}`,
        });

        res.json({ success: true, data: newPortfolio });
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
                r.id, r.portfolio_id as "portfolioId", r.customer_id as "customerId",
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

        const portfolioCheck = await pool.query(`select id from drm.portfolios where id = $1`, [portfolioId]);
        if (portfolioCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Portfolio not found" });
        }

        const existing = await pool.query(
            `select id, status, expires_at as "expiresAt" from drm.portfolio_reservations
             where portfolio_id = $1 order by reserved_at desc limit 1`,
            [portfolioId]
        );
        if (existing.rows[0] && isLockingStatus(computeReservationLiveStatus(existing.rows[0] as any))) {
            return res.status(409).json({ success: false, message: "This portfolio is already reserved/locked" });
        }

        const reservedAt = new Date();
        const expiresAt = new Date(reservedAt.getTime() + RESERVATION_LOCK_HOURS * 60 * 60 * 1000);
        const inserted = await pool.query(
            `insert into drm.portfolio_reservations
                (portfolio_id, customer_id, company_name, status, reserved_by_user_id, reserved_at, expires_at)
             values ($1, $2, $3, 'active', $4, $5, $6)
             returning id, portfolio_id as "portfolioId", status, reserved_at as "reservedAt", expires_at as "expiresAt"`,
            [portfolioId, customerId || null, companyName || null, req.user.userId, reservedAt, expiresAt]
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

export default router;
