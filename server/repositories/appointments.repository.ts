import { pool } from "../db";
import { customers, type Appointment } from "@shared/schema";

export type AppointmentWithCustomer = Appointment & {
  customer: typeof customers.$inferSelect;
};

export class AppointmentsRepository {
  async create(params: {
    userId: string;
    customerId: string;
    startsAt: Date;
    notes?: string | null;
    location?: string | null;
  }): Promise<AppointmentWithCustomer> {
    const sql = `
      insert into drm.appointments (customer_id, starts_at, assigned_to, notes, location, created_at, updated_at, is_deleted)
      values ($1, $2, $3, $4, $5, now(), now(), false)
      returning id, customer_id, starts_at, ends_at, notes, location
    `;
    const values = [
      params.customerId,
      params.startsAt,
      params.userId,
      params.notes ?? null,
      params.location ?? null,
    ];
    const result = await pool.query(sql, values);
    const row = result.rows[0];
    return {
      id: row.id,
      customerId: row.customer_id,
      userId: params.userId,
      startsAt: row.starts_at,
      endsAt: row.ends_at ?? null,
      notes: row.notes ?? row.location ?? "Meeting",
      location: row.location,
      createdAt: row.starts_at,
      isDeleted: false,
      customer: {} as any,
    } as any;
  }

  async findByUserId(userId: string, dateFrom?: Date, dateTo?: Date): Promise<AppointmentWithCustomer[]> {
    // Legacy columns: assigned_to, starts_at as date, ends_at optional
    const clauses: string[] = ["coalesce(a.is_deleted,false)=false", "a.assigned_to = $1"];
    const params: any[] = [userId];
    let i = 2;
    if (dateFrom) {
      clauses.push(`a.starts_at >= $${i++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`a.starts_at <= $${i++}`);
      params.push(dateTo);
    }
    const whereSql = `where ${clauses.join(" and ")}`;
    const sql = `
      select a.id as appointment_id, a.customer_id, a.starts_at, a.ends_at, a.notes, a.location,
             c.*
      from drm.appointments a
      left join drm.customers c on c.id = a.customer_id
      ${whereSql}
      order by a.starts_at asc
    `;
    const result = await pool.query(sql, params);
    return result.rows.map((row: any) => ({
      id: row.appointment_id,
      customerId: row.customer_id,
      userId,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      notes: row.notes ?? row.location ?? "Meeting",
      location: row.location,
      createdAt: row.created_at ?? row.starts_at,
      isDeleted: row.is_deleted ?? false,
      customer: row.id ? row : ({} as any),
    } as any));
  }

  async getTodayAppointments(userId: string): Promise<AppointmentWithCustomer[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.findByUserId(userId, startOfDay, endOfDay);
  }
}

export const appointmentsRepository = new AppointmentsRepository();
