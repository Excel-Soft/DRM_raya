import { type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authService } from "../auth.service";
import { getDepartmentFilterUserIds } from "../controllers/dashboard.controller";
import { normalizeRole, ROLES } from "../utils/role-utils";
import { LEGACY_ROLE_KEYS } from "@shared/legacy-role-keys";
import { loadRoleTitles, userRoleInfo } from "../utils/user-role-titles";
import { errorEnvelope, sendError, badRequest, conflict, notFound } from "../utils/api-error";
import { recordAuditLog } from "../services/activity-service";
const safeUserAudit = (u: any) => u;
import { usersRepository } from "../repositories/users.repository";


const MONEY_FIELDS = [
    { key: "basicSalary", label: "Basic Salary" },
    { key: "dailyAllowance", label: "Daily Allowance" },
    { key: "mobileAllowance", label: "Mobile Allowance" },
    { key: "adminAllowance", label: "Admin Allowance" },
    { key: "conveyanceAllowance", label: "Conveyance Allowance" }
];

function round24(n: number) {
    return Math.round(n * 100) / 100;
}

const activeStatus = z.enum(["active", "inactive"]);

export function normalizeMoneyInput(v) {
  if (v === null || v === void 0) return "0";
  const s = String(v).trim();
  if (s === "") return "0";
  const cleaned = s.replace(/,/g, "");
  const m = cleaned.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(round24(n));
}
export function normalizeMoneyFields(data, requireAll) {
  for (const f of MONEY_FIELDS) {
    const raw = data[f.key];
    if (raw === void 0 && !requireAll) continue;
    const norm = normalizeMoneyInput(raw);
    if (norm === null) {
      return `${f.label} must be a valid non-negative amount`;
    }
    data[f.key] = norm;
  }
  return null;
}
export const createUserSchema = z.object({
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
  status: z.string().optional(),
  // active/inactive
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
  address: z.string().optional()
});
export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional()
});
export const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  members: z.array(z.string()).optional()
});
function resolveAdminVisiblePassword(row: { password?: string | null; legacy_password?: string | null }) {
  const drm = row.password != null ? String(row.password).trim() : "";
  if (drm) return drm;
  const legacy = row.legacy_password != null ? String(row.legacy_password).trim() : "";
  return legacy;
}

const LEGACY_LOGIN_PASSWORD_JOIN = `
  left join migration_meta.migration_legacy_ids m
    on m.legacy_table = 'webxl_user' and m.modern_id = u.id::text
  left join lateral (
    select trim(wl.password) as legacy_password
    from legacy_archive.webxl_login wl
    where trim(wl.user_id) = m.legacy_id
      and nullif(trim(wl.password), '') is not null
    order by wl.updated_at desc nulls last, wl._legacy_pk desc
    limit 1
  ) leg on true
`;

