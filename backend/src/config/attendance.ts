export const ATTENDANCE_TZ = "Asia/Karachi";
export const CHECK_IN_CUTOFF = { hour: 10, minute: 0 }; // 10:00 AM
export const CHECK_OUT_CUTOFF = { hour: 19, minute: 0 }; // 7:00 PM

export const attendancePolicy = {
  timezone: ATTENDANCE_TZ,
  checkInCutoff: CHECK_IN_CUTOFF,
  checkOutCutoff: CHECK_OUT_CUTOFF,
};
