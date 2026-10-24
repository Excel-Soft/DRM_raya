import { apiRequest } from "@/lib/query/query-client";
import type { UserFormData } from "./add-user-schema";

/** Build POST /api/users body — matches legacy add-user.tsx. */
export function buildCreateUserPayload(data: UserFormData) {
  const randomPassword =
    Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
  return {
    firstName: data.firstName,
    fatherHusbandName: data.fatherHusbandName,
    attendanceId: data.attendanceId,
    email: data.email,
    mobile: data.mobile,
    guardianMobile: data.guardianMobile,
    passportCnic: data.passportCnic,
    facebookId: data.facebookId,
    dateOfBirth: data.dateOfBirth,
    joinDate: data.joinDate,
    roleType: data.roleType[0],
    roles: data.roleType,
    role: data.roleType[0],
    underWorks: data.underWorks,
    basicSalary: data.basicSalary,
    dailyAllowance: data.dailyAllowance,
    mobileAllowance: data.mobileAllowance,
    adminAllowance: data.adminAllowance,
    conveyanceAllowance: data.conveyanceAllowance,
    relaxationMinutes: data.relaxationMinutes,
    increment: data.increment,
    gender: data.gender,
    address: data.address,
    password: randomPassword,
  };
}

export async function createUserRequest(data: UserFormData) {
  const response = await apiRequest("POST", "/api/users", buildCreateUserPayload(data));
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || result?.error || `Failed to add user (${response.status})`);
  }
  return result;
}
