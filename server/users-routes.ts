import { Router, type Request, type Response } from "express";
import { usersRepository } from "./repositories/users.repository";
import { authService } from "./auth.service";
import { z } from "zod";
import { normalizeRole } from "./utils/role-utils";
import { pool } from "./db";
import { sendError, errorEnvelope, badRequest, notFound, conflict } from "./utils/api-error";
import { recordAuditLog } from "./services/activity-service";
import { activeStatus } from "@shared/validators";

const router = Router();

/** Strip secret-bearing fields before an update payload is written to the audit log. */
function safeUserAudit(data: Record<string, any>): Record<string, any> {
    const { password, ...rest } = data || {};
    return rest;
}

const createUserSchema = z.object({
    // Legacy fields (for backward compatibility)
    fullName: z.string().optional(),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.string().default("sales_executive"),
    roles: z.array(z.string()).optional(),
    branch: z.string().default("HQ"),
    country: z.string().default("UAE"),
    department: z.string().optional(),
    designation: z.string().optional(),
    phone: z.string().optional(),
    status: z.string().optional(), // active/inactive

    // Extended user fields
    firstName: z.string().optional(),
    fatherHusbandName: z.string().optional(),
    attendanceId: z.string().optional(),
    mobile: z.string().optional(),
    guardianMobile: z.string().optional(),
    passportCnic: z.string().optional(),
    facebookId: z.string().optional(),
    dateOfBirth: z.string().optional(),
    joinDate: z.string().optional(),
    roleType: z.string().optional(),
    underWorks: z.string().optional(),
    basicSalary: z.string().optional(),
    dailyAllowance: z.string().optional(),
    mobileAllowance: z.string().optional(),
    adminAllowance: z.string().optional(),
    conveyanceAllowance: z.string().optional(),
    relaxationMinutes: z.string().optional(),
    increment: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
});

const updateUserSchema = createUserSchema.partial().extend({
    isActive: z.boolean().optional(),
});

const createGroupSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    members: z.array(z.string()).optional(),
});

import { getDepartmentFilterUserIds } from "./dashboard-routes";

// GET /api/users - List all users
router.get("/", async (req: Request, res: Response) => {
    try {
        const { search, role, assigned } = req.query;
        console.log("GET /api/users called with query:", req.query);
        let query = "select * from drm.users where (is_active = true or is_active is null)";
        const params: any[] = [];
        let counter = 1;

        if (assigned === 'true') {
            const allowedIds = await getDepartmentFilterUserIds(req);
            if (allowedIds) {
                query += ` and id = ANY($${counter}::uuid[])`;
                params.push(allowedIds);
                counter++;
            }
        }


        if (role && role !== "all") {
            query += ` and (role_id = $${counter} or role = $${counter})`;
            params.push(role);
            counter++;
        }

        if (search) {
            query += ` and (name ilike $${counter} or full_name ilike $${counter} or email ilike $${counter} or phone ilike $${counter})`;
            params.push(`%${search}%`);
            counter++;
        }

        query += " order by created_at desc";

        const result = await pool.query(query, params);

        // Sanitize sensitive info
        const sanitized = result.rows.map(u => ({
            id: u.id,
            fullName: u.name || u.full_name,
            email: u.email,
            role: normalizeRole(u.role_id || u.role),
            rawRole: u.role_id || u.role, // actual DB role, not normalized
            roles: u.roles || [],
            branch: u.branch,
            country: u.country,
            department: u.department,
            designation: u.designation,
            phone: u.phone,
            isActive: u.is_active !== false,
            status: u.is_active === false ? "inactive" : "active",
            createdAt: u.created_at || u.createdAt,
            // SECURITY: never expose password / password_hash in API responses.
        }));

        res.json({ users: sanitized });
    } catch (error: any) {
        console.error("Error fetching users:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch users"));
    }
});

