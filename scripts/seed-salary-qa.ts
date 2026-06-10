/**
 * QA-only seed for the Patch 2 Stage 4 salary workflow.
 *
 * Creates three obvious test employees with NUMERIC basic_salary and real
 * attendance / approved-unpaid-leave / approved-paid-leave / approved-overtime /
 * ACTIVE-penalty rows for a fixed test period, so payroll preview/generation can
 * be exercised against deterministic, hand-checkable numbers.
 *
 * Idempotent: re-running upserts the users and replaces only the rows it owns
 * (attendance/leave/overtime in the period; penalties tagged QA_SEED_SALARY).
 *
 * DEV/QA ONLY — never run against production. Writes to whatever DATABASE_URL
 * points at; confirm you are on a dev/QA database first.
 */
import { pool } from "../server/db";

const PERIOD = { month: 5, year: 2026 }; // May 2026
const SEED_TAG = "QA_SEED_SALARY";

function ts(day: number, hour = 12): Date {
  return new Date(PERIOD.year, PERIOD.month - 1, day, hour, 0, 0, 0);
}

interface SeedUser {
  username: string;
  email: string;
  fullName: string;
  basicSalary: string;
  department: string;
  branch: string;
  role: string;
  attendance: Array<{ day: number; status: "Present" | "Absent" | "Late" | "HalfDay" | "Leave" }>;
  leaves: Array<{ type: string; from: number; to: number }>;
  overtimeMinutes: Array<{ day: number; minutes: number }>;
  penalties: Array<{ day: number; amount: number; head: string }>;
}

