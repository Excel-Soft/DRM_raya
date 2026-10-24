/** Canonical Next.js paths for Attendance sidebar (HR module). */

export const ATTENDANCE_MAIN = "/hr/attendance" as const;
export const ATTENDANCE_TODO = "/hr/attendance/todo" as const;
export const ATTENDANCE_LEAVE = "/hr/leave-request" as const;
export const ATTENDANCE_OVERTIME = "/hr/overtime" as const;
export const ATTENDANCE_LOAN = "/hr/loan" as const;

export const ATTENDANCE_SIDEBAR_PATHS = [
  ATTENDANCE_MAIN,
  ATTENDANCE_TODO,
  ATTENDANCE_LEAVE,
  ATTENDANCE_OVERTIME,
  ATTENDANCE_LOAN,
] as const;