// POST /api/users - Create user
router.post("/", async (req: Request, res: Response) => {
    try {
        const data = createUserSchema.parse(req.body);
        console.log(`[USER_MGMT] Attempting to create user: ${data.email}`);

        const existing = await pool.query("select id from drm.users where email = $1 limit 1", [data.email]);
        if (existing.rows.length > 0) {
            console.warn(`[USER_MGMT] Conflict: User ${data.email} already exists`);
            return sendError(res, conflict("Email already in use. Please use a different email for a new user."));
        }

        const passwordHash = await authService.hashPassword(data.password);
        const isActive = data.status !== "inactive";

        // Use firstName or fallback to fullName for backward compatibility
        const displayName = data.firstName || data.fullName || data.email.split('@')[0];
        const phoneNumber = data.mobile || data.phone || null;
        const userRole = data.roleType || data.role;

        const result = await pool.query(
            `insert into drm.users 
       (full_name, name, email, username, password_hash, password, role, role_id, roles, branch, country, 
        department, designation, phone, is_active, 
        first_name, father_husband_name, attendance_id, guardian_mobile, passport_cnic, facebook_id, 
        date_of_birth, join_date, role_type, under_works, 
        basic_salary, daily_allowance, mobile_allowance, admin_allowance, conveyance_allowance, 
        relaxation_minutes, increment, gender, address, 
        created_at, updated_at) 
       values ($1, $1, $2, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, now(), now()) 
       returning id, full_name, email, role, roles`,
            [
                displayName,                          // $1 - full_name, name
                data.email,                           // $2 - email, username
                passwordHash,                         // $3 - password_hash
                null,                                 // $4 - password (deprecated: no plaintext stored)
                userRole,                             // $5 - role, role_id
                data.roles || [userRole],             // $6 - roles
                data.branch,                          // $7 - branch
                data.country,                         // $8 - country
                data.department,                      // $9 - department
                data.designation,                     // $10 - designation
                phoneNumber,                          // $11 - phone
                isActive,                             // $12 - is_active
                data.firstName,                       // $13 - first_name
                data.fatherHusbandName,               // $14 - father_husband_name
                data.attendanceId,                    // $15 - attendance_id
                data.guardianMobile,                  // $16 - guardian_mobile
                data.passportCnic,                    // $17 - passport_cnic
                data.facebookId,                      // $18 - facebook_id
                data.dateOfBirth,                     // $19 - date_of_birth
                data.joinDate,                        // $20 - join_date
                data.roleType,                        // $21 - role_type
                data.underWorks,                      // $22 - under_works
                data.basicSalary,                     // $23 - basic_salary
                data.dailyAllowance,                  // $24 - daily_allowance
                data.mobileAllowance,                 // $25 - mobile_allowance
                data.adminAllowance,                  // $26 - admin_allowance
                data.conveyanceAllowance,             // $27 - conveyance_allowance
                data.relaxationMinutes,               // $28 - relaxation_minutes
                data.increment,                       // $29 - increment
                data.gender,                          // $30 - gender
                data.address                          // $31 - address
            ]
        );

        console.log(`[USER_MGMT] Created user with ID: ${result.rows[0].id}`);
        
        // --- HOOK: DYNAMIC TABLE PROVISIONING ---
        const normalizedCreatedRole = normalizeRole(userRole);
        if (normalizedCreatedRole === "sales_executive") {
            try {
                const { ensureSalesTables } = await import("./utils/sales-tables.js");
                await ensureSalesTables(result.rows[0].id, normalizedCreatedRole);
                console.log(`[USER_MGMT] Provisioned dedicated table for new Sales Executive ${result.rows[0].id}`);
            } catch (err) {
                console.error("[USER_MGMT] Error provisioning table for Sales Executive:", err);
            }
        }
        // ----------------------------------------

        await recordAuditLog({
            actorUserId: req.user?.userId,
            action: "user.create",
            module: "admin/users",
            entityType: "user",
            entityId: result.rows[0].id,
            after: {
                email: data.email,
                role: userRole,
                roles: data.roles || [userRole],
                branch: data.branch,
                country: data.country,
                department: data.department,
                status: isActive ? "active" : "inactive",
            },
            req,
        });

        res.status(201).json({ success: true, ...result.rows[0] });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return sendError(res, error);
        }
        console.error("Error creating user:", error);
        return sendError(res, error);
    }
});

