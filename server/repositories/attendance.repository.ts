import { pool } from "../db";
import { attendancePolicy } from "../config/attendance";

export type Attendance = {
  id: string;
  userId: string;
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
  status: string;
  notes: string | null;
  workingHours?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  totalDays: number;
  workingDays: number;
};

export type SalaryDetails = {
  totalWorkingDays: number;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  daysOnLeave: number;
  effectiveWorkingDays: number;
  totalWorkingHours: number;
};

export class AttendanceRepository {
  private ensured = false;

  private async ensureSchema() {
    if (this.ensured) return;
    await pool.query(`
      alter table attendance
        add column if not exists late_checkin boolean not null default false,
        add column if not exists late_checkout boolean not null default false,
        add column if not exists is_late boolean not null default false;
      update attendance
         set late_checkin = coalesce(late_checkin, false),
             late_checkout = coalesce(late_checkout, false),
             is_late = coalesce(is_late, false)
       where 1=1;
    `);
    this.ensured = true;
  }

  private getLocalHM(date: Date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: attendancePolicy.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return { hour, minute };
  }

  private computeLateFlags(checkIn?: Date | null, checkOut?: Date | null) {
    let lateCheckin = false;
    let lateCheckout = false;
    if (checkIn) {
      const { hour, minute } = this.getLocalHM(checkIn);
      const cutoff = attendancePolicy.checkInCutoff;
      lateCheckin = hour > cutoff.hour || (hour === cutoff.hour && minute > cutoff.minute);
    }
    if (checkOut) {
      const { hour, minute } = this.getLocalHM(checkOut);
      const cutoff = attendancePolicy.checkOutCutoff;
      lateCheckout = hour < cutoff.hour || (hour === cutoff.hour && minute < cutoff.minute);
    }
    return {
      lateCheckin,
      lateCheckout,
      isLate: lateCheckin || lateCheckout,
    };
  }

  private logDebugFlags(flags: { lateCheckin: boolean; lateCheckout: boolean; isLate: boolean }, label: string) {
    if (process.env.DEBUG_ATTENDANCE === "true") {
      console.debug(`[attendance] ${label}`, flags);
    }
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Attendance[]> {
    await this.ensureSchema();
    const res = await pool.query(
      `select id,
              user_id as "userId",
              date,
              check_in as "timeIn",
              check_out as "timeOut",
              status,
              late_checkin as "lateCheckin",
              late_checkout as "lateCheckout",
              is_late as "isLate",
              notes,
              created_at as "createdAt",
              updated_at as "updatedAt"
         from attendance
        where user_id = $1
          and date >= $2::date
          and date <= $3::date
        order by date desc`,
      [userId, startDate, endDate],
    );
    return res.rows.map((row: any) => {
      const dateValue = row.date instanceof Date ? row.date : new Date(row.date);
      const timeIn = row.timeIn ?? row.timein ?? row.check_in ?? null;
      const timeOut = row.timeOut ?? row.timeout ?? row.check_out ?? null;
      const workingHours =
        timeIn && timeOut
          ? Math.max(
              0,
              (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60),
            )
          : undefined;
      return {
        ...row,
        date: dateValue,
        timeIn,
        timeOut,
        workingHours,
      } as Attendance;
    });
  }

  async getMonthlySummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceSummary> {
    const records = await this.findByUserIdAndDateRange(userId, startDate, endDate);

    const summary: AttendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
      totalDays: 0,
      workingDays: 0,
    };

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    summary.totalDays = daysDiff;

    for (const record of records) {
      switch (record.status) {
        case "Present":
          summary.present++;
          summary.workingDays++;
          break;
        case "Absent":
          summary.absent++;
          break;
        case "Late":
          summary.late++;
          summary.workingDays++;
          break;
        case "HalfDay":
          summary.halfDay++;
          summary.workingDays += 0.5;
          break;
        case "Leave":
          summary.leave++;
          break;
      }
    }

    const recordedDates = new Set(records.map(r => r.date.toDateString()));
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (!recordedDates.has(currentDate.toDateString())) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0) {
          summary.absent++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return summary;
  }