const USERS: SeedUser[] = [
  {
    username: "salary.alice",
    email: "salary.alice@webexcels.local",
    fullName: "QA Alice (Payroll)",
    basicSalary: "30000",
    department: "QA Payroll",
    branch: "HQ",
    role: "sales_executive",
    // perDay = 1000. Absent uncovered (5,6,7)=3 -> 3000. Absent on 12,13 covered
    // by Unpaid leave (counted as unpaid, not absent). Absent on 20 covered by
    // paid Annual leave (no deduction).
    attendance: [
      { day: 1, status: "Present" },
      { day: 2, status: "Present" },
      { day: 5, status: "Absent" },
      { day: 6, status: "Absent" },
      { day: 7, status: "Absent" },
      { day: 8, status: "Present" },
      { day: 12, status: "Absent" },
      { day: 13, status: "Absent" },
      { day: 14, status: "Late" },
      { day: 20, status: "Absent" },
    ],
    leaves: [
      { type: "Unpaid", from: 12, to: 13 }, // unpaidLeaveDays = 2 -> 2000
      { type: "Annual", from: 20, to: 21 }, // paid leave, no deduction
    ],
    overtimeMinutes: [{ day: 10, minutes: 120 }],
    penalties: [{ day: 15, amount: 500, head: "Late submission" }],
  },
  {
    username: "salary.bob",
    email: "salary.bob@webexcels.local",
    fullName: "QA Bob (Payroll)",
    basicSalary: "45000",
    department: "QA Payroll",
    branch: "HQ",
    role: "sales_executive",
    attendance: [
      { day: 1, status: "Present" },
      { day: 2, status: "Present" },
      { day: 3, status: "Present" },
    ],
    leaves: [],
    overtimeMinutes: [{ day: 9, minutes: 60 }],
    penalties: [],
  },
  {
    username: "salary.carol",
    email: "salary.carol@webexcels.local",
    fullName: "QA Carol (Payroll)",
    basicSalary: "60000",
    department: "Accounts",
    branch: "HQ",
    role: "account_manager",
    // perDay = 2000. One uncovered absent (3) -> 2000.
    attendance: [
      { day: 1, status: "Present" },
      { day: 3, status: "Absent" },
    ],
    leaves: [],
    overtimeMinutes: [],
    penalties: [],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const adminRes = await client.query(
      `SELECT id FROM drm.users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
    );
    const adminId: string = adminRes.rows[0]?.id;
    if (!adminId) throw new Error("No admin user found to use as penalties.created_by");

    const { start, end } = {
      start: new Date(PERIOD.year, PERIOD.month - 1, 1, 0, 0, 0, 0),
      end: new Date(PERIOD.year, PERIOD.month, 0, 23, 59, 59, 999),
    };

    for (const u of USERS) {
      await client.query("BEGIN");

      const userRes = await client.query(
        `INSERT INTO drm.users (username, email, full_name, name, basic_salary, department, branch, role, is_active)
         VALUES ($1,$2,$3,$3,$4,$5,$6,$7,true)
         ON CONFLICT (email) DO UPDATE
           SET full_name = EXCLUDED.full_name, name = EXCLUDED.name,
               basic_salary = EXCLUDED.basic_salary, department = EXCLUDED.department,
               branch = EXCLUDED.branch, role = EXCLUDED.role, is_active = true,
               updated_at = now()
         RETURNING id`,
        [u.username, u.email, u.fullName, u.basicSalary, u.department, u.branch, u.role],
      );
      const userId: string = userRes.rows[0].id;

      // Replace only the rows this seed owns for the period.
      await client.query(`DELETE FROM drm.attendance WHERE user_id = $1 AND date >= $2 AND date <= $3`, [userId, start, end]);
      await client.query(
        `DELETE FROM drm.leave_requests WHERE user_id = $1 AND from_date >= $2 AND from_date <= $3`,
        [userId, start, end],
      );
      await client.query(`DELETE FROM drm.overtime_records WHERE user_id = $1 AND date >= $2 AND date <= $3`, [userId, start, end]);
      await client.query(`DELETE FROM drm.penalties WHERE employee_id = $1 AND reason = $2`, [userId, SEED_TAG]);

      for (const a of u.attendance) {
        await client.query(
          `INSERT INTO drm.attendance (user_id, date, status, is_late)
           VALUES ($1, $2, $3::drm.attendance_status, $4)`,
          [userId, ts(a.day), a.status, a.status === "Late"],
        );
      }

      for (const lv of u.leaves) {
        await client.query(
          `INSERT INTO drm.leave_requests (user_id, purpose, leave_type, alternative, from_date, to_date, status, approved_by_user_id, approved_at)
           VALUES ($1, $2, $3::drm.leave_type, $4, $5, $6, 'Approved'::drm.leave_status, $7, now())`,
          [userId, "QA seed leave", lv.type, "N/A", ts(lv.from), ts(lv.to), adminId],
        );
      }

      for (const ot of u.overtimeMinutes) {
        await client.query(
          `INSERT INTO drm.overtime_records (user_id, task_title, time_spent, task_details, date, status, reviewed_by_user_id, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, 'Approved'::drm.overtime_status, $6, now())`,
          [userId, "QA seed overtime", ot.minutes, "QA seed overtime details", ts(ot.day), adminId],
        );
      }

      for (const p of u.penalties) {
        await client.query(
          `INSERT INTO drm.penalties (employee_id, penalty_head, reason, amount, penalty_date, created_by, approval_status, status, department)
           VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', 'ACTIVE', $7)`,
          [userId, p.head, SEED_TAG, p.amount, ts(p.day), adminId, u.department],
        );
      }

      await client.query("COMMIT");
      console.log(`Seeded ${u.email} (id=${userId}) basic=${u.basicSalary}`);
    }

    console.log(`\nDone. Test period: ${PERIOD.month}/${PERIOD.year}. Expected (no manual adjustments):`);
    console.log("  Alice: gross 30000, absence 3000, unpaidLeave 2000, penalty 500, payable 24500");
    console.log("  Bob:   gross 45000, deductions 0, payable 45000");
    console.log("  Carol: gross 60000, absence 2000, payable 58000");
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Salary QA seed failed:", e);
  process.exit(1);
});