// GET /api/users/:id - Get single user with all fields
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Skip non-UUID paths that match other routes
        if (id === "groups") return sendError(res, notFound("Not found"));

        const result = await pool.query("select * from drm.users where id = $1 limit 1", [id]);
        if (result.rows.length === 0) {
            return sendError(res, notFound("User not found"));
        }
        const u = result.rows[0];
        res.json({
            user: {
                id: u.id,
                fullName: u.name || u.full_name,
                firstName: u.first_name || u.name || u.full_name || "",
                fatherHusbandName: u.father_husband_name || "",
                attendanceId: u.attendance_id || "",
                email: u.email,
                phone: u.phone || "",
                mobile: u.phone || "",
                guardianMobile: u.guardian_mobile || "",
                passportCnic: u.passport_cnic || "",
                facebookId: u.facebook_id || "",
                dateOfBirth: u.date_of_birth || "",
                joinDate: u.join_date || "",
                role: normalizeRole(u.role_id || u.role),
                roles: u.roles || (u.role ? [normalizeRole(u.role_id || u.role)] : []),
                underWorks: u.under_works || "",
                department: u.department || "",
                designation: u.designation || "",
                basicSalary: u.basic_salary || "",
                dailyAllowance: u.daily_allowance || "",
                mobileAllowance: u.mobile_allowance || "",
                adminAllowance: u.admin_allowance || "",
                conveyanceAllowance: u.conveyance_allowance || "",
                relaxationMinutes: u.relaxation_minutes || "",
                increment: u.increment || "",
                gender: u.gender || "",
                address: u.address || "",
                branch: u.branch,
                country: u.country,
                isActive: u.is_active !== false,
                status: u.is_active === false ? "inactive" : "active",
                createdAt: u.created_at,
            }
        });
    } catch (error: any) {
        console.error("Error fetching user:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch user"));
    }
});

// PATCH /api/users/:id - Update user
router.patch("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = updateUserSchema.parse(req.body);

        let query = "update drm.users set updated_at = now()";
        const values: any[] = [];
        let counter = 1;

        if (data.fullName) {
            query += `, full_name = $${counter}, name = $${counter}`;
            values.push(data.fullName);
            counter++;
        }
        if (data.firstName) {
            query += `, first_name = $${counter}`;
            values.push(data.firstName);
            counter++;
            // Also update full_name/name if not explicitly set
            if (!data.fullName) {
                query += `, full_name = $${counter}, name = $${counter}`;
                values.push(data.firstName);
                counter++;
            }
        }
        if (data.fatherHusbandName !== undefined) {
            query += `, father_husband_name = $${counter}`;
            values.push(data.fatherHusbandName);
            counter++;
        }
        if (data.attendanceId !== undefined) {
            query += `, attendance_id = $${counter}`;
            values.push(data.attendanceId);
            counter++;
        }
        if (data.email) {
            query += `, email = $${counter}`;
            values.push(data.email);
            counter++;
        }
        if (data.role) {
            query += `, role = $${counter}, role_id = $${counter}`;
            values.push(data.role);
            counter++;
        }
        if (data.roles) {
            query += `, roles = $${counter}::text[]`;
            values.push(data.roles);
            counter++;
        }
        if (data.branch) {
            query += `, branch = $${counter}`;
            values.push(data.branch);
            counter++;
        }
        if (data.country) {
            query += `, country = $${counter}`;
            values.push(data.country);
            counter++;
        }
        if (data.department !== undefined) {
            query += `, department = $${counter}`;
            values.push(data.department);
            counter++;
        }
        if (data.designation !== undefined) {
            query += `, designation = $${counter}`;
            values.push(data.designation);
            counter++;
        }
        if (data.phone) {
            query += `, phone = $${counter}`;
            values.push(data.phone);
            counter++;
        }
        if (data.mobile) {
            query += `, phone = $${counter}`;
            values.push(data.mobile);
            counter++;
        }
        if (data.guardianMobile !== undefined) {
            query += `, guardian_mobile = $${counter}`;
            values.push(data.guardianMobile);
            counter++;
        }
        if (data.passportCnic !== undefined) {
            query += `, passport_cnic = $${counter}`;
            values.push(data.passportCnic);
            counter++;
        }
        if (data.facebookId !== undefined) {
            query += `, facebook_id = $${counter}`;
            values.push(data.facebookId);
            counter++;
        }
        if (data.dateOfBirth !== undefined) {
            query += `, date_of_birth = $${counter}`;
            values.push(data.dateOfBirth);
            counter++;
        }
        if (data.joinDate !== undefined) {
            query += `, join_date = $${counter}`;
            values.push(data.joinDate);
            counter++;
        }
        if (data.roleType !== undefined) {
            query += `, role_type = $${counter}`;
            values.push(data.roleType);
            counter++;
        }
        if (data.underWorks !== undefined) {
            query += `, under_works = $${counter}`;
            values.push(data.underWorks);
            counter++;
        }
        if (data.basicSalary !== undefined) {
            query += `, basic_salary = $${counter}`;
            values.push(data.basicSalary);
            counter++;
        }
        if (data.dailyAllowance !== undefined) {
            query += `, daily_allowance = $${counter}`;
            values.push(data.dailyAllowance);
            counter++;
        }
        if (data.mobileAllowance !== undefined) {
            query += `, mobile_allowance = $${counter}`;
            values.push(data.mobileAllowance);
            counter++;
        }
        if (data.adminAllowance !== undefined) {
            query += `, admin_allowance = $${counter}`;
            values.push(data.adminAllowance);
            counter++;
        }
        if (data.conveyanceAllowance !== undefined) {
            query += `, conveyance_allowance = $${counter}`;
            values.push(data.conveyanceAllowance);
            counter++;
        }
        if (data.relaxationMinutes !== undefined) {
            query += `, relaxation_minutes = $${counter}`;
            values.push(data.relaxationMinutes);
            counter++;
        }
        if (data.increment !== undefined) {
            query += `, increment = $${counter}`;
            values.push(data.increment);
            counter++;
        }
        if (data.gender !== undefined) {
            query += `, gender = $${counter}`;
            values.push(data.gender);
            counter++;
        }
        if (data.address !== undefined) {
            query += `, address = $${counter}`;
            values.push(data.address);
            counter++;
        }
        if (data.status) {
            query += `, is_active = $${counter}`;
            values.push(data.status === "active");
            counter++;
        }
        if (data.isActive !== undefined) {
            query += `, is_active = $${counter}`;
            values.push(data.isActive);
            counter++;
        }
        if (data.password) {
            // SECURITY: write only the bcrypt hash; never persist plaintext.
            const hash = await authService.hashPassword(data.password);
            query += `, password_hash = $${counter}`;
            values.push(hash);
            counter++;
        }

        query += ` where id = $${counter} returning id`;
        values.push(id);

        const updResult = await pool.query(query, values);
        if (updResult.rowCount === 0) {
            return sendError(res, notFound("User not found"));
        }

        await recordAuditLog({
            actorUserId: req.user?.userId,
            action: "user.update",
            module: "admin/users",
            entityType: "user",
            entityId: id,
            after: safeUserAudit(data),
            req,
        });

        res.json({ success: true, id });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return sendError(res, error);
        }
        console.error("Error updating user:", error);
        return sendError(res, error);
    }
});