export class UsersController {
static async listUsers(req: Request | any, res: Response | any) {
  try {
    const { search, role, assigned, limit: limitRaw, offset: offsetRaw, includePassword } = req.query;
    // ?withProfile=true (User List page): add the old-DRM listing columns - photo,
    // Degree/Cheque, joining date, office id, net salary, city, contact, address.
    const withProfile = req.query.withProfile === "true";
    const whereParts = ["(u.is_active = true or u.is_active is null)"];
    const params: unknown[] = [];
    let counter = 1;
    if (assigned === "true") {
      const allowedIds = await getDepartmentFilterUserIds(req);
      if (allowedIds) {
        whereParts.push(`u.id = ANY($${counter}::uuid[])`);
        params.push(allowedIds);
        counter++;
      }
    }
    if (role && role !== "all") {
      const roleStr = String(role);
      const roleNorm = normalizeRole(roleStr);
      const legacyIds = Object.entries(LEGACY_ROLE_KEYS)
        .filter(([, key]) => normalizeRole(key) === roleNorm || key === roleStr)
        .map(([id]) => id);
      const roleIdx = counter;
      params.push(roleStr);
      counter++;
      const legacyIdx = legacyIds.length > 0 ? counter : 0;
      if (legacyIdx) {
        params.push(legacyIds);
        counter++;
      }
      const legacySql = legacyIdx
        ? ` OR EXISTS (
            SELECT 1
              FROM unnest(string_to_array(regexp_replace(coalesce(u.role_id::text, ''), '\\s', '', 'g'), ',')) AS rid
             WHERE rid = ANY($${legacyIdx}::text[])
          )`
        : "";
      const rolesArraySql = ` OR EXISTS (
          SELECT 1 FROM unnest(coalesce(u.roles, ARRAY[]::text[])) AS rk
           WHERE lower(trim(rk)) = lower($${roleIdx})
        )`;
      whereParts.push(`(
        u.role_id::text = $${roleIdx}
        OR u.role::text = $${roleIdx}
        ${rolesArraySql}
        ${legacySql}
      )`);
    }
    if (search && String(search).trim()) {
      whereParts.push(
        `(u.name ilike $${counter} or u.full_name ilike $${counter} or u.email ilike $${counter} or u.phone ilike $${counter} or u.role_id ilike $${counter} or u.role ilike $${counter} or u.department ilike $${counter} or u.designation ilike $${counter})`,
      );
      params.push(`%${String(search).trim()}%`);
      counter++;
    }
    const whereSql = whereParts.join(" and ");

    const limit = limitRaw !== undefined ? Math.min(100, Math.max(1, Number(limitRaw) || 25)) : 0;
    const offset = Math.max(0, Number(offsetRaw) || 0);

    let total: number | undefined;
    if (limit > 0) {
      const countResult = await pool.query(
        `select count(*)::int as total from drm.users u where ${whereSql}`,
        params,
      );
      total = countResult.rows[0]?.total ?? 0;
    }

    const profileJoin = withProfile
      ? `left join lateral (
           select l.user_id as legacy_user_id, l.picture as legacy_picture, l.doc as legacy_doc,
                  l."netSalary" as legacy_net_salary, l.att_id as legacy_att_id,
                  l.branch as legacy_city, l."officeNumber" as legacy_office_number,
                  l.fname as legacy_fname, l."joinDate" as legacy_join_date, l.address as legacy_address
             from migration_meta.migration_legacy_ids m
             join legacy_archive.webxl_user l on l.user_id = m.legacy_id
            where m.entity_type = 'user' and m.legacy_table = 'webxl_user' and m.modern_id = u.id::text
            limit 1
         ) lp on true`
      : "";
    let query = `
      select u.*, leg.legacy_password${withProfile ? ", lp.*" : ""}
      from drm.users u
      ${LEGACY_LOGIN_PASSWORD_JOIN}
      ${profileJoin}
      where ${whereSql}
      order by ${withProfile ? "nullif(lp.legacy_user_id, '')::int asc nulls last, " : ""}u.created_at desc`;
    if (limit > 0) {
      query += ` limit $${counter} offset $${counter + 1}`;
      params.push(limit, offset);
    }
    const result = await pool.query(query, params);
    const requesterRole = normalizeRole((req.user as any)?.activeRoleId || req.user?.roleId || "");
    const isRequesterAdmin = requesterRole === ROLES.ADMIN || requesterRole === ROLES.SUPER_HOD;
    const sendPasswords =
      isRequesterAdmin && (limit > 0 || includePassword === "true");
    const titles = await loadRoleTitles();
    const sanitized = result.rows.map((u) => ({
      id: u.id,
      fullName: u.name || u.full_name,
      email: u.email,
      role: normalizeRole(u.role_id || u.role),
      rawRole: u.role_id || u.role,
      roles: u.roles || [],
      // roleIds/roleTitles: every legacy role the user holds (for role-grouped
      // employee pickers); isDeactive: holds role 54 "Deactive" (disabled profile).
      ...userRoleInfo(u, titles),
      branch: u.branch,
      country: u.country,
      department: u.department,
      designation: u.designation,
      phone: u.phone,
      isActive: u.is_active !== false,
      status: u.is_active === false ? "inactive" : "active",
      createdAt: u.created_at || u.createdAt,
      ...(sendPasswords ? { password: resolveAdminVisiblePassword(u) } : {}),
      ...(withProfile
        ? (() => {
            const num = (v: unknown) => Number(v) || 0;
            const computedNet =
              num(u.basic_salary) + num(u.daily_allowance) + num(u.mobile_allowance) +
              num(u.admin_allowance) + num(u.conveyance_allowance);
            const clean = (v: unknown) => {
              const t = String(v ?? "").trim();
              return t && t.toLowerCase() !== "null" ? t : null;
            };
            return {
              fatherHusbandName: clean(u.father_husband_name) ?? clean(u.legacy_fname),
              attendanceId: clean(u.attendance_id) ?? clean(u.legacy_att_id),
              joinDate: clean(u.join_date) ?? clean(u.legacy_join_date),
              netSalary: num(u.legacy_net_salary) || computedNet || null,
              city: clean(u.legacy_city) ?? clean(u.branch),
              contactNo: clean(u.phone) ?? clean(u.legacy_office_number),
              address: clean(u.address) ?? clean(u.legacy_address),
              picture: clean(u.legacy_picture), // legacy assets/images/user/<file>
              securityDoc: clean(u.legacy_doc), // "Cheque" / "Degree" deposited
            };
          })()
        : {}),
    }));
    res.json(limit > 0 ? { users: sanitized, total, limit, offset } : { users: sanitized });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch users"));
  }
}

static async statsSummary(req: Request | any, res: Response | any) {
  try {
    const result = await pool.query(
      `select count(*)::int as total from drm.users where (is_active = true or is_active is null)`,
    );
    res.json({ totalUsers: result.rows[0]?.total ?? 0 });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch user stats"));
  }
}
static async createUser(req: Request | any, res: Response | any) {
  try {
    const data = createUserSchema.parse(req.body);
    if (data.roles && Array.isArray(data.roles)) {
      data.roles = [
        ...new Set(
          data.roles.map((r: string) => normalizeRole(String(r)) || String(r)).filter(Boolean),
        ),
      ];
      if (data.roles.length > 0) data.role = data.roles[0];
    }
    const moneyError = normalizeMoneyFields(data, true);
    if (moneyError) {
      return sendError(res, badRequest(moneyError));
    }
    console.log(`[USER_MGMT] Attempting to create user: ${data.email}`);
    const existing = await pool.query("select id from drm.users where email = $1 limit 1", [data.email]);
    if (existing.rows.length > 0) {
      console.warn(`[USER_MGMT] Conflict: User ${data.email} already exists`);
      return sendError(res, conflict("Email already in use. Please use a different email for a new user."));
    }
    const passwordHash = await authService.hashPassword(data.password);
    const isActive = data.status !== "inactive";
    const displayName = data.firstName || data.fullName || data.email.split("@")[0];
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
        displayName,
        // $1 - full_name, name
        data.email,
        // $2 - email, username
        passwordHash,
        // $3 - password_hash
        data.password,
        // $4 - password (plaintext, shown back to admins in the Super Admin panel)
        userRole,
        // $5 - role, role_id
        data.roles || [userRole],
        // $6 - roles
        data.branch,
        // $7 - branch
        data.country,
        // $8 - country
        data.department,
        // $9 - department
        data.designation,
        // $10 - designation
        phoneNumber,
        // $11 - phone
        isActive,
        // $12 - is_active
        data.firstName,
        // $13 - first_name
        data.fatherHusbandName,
        // $14 - father_husband_name
        data.attendanceId,
        // $15 - attendance_id
        data.guardianMobile,
        // $16 - guardian_mobile
        data.passportCnic,
        // $17 - passport_cnic
        data.facebookId,
        // $18 - facebook_id
        data.dateOfBirth,
        // $19 - date_of_birth
        data.joinDate,
        // $20 - join_date
        data.roleType,
        // $21 - role_type
        data.underWorks,
        // $22 - under_works
        data.basicSalary,
        // $23 - basic_salary
        data.dailyAllowance,
        // $24 - daily_allowance
        data.mobileAllowance,
        // $25 - mobile_allowance
        data.adminAllowance,
        // $26 - admin_allowance
        data.conveyanceAllowance,
        // $27 - conveyance_allowance
        data.relaxationMinutes,
        // $28 - relaxation_minutes
        data.increment,
        // $29 - increment
        data.gender,
        // $30 - gender
        data.address
        // $31 - address
      ]
    );
    console.log(`[USER_MGMT] Created user with ID: ${result.rows[0].id}`);
    const normalizedCreatedRole = normalizeRole(userRole);
    if (normalizedCreatedRole === "sales_executive") {
      try {
        // Dynamic table creation removed by request
        
        console.log(`[USER_MGMT] Provisioned dedicated table for new Sales Executive ${result.rows[0].id}`);
      } catch (err) {
        console.error("[USER_MGMT] Error provisioning table for Sales Executive:", err);
      }
    }
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
        status: isActive ? "active" : "inactive"
      },
      req
    });
    res.status(201).json({ success: true, ...result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error);
    }
    console.error("Error creating user:", error);
    return sendError(res, error);
  }
}
static async getUser(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    if (id3 === "groups") return sendError(res, notFound("Not found"));
    const result = await pool.query(
      `select u.*, leg.legacy_password
       from drm.users u
       ${LEGACY_LOGIN_PASSWORD_JOIN}
       where u.id = $1
       limit 1`,
      [id3],
    );
    if (result.rows.length === 0) {
      return sendError(res, notFound("User not found"));
    }
    const u = result.rows[0];
    const requesterRole = normalizeRole((req.user as any)?.activeRoleId || req.user?.roleId || "");
    const isRequesterAdmin = requesterRole === ROLES.ADMIN || requesterRole === ROLES.SUPER_HOD;
    res.json({
      user: {
        id: u.id,
        fullName: u.name || u.full_name,
        ...(isRequesterAdmin ? { password: resolveAdminVisiblePassword(u) } : {}),
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
        createdAt: u.created_at
      }
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch user"));
  }
}
static async updateUser(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    const data = updateUserSchema.parse(req.body);
    if (data.roles && Array.isArray(data.roles)) {
      data.roles = [
        ...new Set(
          data.roles.map((r: string) => normalizeRole(String(r)) || String(r)).filter(Boolean),
        ),
      ];
      if (data.roles.length > 0) data.role = data.roles[0];
    }
    const moneyError = normalizeMoneyFields(data, false);
    if (moneyError) {
      return sendError(res, badRequest(moneyError));
    }
    let query = "update drm.users set updated_at = now()";
    const values = [];
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
      if (!data.fullName) {
        query += `, full_name = $${counter}, name = $${counter}`;
        values.push(data.firstName);
        counter++;
      }
    }
    if (data.fatherHusbandName !== void 0) {
      query += `, father_husband_name = $${counter}`;
      values.push(data.fatherHusbandName);
      counter++;
    }
    if (data.attendanceId !== void 0) {
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
    if (data.department !== void 0) {
      query += `, department = $${counter}`;
      values.push(data.department);
      counter++;
    }
    if (data.designation !== void 0) {
      query += `, designation = $${counter}`;
      values.push(data.designation);
      counter++;
    }
    if (data.phone || data.mobile) {
      query += `, phone = $${counter}`;
      values.push(data.mobile || data.phone);
      counter++;
    }
    if (data.guardianMobile !== void 0) {
      query += `, guardian_mobile = $${counter}`;
      values.push(data.guardianMobile);
      counter++;
    }
    if (data.passportCnic !== void 0) {
      query += `, passport_cnic = $${counter}`;
      values.push(data.passportCnic);
      counter++;
    }
    if (data.facebookId !== void 0) {
      query += `, facebook_id = $${counter}`;
      values.push(data.facebookId);
      counter++;
    }
    if (data.dateOfBirth !== void 0) {
      query += `, date_of_birth = $${counter}`;
      values.push(data.dateOfBirth);
      counter++;
    }
    if (data.joinDate !== void 0) {
      query += `, join_date = $${counter}`;
      values.push(data.joinDate);
      counter++;
    }
    if (data.roleType !== void 0) {
      query += `, role_type = $${counter}`;
      values.push(data.roleType);
      counter++;
    }
    if (data.underWorks !== void 0) {
      query += `, under_works = $${counter}`;
      values.push(data.underWorks);
      counter++;
    }
    if (data.basicSalary !== void 0) {
      query += `, basic_salary = $${counter}`;
      values.push(data.basicSalary);
      counter++;
    }
    if (data.dailyAllowance !== void 0) {
      query += `, daily_allowance = $${counter}`;
      values.push(data.dailyAllowance);
      counter++;
    }
    if (data.mobileAllowance !== void 0) {
      query += `, mobile_allowance = $${counter}`;
      values.push(data.mobileAllowance);
      counter++;
    }
    if (data.adminAllowance !== void 0) {
      query += `, admin_allowance = $${counter}`;
      values.push(data.adminAllowance);
      counter++;
    }
    if (data.conveyanceAllowance !== void 0) {
      query += `, conveyance_allowance = $${counter}`;
      values.push(data.conveyanceAllowance);
      counter++;
    }
    if (data.relaxationMinutes !== void 0) {
      query += `, relaxation_minutes = $${counter}`;
      values.push(data.relaxationMinutes);
      counter++;
    }
    if (data.increment !== void 0) {
      query += `, increment = $${counter}`;
      values.push(data.increment);
      counter++;
    }
    if (data.gender !== void 0) {
      query += `, gender = $${counter}`;
      values.push(data.gender);
      counter++;
    }
    if (data.address !== void 0) {
      query += `, address = $${counter}`;
      values.push(data.address);
      counter++;
    }
    if (data.status) {
      query += `, is_active = $${counter}`;
      values.push(data.status === "active");
      counter++;
    }
    if (data.isActive !== void 0) {
      query += `, is_active = $${counter}`;
      values.push(data.isActive);
      counter++;
    }
    if (data.password) {
      const hash = await authService.hashPassword(data.password);
      query += `, password_hash = $${counter}`;
      values.push(hash);
      counter++;
      query += `, password = $${counter}`;
      values.push(data.password);
      counter++;
    }
    query += ` where id = $${counter} returning id`;
    values.push(id3);
    const updResult = await pool.query(query, values);
    if (updResult.rowCount === 0) {
      return sendError(res, notFound("User not found"));
    }
    await recordAuditLog({
      actorUserId: req.user?.userId,
      action: "user.update",
      module: "admin/users",
      entityType: "user",
      entityId: id3,
      after: safeUserAudit(data),
      req
    });
    res.json({ success: true, id: id3 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error);
    }
    console.error("Error updating user:", error);
    return sendError(res, error);
  }
}
static async updateStatus(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    const parsedStatus = activeStatus.safeParse(req.body?.status);
    if (!parsedStatus.success) {
      return sendError(res, badRequest("status must be 'active' or 'inactive'"));
    }
    const isActive = parsedStatus.data === "active";
    const prev = await pool.query("select is_active from drm.users where id = $1 limit 1", [id3]);
    if (!prev.rows[0]) {
      return sendError(res, notFound("User not found"));
    }
    await pool.query("update drm.users set is_active = $1, updated_at = now() where id = $2", [isActive, id3]);
    await recordAuditLog({
      actorUserId: req.user?.userId,
      action: "user.status_change",
      module: "admin/users",
      entityType: "user",
      entityId: id3,
      before: prev.rows[0] ? { status: prev.rows[0].is_active === false ? "inactive" : "active" } : void 0,
      after: { status: isActive ? "active" : "inactive" },
      req
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update status"));
  }
}
static async deleteUser(req: Request | any, res: Response | any) {
  try {
    // User List: delete is admin-only (super_admin normalizes to admin).
    const requesterRole = normalizeRole((req.user as any)?.activeRoleId || req.user?.roleId || "");
    if (requesterRole !== ROLES.ADMIN) {
      return res.status(403).json(errorEnvelope("FORBIDDEN", "Only admin can delete users"));
    }
    const { id: id3 } = req.params;
    const prev = await pool.query("select email, is_active from drm.users where id = $1 limit 1", [id3]);
    if (!prev.rows[0]) {
      return sendError(res, notFound("User not found"));
    }
    await pool.query("update drm.users set is_active = false, updated_at = now() where id = $1", [id3]);
    await recordAuditLog({
      actorUserId: req.user?.userId,
      action: "user.delete",
      module: "admin/users",
      entityType: "user",
      entityId: id3,
      before: prev.rows[0] ? {
        email: prev.rows[0].email,
        status: prev.rows[0].is_active === false ? "inactive" : "active"
      } : void 0,
      after: { status: "inactive", softDeleted: true },
      reason: req.body?.reason,
      req
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to delete user"));
  }
}
/**
 * Old-DRM "Group List" (drm/groups): the role groups - Role Id, Role Title,
 * Department, Description, Date - plus how many users hold each role.
 * Roles live in drm.roles as "Title [L<legacy id>]"; description/department/date come
 * from the old webxl_role row (drm.roles.description only kept "dept=...").
 */
static async getRoleGroups(req: Request | any, res: Response | any) {
  try {
    const { rows } = await pool.query(`
      WITH r AS (
        SELECT ro.id, ro.name, ro.description, ro.created_at,
               substring(ro.name from '\\[L(\\d+)\\]\\s*$') AS legacy_id,
               btrim(regexp_replace(ro.name, '\\s*\\[L\\d+\\]\\s*$', '')) AS title
          FROM drm.roles ro
      )
      SELECT r.id, r.legacy_id, COALESCE(NULLIF(btrim(l.name), ''), r.title) AS title,
             COALESCE(NULLIF(btrim(l.department), ''), NULLIF(substring(r.description from '^dept=(.*)$'), '')) AS department,
             CASE WHEN r.description LIKE 'dept=%' THEN NULLIF(btrim(l.des), '') ELSE COALESCE(NULLIF(btrim(l.des), ''), r.description) END AS description,
             COALESCE(NULLIF(l.create_date, '0000-00-00'), to_char(r.created_at, 'YYYY-MM-DD')) AS created,
             (SELECT count(*)::int FROM drm.users u
               WHERE (u.is_active = true OR u.is_active IS NULL)
                 AND r.legacy_id IS NOT NULL
                 AND r.legacy_id = ANY(string_to_array(regexp_replace(COALESCE(u.role_id, ''), '\\s', '', 'g'), ','))) AS members
        FROM r
        LEFT JOIN legacy_archive.webxl_role l ON l.id = r.legacy_id
       ORDER BY NULLIF(r.legacy_id, '')::int DESC NULLS FIRST, r.title`);
    res.json({
      roles: rows.map((r: any) => ({
        id: r.id,
        roleId: r.legacy_id,
        title: r.title,
        department: r.department,
        description: r.description,
        date: r.created,
        members: r.members,
      })),
    });
  } catch (error) {
    console.error("Error fetching role groups:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch role groups"));
  }
}

static async getGroups(req: Request | any, res: Response | any) {
  try {
    await usersRepository.findAll();
    const result = await pool.query(`
             select g.*, 
                    count(m.user_id) as "memberCount",
                    json_agg(m.user_id) filter (where m.user_id is not null) as "memberIds"
             from drm.user_groups g
             left join drm.user_group_members m on g.id = m.group_id
             group by g.id
             order by g.created_at desc
        `);
    const mapped = result.rows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: parseInt(g.memberCount || "0"),
      memberIds: g.memberIds || [],
      createdAt: g.created_at || g.createdAt
    }));
    res.json({ groups: mapped });
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.json({ groups: [] });
  }
}
static async createGroup(req: Request | any, res: Response | any) {
  const client = await pool.connect();
  try {
    const data = createGroupSchema.parse(req.body);
    await client.query("BEGIN");
    const result = await client.query(
      "insert into drm.user_groups (name, description) values ($1, $2) returning *",
      [data.name, data.description]
    );
    const group = result.rows[0];
    if (data.members && data.members.length > 0) {
      const values = data.members.map((userId, index2) => `($1, $${index2 + 2})`).join(",");
      const params = [group.id, ...data.members];
      await client.query(
        `insert into drm.user_group_members (group_id, user_id) values ${values}`,
        params
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, group });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating group:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to create group"));
  } finally {
    client.release();
  }
}
static async updateGroup(req: Request | any, res: Response | any) {
  const client = await pool.connect();
  try {
    const { id: id3 } = req.params;
    const { name, description, members } = req.body;
    await client.query("BEGIN");
    await client.query(
      "update drm.user_groups set name = $1, description = $2, updated_at = now() where id = $3",
      [name, description, id3]
    );
    if (Array.isArray(members)) {
      await client.query("delete from drm.user_group_members where group_id = $1", [id3]);
      if (members.length > 0) {
        const values = members.map((userId, index2) => `($1, $${index2 + 2})`).join(",");
        const params = [id3, ...members];
        await client.query(
          `insert into drm.user_group_members (group_id, user_id) values ${values}`,
          params
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update group"));
  } finally {
    client.release();
  }
}
static async deleteGroup(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    await pool.query("delete from drm.user_groups where id = $1", [id3]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to delete group"));
  }
}
static async getTeamMembers(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
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
        `, [id3]);
    res.json({ members: result.rows });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch team members"));
  }
}
static async addTeamMember(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    const { memberId } = req.body;
    if (!memberId) return sendError(res, badRequest("memberId required"));
    if (id3 === memberId) return sendError(res, badRequest("Cannot add user to their own team"));
    await pool.query(`
            INSERT INTO drm.user_team_members (manager_id, member_id)
            VALUES ($1, $2)
            ON CONFLICT (manager_id, member_id) DO NOTHING
        `, [id3, memberId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding team member:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to add team member"));
  }
}
static async removeTeamMember(req: Request | any, res: Response | any) {
  try {
    const { id: id3, memberId } = req.params;
    await pool.query(`
            DELETE FROM drm.user_team_members
            WHERE manager_id = $1 AND member_id = $2
        `, [id3, memberId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to remove team member"));
  }
}
static async impersonateUser(req: Request | any, res: Response | any) {
  try {
    const { id: id3 } = req.params;
    const user = await usersRepository.findById(id3);
    if (!user) return sendError(res, notFound("User not found"));
    const token = authService.generateToken({
      userId: user.id,
      email: user.email,
      roleId: user.roleId || user.role,
      roles: user.roles || [],
      branch: user.branch || "HQ",
      country: user.country || "UAE"
    });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Impersonation failed"));
  }
}
}
