import { z } from "zod";

/** Legacy Add User form validation — shared with unit tests. */
export const userFormSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  fatherHusbandName: z.string().min(2, "Father/Husband name is required"),
  attendanceId: z.string().optional(),
  email: z.string().email("Valid email is required"),
  mobile: z.string().regex(/^\d+$/, "Digits only").max(11, "Max 11 digits"),
  guardianMobile: z
    .string()
    .regex(/^\d+$/, "Digits only")
    .max(11, "Max 11 digits")
    .optional()
    .or(z.literal("")),
  passportCnic: z.string().min(1, "Passport/CNIC is required"),
  facebookId: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  joinDate: z.string().min(1, "Join date is required"),
  roleType: z.array(z.string()).min(1, "At least one role is required"),
  underWorks: z.string().optional(),
  basicSalary: z.string().min(1, "Basic salary is required"),
  dailyAllowance: z.string().optional(),
  mobileAllowance: z.string().optional(),
  adminAllowance: z.string().optional(),
  conveyanceAllowance: z.string().optional(),
  relaxationMinutes: z.string().optional(),
  increment: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  address: z.string().optional(),
});

export type UserFormData = z.infer<typeof userFormSchema>;