// PATCH /api/users/:id/status
router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsedStatus = activeStatus.safeParse(req.body?.status);
        if (!parsedStatus.success) {
            return sendError(res, badRequest("status must be 'active' or 'inactive'"));
        }
        const isActive = parsedStatus.data === "active";

        const prev = await pool.query("select is_active from drm.users where id = $1 limit 1", [id]);
        if (!prev.rows[0]) {
            return sendError(res, notFound("User not found"));
        }
        await pool.query("update drm.users set is_active = $1, updated_at = now() where id = $2", [isActive, id]);

        await recordAuditLog({
            actorUserId: req.user?.userId,
            action: "user.status_change",
            module: "admin/users",
            entityType: "user",
            entityId: id,
            before: prev.rows[0]
                ? { status: prev.rows[0].is_active === false ? "inactive" : "active" }
                : undefined,
            after: { status: isActive ? "active" : "inactive" },
            req,
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update status"));
    }
});

// DELETE /api/users/:id
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const prev = await pool.query("select email, is_active from drm.users where id = $1 limit 1", [id]);
        if (!prev.rows[0]) {
            return sendError(res, notFound("User not found"));
        }
        // Soft delete
        await pool.query("update drm.users set is_active = false, updated_at = now() where id = $1", [id]);

        await recordAuditLog({
            actorUserId: req.user?.userId,
            action: "user.delete",
            module: "admin/users",
            entityType: "user",
            entityId: id,
            before: prev.rows[0]
                ? {
                      email: prev.rows[0].email,
                      status: prev.rows[0].is_active === false ? "inactive" : "active",
                  }
                : undefined,
            after: { status: "inactive", softDeleted: true },
            reason: req.body?.reason,
            req,
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to delete user"));
    }
});

// --- GROUPS ENDPOINTS ---