  async getSalaryDetails(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SalaryDetails> {
    const records = await this.findByUserIdAndDateRange(userId, startDate, endDate);

    let totalWorkingDays = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0) {
        totalWorkingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const details: SalaryDetails = {
      totalWorkingDays,
      daysPresent: 0,
      daysLate: 0,
      daysAbsent: 0,
      daysOnLeave: 0,
      effectiveWorkingDays: 0,
      totalWorkingHours: 0,
    };

    for (const record of records) {
      // Approximate hours if check in/out exist
      if (record.timeIn && record.timeOut) {
        const hoursWorked = (record.timeOut.getTime() - record.timeIn.getTime()) / (1000 * 60 * 60);
        details.totalWorkingHours += Math.max(0, hoursWorked);
      }

      switch (record.status) {
        case "Present":
          details.daysPresent++;
          details.effectiveWorkingDays++;
          break;
        case "Late":
          details.daysLate++;
          details.effectiveWorkingDays += 0.9;
          break;
        case "HalfDay":
          details.daysPresent += 0.5;
          details.effectiveWorkingDays += 0.5;
          break;
        case "Leave":
          details.daysOnLeave++;
          break;
        case "Absent":
          details.daysAbsent++;
          break;
      }
    }

    const recordedDates = new Set(records.map(r => r.date.toDateString()));
    const checkDate = new Date(startDate);
    while (checkDate <= endDate) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek !== 0 && !recordedDates.has(checkDate.toDateString())) {
        details.daysAbsent++;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return details;
  }

  async create(data: {
    userId: string;
    date: Date;
    timeIn?: Date | null;
    timeOut?: Date | null;
    status?: string;
    notes?: string;
  }): Promise<Attendance> {
    await this.ensureSchema();
    const flags = this.computeLateFlags(data.timeIn ?? null, data.timeOut ?? null);
    this.logDebugFlags(flags, "create");
    const status = data.status ?? (flags.isLate ? "Late" : "Present");
    const result = await pool.query(
      `insert into attendance (user_id, date, check_in, check_out, status, notes, late_checkin, late_checkout, is_late, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       returning id, user_id as "userId", date, check_in as "timeIn", check_out as "timeOut", status, notes,
                 late_checkin as "lateCheckin", late_checkout as "lateCheckout", is_late as "isLate",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.date,
        data.timeIn ?? null,
        data.timeOut ?? null,
        status,
        data.notes ?? null,
        flags.lateCheckin,
        flags.lateCheckout,
        flags.isLate,
      ],
    );
    const row = result.rows[0];
    const timeIn = row.timeIn ?? row.check_in ?? null;
    const timeOut = row.timeOut ?? row.check_out ?? null;
    return {
      ...row,
      timeIn,
      timeOut,
      lateCheckin: row.lateCheckin ?? flags.lateCheckin ?? false,
      lateCheckout: row.lateCheckout ?? flags.lateCheckout ?? false,
      isLate: row.isLate ?? flags.isLate ?? false,
      workingHours:
        timeIn && timeOut
          ? Math.max(0, (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60))
          : undefined,
    } as Attendance;
  }

  async checkIn(userId: string): Promise<Attendance> {
    await this.ensureSchema();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const existing = await pool.query(
      `select id from attendance where user_id = $1 and date = $2 limit 1`,
      [userId, todayStart],
    );

    const flags = this.computeLateFlags(now, null);
    this.logDebugFlags(flags, "check-in");
    const status = flags.isLate ? "Late" : "Present";

    if (existing.rows[0]) {
      const updated = await pool.query(
        `update attendance set check_in = $1, late_checkin = $2, is_late = $3, status = case when status = 'Absent' then $4 else (case when $3 then 'Late' else 'Present' end) end, updated_at = now() where id = $5
         returning id, user_id as "userId", date, check_in as "timeIn", check_out as "timeOut", status, notes,
                   late_checkin as "lateCheckin", late_checkout as "lateCheckout", is_late as "isLate"`,
        [now, flags.lateCheckin, flags.isLate, status, existing.rows[0].id],
      );
      const row = updated.rows[0];
      const timeIn = row.timeIn ?? row.check_in ?? null;
      const timeOut = row.timeOut ?? row.check_out ?? null;
      return {
        ...row,
        timeIn,
        timeOut,
        lateCheckin: row.lateCheckin ?? flags.lateCheckin ?? false,
        lateCheckout: row.lateCheckout ?? false,
        isLate: row.isLate ?? flags.isLate ?? false,
        workingHours:
          timeIn && timeOut
            ? Math.max(0, (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60))
            : undefined,
      } as Attendance;
    }

    return this.create({
      userId,
      date: todayStart,
      timeIn: now,
      status,
    });
  }

  async checkOut(userId: string): Promise<Attendance | null> {
    await this.ensureSchema();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const existing = await pool.query(
      `select id, check_in, late_checkin from attendance where user_id = $1 and date = $2 limit 1`,
      [userId, todayStart],
    );

    if (!existing.rows[0]) {
      return null;
    }

    const flags = this.computeLateFlags(existing.rows[0].check_in, now);
    this.logDebugFlags(flags, "check-out");
    const updated = await pool.query(
      `update attendance
         set check_out = $1,
             late_checkin = coalesce(late_checkin, $2),
             late_checkout = $3,
             is_late = coalesce(late_checkin, $2) or $3,
             status = case when status = 'Absent' then $4 else (case when coalesce(late_checkin, $2) or $3 then 'Late' else 'Present' end) end,
             updated_at = now()
       where id = $5
       returning id, user_id as "userId", date, check_in as "timeIn", check_out as "timeOut", status, notes,
                 late_checkin as "lateCheckin", late_checkout as "lateCheckout", is_late as "isLate"`,
      [now, flags.lateCheckin, flags.lateCheckout, flags.isLate ? "Late" : "Present", existing.rows[0].id],
    );
    
    const row = updated.rows[0];
    const timeIn = row.timeIn ?? row.check_in ?? null;
    const timeOut = row.timeOut ?? row.check_out ?? null;
    return {
      ...row,
      timeIn,
      timeOut,
      lateCheckin: row.lateCheckin ?? flags.lateCheckin ?? false,
      lateCheckout: row.lateCheckout ?? flags.lateCheckout ?? false,
      isLate: row.isLate ?? flags.isLate ?? false,
      workingHours:
        timeIn && timeOut
          ? Math.max(0, (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60))
          : undefined,
    } as Attendance;
  }
}

export const attendanceRepository = new AttendanceRepository();