// GET /api/users/groups
router.get("/groups", async (req: Request, res: Response) => {
    try {
        // Ensure groups table exists
        await usersRepository.findAll(); // Triggers schema check

        const result = await pool.query(`
             select g.*, 
                    count(m.user_id) as "memberCount",
                    json_agg(m.user_id) filter (where m.user_id is not null) as "memberIds"
             from drm.user_groups g
             left join drm.user_group_members m on g.id = m.group_id
             group by g.id
             order by g.created_at desc
        `);

        const mapped = result.rows.map(g => ({
            id: g.id,
            name: g.name,
            description: g.description,
            memberCount: parseInt(g.memberCount || "0"),
            memberIds: g.memberIds || [],
            createdAt: g.created_at || g.createdAt
        }));

        res.json({ groups: mapped });
    } catch (error: any) {
        console.error("Error fetching groups:", error);
        // If table doesn't exist yet, return empty
        res.json({ groups: [] });
    }
});

// POST /api/users/groups
router.post("/groups", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const data = createGroupSchema.parse(req.body);

        await client.query('BEGIN');

        const result = await client.query(
            "insert into drm.user_groups (name, description) values ($1, $2) returning *",
            [data.name, data.description]
        );
        const group = result.rows[0];

        if (data.members && data.members.length > 0) {
            const values = data.members.map((userId: string, index: number) => `($1, $${index + 2})`).join(",");
            const params = [group.id, ...data.members];
            await client.query(
                `insert into drm.user_group_members (group_id, user_id) values ${values}`,
                params
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, group });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error creating group:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to create group"));
    } finally {
        client.release();
    }
});

// PATCH /api/users/groups/:id
router.patch("/groups/:id", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description, members } = req.body;

        await client.query('BEGIN');

        await client.query(
            "update drm.user_groups set name = $1, description = $2, updated_at = now() where id = $3",
            [name, description, id]
        );

        if (Array.isArray(members)) {
            // Delete existing members
            await client.query("delete from drm.user_group_members where group_id = $1", [id]);

            // Insert new members
            if (members.length > 0) {
                const values = members.map((userId: string, index: number) => `($1, $${index + 2})`).join(",");
                const params = [id, ...members];
                await client.query(
                    `insert into drm.user_group_members (group_id, user_id) values ${values}`,
                    params
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update group"));
    } finally {
        client.release();
    }
});

// DELETE /api/users/groups/:id
router.delete("/groups/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await pool.query("delete from drm.user_groups where id = $1", [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to delete group"));
    }
});

// ─── TEAM MEMBERS ────────────────────────────────────────────────────────────

// GET /api/users/:id/team-members
router.get("/:id/team-members", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT
                u.id, u.full_name AS "fullName", u.name,
                u.email, u.role, u.role_id AS "roleId",
                u.department, u.designation, u.phone,
                u.is_active,
                tm.added_at AS "addedAt"
            FROM drm.user_team_members tm
            JOIN drm.users u ON u.id = tm.member_id
            WHERE tm.manager_id = $1
            ORDER BY tm.added_at DESC
        `, [id]);
        res.json({ members: result.rows });
    } catch (error: any) {
        console.error("Error fetching team members:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch team members"));
    }
});

// POST /api/users/:id/team-members — add a member
router.post("/:id/team-members", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { memberId } = req.body;
        if (!memberId) return sendError(res, badRequest("memberId required"));
        if (id === memberId) return sendError(res, badRequest("Cannot add user to their own team"));

        await pool.query(`
            INSERT INTO drm.user_team_members (manager_id, member_id)
            VALUES ($1, $2)
            ON CONFLICT (manager_id, member_id) DO NOTHING
        `, [id, memberId]);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Error adding team member:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to add team member"));
    }
});

// DELETE /api/users/:id/team-members/:memberId — remove a member
router.delete("/:id/team-members/:memberId", async (req: Request, res: Response) => {
    try {
        const { id, memberId } = req.params;
        await pool.query(`
            DELETE FROM drm.user_team_members
            WHERE manager_id = $1 AND member_id = $2
        `, [id, memberId]);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Error removing team member:", error);
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to remove team member"));
    }
});

// POST /api/users/:id/impersonate
router.post("/:id/impersonate", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await usersRepository.findById(id);
        if (!user) return sendError(res, notFound("User not found"));

        const token = authService.generateToken({
            userId: user.id,
            email: user.email,
            roleId: user.roleId || (user as any).role,
            roles: (user as any).roles || [],
            branch: (user as any).branch || "HQ",
            country: (user as any).country || "UAE",
        });

        res.json({ token, user });
    } catch (error) {
        res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Impersonation failed"));
    }
});

export default router;
