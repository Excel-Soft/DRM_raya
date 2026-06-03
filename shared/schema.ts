import { sql } from "drizzle-orm";
import { pgTable, pgSchema, text, varchar, timestamp, integer, decimal, pgEnum, boolean, date, jsonb, primaryKey, uuid, index, serial } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const drmSchema = pgSchema("drm");

// Enums
export const pipelineStageEnum = drmSchema.enum("pipeline_stage", [
  "LD", "QF", "AY", "IN", "PM", "GM", "BV", "NC", "RC", "EC", "FW", "NF"
]);

export const customerStatusEnum = drmSchema.enum("customer_status", ["New", "Renew", "Expire"]);

export const activityMethodEnum = drmSchema.enum("activity_method", [
  "mobile", "whatsapp", "onsite", "email", "seminar", "webinar"
]);

export const followUpStatusEnum = drmSchema.enum("followup_status", ["Open", "Completed"]);
export const followUpMethodEnum = drmSchema.enum("followup_method", ["Call", "Email", "WhatsApp", "Visit"]);
export const followUpOutcomeEnum = drmSchema.enum("followup_outcome", ["Interested", "NotInterested", "CallBack", "NoAnswer", "Converted", "Lost"]);

export const targetTypeEnum = drmSchema.enum("target_type", ["AB", "VAS"]);

// PMS enums
export const projectStatusEnum = drmSchema.enum("project_status", ["Active", "Completed", "OnHold", "READY_FOR_QA", "IN_EXECUTION"]);
export const taskCategoryEnum = drmSchema.enum("task_category", ["Work", "Personal", "Meeting", "Announcement", "Other"]);
export const taskPriorityEnum = drmSchema.enum("task_priority", ["High", "Medium", "Low"]);
export const taskStatusEnum = drmSchema.enum("task_status", ["ToDo", "InProgress", "Blocked", "Completed", "READY_FOR_QA", "IN_EXECUTION"]);

// Product Posting Workflow enums
export const productInvoiceStatusEnum = drmSchema.enum("product_invoice_status", ["PENDING_HOD", "PENDING_ACCOUNT", "APPROVED", "REJECTED", "CANCELLED"]);
export const documentStatusEnum = drmSchema.enum("document_status", ["PENDING", "APPROVED", "REJECTED"]);
export const extensionStatusEnum = drmSchema.enum("extension_status", ["PENDING", "APPROVED", "REJECTED"]);
export const notificationTypeEnum = drmSchema.enum("notification_type", ["INFO", "WARNING", "SUCCESS", "ERROR"]);
export const notificationReadStatusEnum = drmSchema.enum("notification_read_status", ["UNREAD", "READ"]);

export const PRODUCT_POSTING_PHASE_KEYS = [
  "PENDING_PROJECT",
  "DATA_VERIFY",
  "PROJECT_OVERVIEW",
  "TASK_ASSIGNMENT",
  "RUNNING_PROJECT",
  "MANAGER_COMPLETE",
  "QA_REVIEW",
  "QA_COMPLETE",
  "VERIFICATION_PENDING",
  "VERIFICATION_COMPLETE",
  "RETURNED_FOR_CHANGE",
] as const;

export const PRODUCT_POSTING_PHASE_LABELS: Record<(typeof PRODUCT_POSTING_PHASE_KEYS)[number], string> = {
  PENDING_PROJECT: "Pending Project",
  DATA_VERIFY: "Data Verify",
  PROJECT_OVERVIEW: "Project Overview",
  TASK_ASSIGNMENT: "Task Assignment",
  RUNNING_PROJECT: "Running Project",
  MANAGER_COMPLETE: "Manager Complete",
  QA_REVIEW: "QA Review",
  QA_COMPLETE: "QA Complete",
  VERIFICATION_PENDING: "Verification Pending",
  VERIFICATION_COMPLETE: "Verification Complete",
  RETURNED_FOR_CHANGE: "Changing",
};

// Support enums
export const supportChannelEnum = drmSchema.enum("support_channel", ["whatsapp", "web", "email", "phone"]);
export const supportTicketStatusEnum = drmSchema.enum("support_ticket_status", ["Open", "InProgress", "Resolved", "Failed"]);
export const supportPriorityEnum = drmSchema.enum("support_priority", ["Low", "Medium", "High"]);
export const supportMessageFromEnum = drmSchema.enum("support_message_from", ["customer", "agent", "system"]);

// Attendance enum
export const attendanceStatusEnum = drmSchema.enum("attendance_status", ["Present", "Absent", "Late", "HalfDay", "Leave"]);

// Leave request enums
export const leaveTypeEnum = drmSchema.enum("leave_type", ["Sick", "Casual", "Annual", "Emergency", "HalfDay", "Unpaid", "Maternity", "Paternity", "Other"]);
export const leaveStatusEnum = drmSchema.enum("leave_status", ["Pending", "Approved", "Rejected", "Cancelled"]);

// Overtime enum
export const overtimeStatusEnum = drmSchema.enum("overtime_status", ["Pending", "Approved", "Rejected"]);

// Loan/Advance Salary enum
export const loanStatusEnum = drmSchema.enum("loan_status", ["Pending", "ManagerApproved", "HODApproved", "Rejected", "Completed"]);

// Pool type enum
export const poolTypeEnum = drmSchema.enum("pool_type", ["Private", "Service", "GMBV", "Public"]);

// Project approval status enum
export const projectApprovalStatusEnum = drmSchema.enum("project_approval_status", ["Pending", "Approved", "Rejected"]);

// Notice status enum
export const noticeStatusEnum = drmSchema.enum("notice_status", ["Active", "Inactive", "Archived"]);

// Payment method enum
export const paymentMethodEnum = drmSchema.enum("payment_method", ["Cash", "BankTransfer", "CreditCard", "Cheque", "Online"]);

// Training Center enums
export const trainingCategoryEnum = drmSchema.enum("training_category", ["DRM", "SEO", "Alibaba", "SalesTools"]);
export const trainingContentTypeEnum = drmSchema.enum("training_content_type", ["video", "document", "link"]);

// Temporary contact status enum
export const tempContactStatusEnum = drmSchema.enum("temp_contact_status", ["Pending", "Promoted", "Rejected"]);

export const servicePoolStatusEnum = drmSchema.enum("service_pool_status", ["active", "dropout", "completed", "refund", "temp", "pending"]);

// Users table
export const users = drmSchema.table("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  fullName: text("full_name"),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  passwordHash: text("password_hash"),
  roleId: text("role_id"),
  role: text("role"),
  roles: text("roles").array(),
  branch: text("branch").notNull().default("Lahore Gulburg"),
  country: text("country").notNull().default("Pakistan"),
  department: text("department"),
  designation: text("designation"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = drmSchema.table("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customers table
export const customers = drmSchema.table("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  accountName: text("account_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  region: text("region").notNull(),
  grade: text("grade").notNull(),
  status: customerStatusEnum("status").notNull().default("New"),
  ntn: text("ntn"),
  lastNote: text("last_note"),
  country: text("country"),
  city: text("city"),
  address: text("address"),
  crmId: text("crm_id"),
  crmDate: timestamp("crm_date"),
  companyType: text("company_type"),
  title: text("title"),
  personName: text("person_name"),
  cnic: text("cnic"),
  website: text("website"),
  mobile: text("mobile"),
  designation: text("designation"),
  comment: text("comment"),
  rcLink: text("rc_link"),
  source: text("source"),
  serviceTypes: text("service_types").array().default(sql`'{}'::text[]`),
  businessLine: text("business_line"),
  poolType: poolTypeEnum("pool_type").default("Private"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  lastFollowUpDate: timestamp("last_followup_date"),
  expiresAt: timestamp("expires_at"),
  isGoldMember: integer("is_gold_member").default(0),
  isBusinessVerified: integer("is_business_verified").default(0),
  isDeleted: boolean("is_deleted").default(false),
  abType: text("ab_type"),
  drmId: text("drm_id").unique(),
  phoneNormalized: text("phone_normalized"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerContacts = drmSchema.table("customer_contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(true),
  title: text("title"),
  personName: text("person_name"),
  accountHolderName: text("account_holder_name").notNull(),
  cnic: text("cnic"),
  ntn: text("ntn"),
  email: text("email").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Meetings (Reception Workflow)
export const meetingStatusEnum = drmSchema.enum("meeting_status", ["expected", "in_progress", "ended"]);
export const meetingPersonTypeEnum = drmSchema.enum("meeting_person_type", ["user", "contact", "external"]);

export const meetings = drmSchema.table("meetings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").references(() => customers.id),
  personType: meetingPersonTypeEnum("person_type").notNull().default("contact"),
  userId: uuid("user_id").references(() => users.id),
  contactId: uuid("contact_id").references(() => customerContacts.id),
  personName: text("person_name"),
  meetingType: text("meeting_type").notNull(),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull().defaultNow(),
  scheduledTime: text("scheduled_time"),
  lastContactTime: text("last_contact_time"),
  status: meetingStatusEnum("status").notNull().default("expected"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  totalDurationSeconds: integer("total_duration_seconds"), 
  fileUrl: text("file_url"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    statusIdx: index("idx_meeting_status").on(table.status),
    dateIdx: index("idx_meeting_date").on(table.meetingDate),
    companyIdx: index("idx_meeting_company").on(table.companyId),
  };
});

// Notices table
export const noticeAssignmentStatusEnum = drmSchema.enum("notice_assignment_status", ["created", "assigned", "unread", "read"]);

export const notices = drmSchema.table("notices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: noticeStatusEnum("status").notNull().default("Active"),
  assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id),
  assignedToRole: text("assigned_to_role"), // Optional: assign to a specific role
  assignedToDepartment: text("assigned_to_department"), // Optional: assign to a specific department
  assignedDate: timestamp("assigned_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const noticeAssignments = drmSchema.table("notice_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  noticeId: uuid("notice_id").notNull().references(() => notices.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  readStatus: noticeAssignmentStatusEnum("read_status").notNull().default("unread"),
});

// DRM Policies table (Penalty rules)
export const policyStatusEnum = drmSchema.enum("policy_status", ["active", "inactive"]);

export const drmPolicies = drmSchema.table("drm_policies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  head: text("head").notNull(),
  type: text("type"),
  fileUrl: text("file_url"),
  penalty: decimal("penalty", { precision: 10, scale: 2 }),
  minAllow: integer("min_allow"),
  maxAllow: integer("max_allow"),
  description: text("description"),
  status: policyStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});


// Temporary Contacts table
export const tempContacts = drmSchema.table("temp_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"), // Mr, Mrs, Ms, Dr, etc.
  personName: text("person_name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  country: text("country"),
  drmId: text("drm_id").unique(),
  source: text("source"), // Lead source
  grade: text("grade").notNull(), // A+, A-, B+, B-, C+, C, D
  comment: text("comment"),
  serviceTypes: text("service_types").array().default(sql`'{}'::text[]`),
  status: tempContactStatusEnum("status").notNull().default("Pending"),
  promotedToCustomerId: varchar("promoted_to_customer_id").references(() => customers.id),
  promotedAt: timestamp("promoted_at"),
  promotedByUserId: varchar("promoted_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Lead activities (logging user actions on leads/customers)
export const leadActivities = drmSchema.table("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  performedBy: varchar("performed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadServices = drmSchema.table("lead_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Opportunities (Customer stages in pipeline) - aligns with existing DB columns
export const opportunities = drmSchema.table("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  ownerUserId: varchar("owner_id").notNull().references(() => users.id),
  title: text("title"),
  stage: pipelineStageEnum("stage").notNull().default("LD"),
  amount: decimal("value", { precision: 10, scale: 2 }).default("0"),
  expectedCloseDate: date("expected_close_date"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Activities
export const activities = drmSchema.table("activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  type: text("type"),
  durationMinutes: integer("duration_minutes"),
  activityDate: timestamp("activity_date", { withTimezone: true }),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// FollowUps
export const followUps = drmSchema.table("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  dueAt: timestamp("due_at").notNull(),
  status: text("status").notNull().default("Open"),
  notes: text("notes"),
  method: text("method"),
  reservationType: text("reservation_type"),
  talkTimeSeconds: integer("talk_time_seconds").notNull().default(0),
  dateTime: timestamp("date_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const services = drmSchema.table("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followupServices = drmSchema.table("followup_services", {
  followupId: varchar("followup_id").notNull().references(() => followUps.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followupId, t.serviceId] }),
}));

export const serviceSubservices = drmSchema.table("service_subservices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followupSubservices = drmSchema.table("followup_subservices", {
  followupId: varchar("followup_id").notNull().references(() => followUps.id, { onDelete: "cascade" }),
  subserviceId: varchar("subservice_id").notNull().references(() => serviceSubservices.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followupId, t.subserviceId] }),
}));

export const callSessions = drmSchema.table("call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  followupId: varchar("followup_id").references(() => followUps.id),
  reservationType: text("reservation_type").notNull(),
  direction: text("direction").notNull().default("outbound"),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  provider: text("provider"),
  providerCallId: text("provider_call_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Appointments
export const appointments = drmSchema.table("appointments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("assigned_to").references(() => users.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Targets
export const targets = drmSchema.table("targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: targetTypeEnum("type").notNull(),
  name: text("name").notNull(),
  bonusType: text("bonus_type").notNull(), // "percentage" or "fixed"
  bonusValue: text("bonus_value").notNull(),
  priceTarget: text("price_target").notNull(),
  rewardText: text("reward_text").notNull(),
  kwaRequirement: text("kwa_requirement"),
  vasRequirement: text("vas_requirement"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// VAS Progress Snapshots
export const vasProgressSnapshots = drmSchema.table("vas_progress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== PMS / Project Management System Tables =====

// ====== Product Posting Workflow Invoices ======

export const productPostingInvoices = drmSchema.table("product_posting_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  salesExecId: uuid("sales_exec_id").notNull().references(() => users.id),
  customerId: uuid("customer_id").references(() => customers.id),
  projectName: text("project_name"),
  companyName: text("company_name"),
  status: text("status").notNull().default("PENDING_HOD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paymentMethod: varchar("payment_method"),
});

// Projects
export const projects = drmSchema.table("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").references(() => productPostingInvoices.id),
  customerId: uuid("customer_id").references(() => customers.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  workSpace: text("workspace"),
  status: text("status").notNull().default("Active"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tasks
export const tasks = drmSchema.table("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  participants: text("participants").array().notNull().default(sql`'{}'::text[]`),
  category: taskCategoryEnum("category").notNull().default("Work"),
  priority: taskPriorityEnum("priority").notNull().default("Medium"),
  status: taskStatusEnum("status").notNull().default("ToDo"),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Task Comments
export const taskComments = drmSchema.table("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== PMS Financial & Approval Tables =====

// Project Financials (one-to-one with projects)
export const projectFinancials = drmSchema.table("project_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  lastPaymentAt: timestamp("last_payment_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project Payments (transaction history)
export const projectPayments = drmSchema.table("project_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("BankTransfer"),
  reference: text("reference"),
  notes: text("notes"),
  paidByUserId: varchar("paid_by_user_id").references(() => users.id),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Project Approvals (HOD, Department approval workflow)
export const projectApprovals = drmSchema.table("project_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  status: projectApprovalStatusEnum("status").notNull().default("Pending"),
  requestedBy: uuid("requested_by").notNull().references(() => users.id), // Physical column: requested_by
  approvedBy: uuid("approved_by").references(() => users.id), // Physical column: approved_by
  approverUserId: varchar("approver_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project Assignments (team members assigned to projects)
export const projectAssignments = drmSchema.table("project_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("Member"), // "Lead", "Member", "Reviewer"
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Time Logs (for time tracking history)
export const taskTimeLogs = drmSchema.table("task_time_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  timeSpentMinutes: integer("duration_minutes").notNull().default(0),
  description: text("notes"),
  logDate: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Task Status History (for tracking task status changes)
export const taskStatusHistory = drmSchema.table("task_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  fromStatus: taskStatusEnum("from_status"),
  toStatus: taskStatusEnum("to_status").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  notes: text("notes"),
});

// ===== RBAC Permission Tables =====

// Permissions (granular permissions)
export const permissions = drmSchema.table("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  module: text("module").notNull(), // "customers", "pms", "hr", "support", "reports"
  action: text("action").notNull(), // "read", "write", "delete", "approve", "manage"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Role Permissions (junction table)
export const rolePermissions = drmSchema.table("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Impersonation Audit Logs
export const impersonationAuditLogs = drmSchema.table("impersonation_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  targetRole: varchar("target_role").notNull(),
  action: text("action").notNull(), // "start" or "stop"
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Support Tickets
export const supportTickets = drmSchema.table("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  channel: supportChannelEnum("channel").notNull().default("web"),
  subject: text("subject").notNull(),
  status: supportTicketStatusEnum("status").notNull().default("Open"),
  priority: supportPriorityEnum("priority").notNull().default("Medium"),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  dataSend: integer("data_send").notNull().default(0), // 0 = not sent, 1 = sent
  externalReference: text("external_reference"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Support Messages
export const supportMessages = drmSchema.table("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  from: supportMessageFromEnum("from").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Support Channel Config
export const supportChannelConfig = drmSchema.table("support_channel_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: supportChannelEnum("channel").notNull().unique(),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Settings enums
export const policyTypeEnum = drmSchema.enum("policy_type", ["text", "numericRange"]);

// Roles table
export const roles = drmSchema.table("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// URL Permissions table
export const urlPermissions = drmSchema.table("url_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull().unique(), // Acts as the 'menu' name key effectively if unique, or use another key
  name: text("name").notNull(), // Display Name e.g., "Users"
  menuIcon: text("menu_icon"), // Icon name from lucide-react
  allowedRoleIds: text("allowed_role_ids").array().notNull().default(sql`ARRAY[]::text[]`), // legacy fallback
  permissions: jsonb("permissions").default([]), // [{ name: "Admin", type: "admin" }]
  subUrls: jsonb("sub_urls"), // { isRoot: true, items: ["add-users"] }
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Policies table
export const policies = drmSchema.table("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value_json: jsonb("value_json").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Allowed IPs table
export const allowedIps = drmSchema.table("allowed_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ip_cidr: text("ip_cidr").notNull().unique(),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== HR / Attendance Tables =====

// Attendance Records
export const attendance = drmSchema.table("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  timeIn: timestamp("check_in"),
  timeOut: timestamp("check_out"),
  status: attendanceStatusEnum("status").notNull().default("Absent"),
  lateCheckin: boolean("late_checkin").notNull().default(false),
  lateCheckout: boolean("late_checkout").notNull().default(false),
  isLate: boolean("is_late").notNull().default(false),
  workingHours: decimal("working_hours", { precision: 4, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Leave Requests
export const leaveRequests = drmSchema.table("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  purpose: text("purpose").notNull(),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  alternative: text("alternative").notNull(),
  fromDate: timestamp("from_date").notNull(),
  toDate: timestamp("to_date").notNull(),
  time: text("time"),
  description: text("description"),
  status: leaveStatusEnum("status").notNull().default("Pending"),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Overtime Records
export const overtimeRecords = drmSchema.table("overtime_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  taskTitle: text("task_title").notNull(),
  timeSpent: integer("time_spent").notNull(), // in minutes
  taskDetails: text("task_details").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  status: overtimeStatusEnum("status").notNull().default("Pending"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Loan/Advance Salary Requests
export const loanRequests = drmSchema.table("loan_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  installmentAmount: decimal("installment_amount", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  detail: text("detail").notNull(),
  status: loanStatusEnum("status").notNull().default("Pending"),
  managerApprovedByUserId: varchar("manager_approved_by_user_id").references(() => users.id),
  managerApprovedAt: timestamp("manager_approved_at"),
  hodApprovedByUserId: varchar("hod_approved_by_user_id").references(() => users.id),
  hodApprovedAt: timestamp("hod_approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== Training Center Tables =====

// Training Modules
export const trainingModules = drmSchema.table("training_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: trainingCategoryEnum("category").notNull(),
  contentType: trainingContentTypeEnum("content_type").notNull().default("video"),
  contentUrl: text("content_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  estimatedMinutes: integer("estimated_minutes").default(30),
  orderIndex: integer("order_index").default(0),
  quizJson: text("quiz_json"), // JSON string: { questions: { question, options, correctIndex }[] }
  department: text("department"), // Optional: department-wise assignment
  isActive: integer("is_active").default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User Training Progress
export const trainingProgress = drmSchema.table("training_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  moduleId: varchar("module_id").notNull().references(() => trainingModules.id),
  isCompleted: integer("is_completed").default(0), // 0 = incomplete, 1 = completed
  quizScore: integer("quiz_score"),
  progressPercent: integer("progress_percent").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== Sales Manager / Team Performance Tables =====

// GM Pool status enum
export const gmPoolStatusEnum = drmSchema.enum("gm_pool_status", ["Active", "Pending", "Inactive"]);

// GM Pool Entries
export const gmPoolEntries = drmSchema.table("gm_pool_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  orderId: varchar("order_id").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  salesPersonId: varchar("sales_person_id").notNull().references(() => users.id),
  package: text("package").notNull(),
  dollarRate: decimal("dollar_rate", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  status: gmPoolStatusEnum("status").notNull().default("Pending"),
  hodApproved: integer("hod_approved").default(0), // 0 = pending, 1 = approved, -1 = rejected
  accountantVerified: integer("accountant_verified").default(0), // 0 = pending, 1 = verified, -1 = rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Queue Sales status enum
export const queueSalesStatusEnum = drmSchema.enum("queue_sales_status", ["Waiting", "InProgress", "Completed", "Cancelled"]);

// Queue Sales Entries
export const queueSalesEntries = drmSchema.table("queue_sales_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  salesPersonId: varchar("sales_person_id").notNull().references(() => users.id),
  priority: integer("priority").notNull().default(0),
  status: queueSalesStatusEnum("status").notNull().default("Waiting"),
  queueNumber: integer("queue_number"),
  estimatedTime: integer("estimated_time"), // in minutes
  notes: text("notes"),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Team Performance Snapshots
export const teamPerformanceSnapshots = drmSchema.table("team_performance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).default("0"),
  totalLeads: integer("total_leads").default(0),
  convertedLeads: integer("converted_leads").default(0),
  activitiesCount: integer("activities_count").default(0),
  callMinutes: integer("call_minutes").default(0),
  meetingsCount: integer("meetings_count").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  avgDealSize: decimal("avg_deal_size", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== Task Templates (Reusable task definitions) =====

// Task Templates - reusable tasks that can repeat daily
export const taskTemplates = drmSchema.table("task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  time: integer("time").notNull(), // time in minutes
  detail: text("detail"),
  repeatDaily: integer("repeat_daily").notNull().default(0), // 0 = no, 1 = yes
  department: text("department"), // optional: department-specific templates
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== Account Module =====

// GM Entry type enum
export const gmEntryTypeEnum = drmSchema.enum("gm_entry_type", ["GM", "TempGM", "RefundGM"]);

// GM Entry status enum
export const gmEntryStatusEnum = drmSchema.enum("gm_entry_status", ["Pending", "Approved", "Rejected", "Completed"]);

// Invoice status enum
export const invoiceStatusEnum = drmSchema.enum("invoice_status", ["Draft", "Pending", "Sent", "Paid", "Overdue", "Cancelled"]);

// Ledger entry type enum
export const ledgerEntryTypeEnum = drmSchema.enum("ledger_entry_type", ["Credit", "Debit"]);

// GM Entries (GM, Temp GM, Refund GM)
export const gmEntries = drmSchema.table("gm_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmType: gmEntryTypeEnum("gm_type").notNull().default("GM"),
  drmId: text("drm_id").notNull(),
  memberId: text("member_id"),
  orderId: text("order_id"),
  companyName: text("company_name").notNull(),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  salesPersonName: text("sales_person_name"),
  addedByName: text("added_by_name"),
  packageType: text("package_type").notNull(),
  entryType: text("entry_type").notNull(), // New, Rc, Rc-Up, Renewal, etc.
  amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }).notNull(),
  customerDollar: decimal("customer_dollar", { precision: 12, scale: 2 }),
  dollarRate: decimal("dollar_rate", { precision: 12, scale: 4 }),
  amountPkr: decimal("amount_pkr", { precision: 15, scale: 2 }),
  alibabaDiscountUsd: decimal("alibaba_discount_usd", { precision: 12, scale: 2 }),
  finalOrderUsd: decimal("final_order_usd", { precision: 12, scale: 2 }),
  extraDiscountUsd: decimal("extra_discount_usd", { precision: 12, scale: 2 }),
  extraDiscountPkr: decimal("extra_discount_pkr", { precision: 15, scale: 2 }),
  // New fields for HOD approval form
  extraDiscountHod: decimal("extra_discount_hod", { precision: 12, scale: 2 }),
  installments: jsonb("installments"), // [{ dollar, pkr, chequeNo, payDate }]
  paymentStatus: text("payment_status"),

  status: gmEntryStatusEnum("status").notNull().default("Pending"),
  isLoan: integer("is_loan").notNull().default(0),
  isPartialPayment: integer("is_partial_payment").notNull().default(0),
  isDeleted: boolean("is_deleted").default(false),
  notes: text("notes"),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),

  // Update request fields
  updateRequestStatus: text("update_request_status"),
  updateRequestedAt: timestamp("update_requested_at"),
  updateRequestedBy: uuid("update_requested_by").references(() => users.id),
  superHodStatus: text("super_hod_status"),
  superHodActionedBy: uuid("super_hod_actioned_by").references(() => users.id),
  superHodActionedAt: timestamp("super_hod_actioned_at"),

  // Withdrawal fields
  withdrawalStatus: text("withdrawal_status"),
  withdrawalReason: text("withdrawal_reason"),
  withdrawalRequestedAt: timestamp("withdrawal_requested_at"),
  withdrawalRequestedBy: uuid("withdrawal_requested_by").references(() => users.id),
  withdrawalActionedBy: uuid("withdrawal_actioned_by").references(() => users.id),
  withdrawalActionedAt: timestamp("withdrawal_actioned_at"),

  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Temporary GM Entries (for Add Temporary GM screen)
export const tempGmEntries = drmSchema.table("temp_gm_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  personName: text("person_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  amountType: text("amount_type").notNull().default("PKR"),
  reason: text("reason").notNull(),
  comment: text("comment"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Refund GM Entries (for Add Refund GM screen)
export const refundGmEntries = drmSchema.table("refund_gm_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  personName: text("person_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  amountType: text("amount_type").notNull().default("PKR"), // PKR, Dollar
  comment: text("comment"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Donations
export const donations = drmSchema.table("donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  title: text("title").notNull().default("Mr."), // Mr., Ms., Dr., etc.
  personName: text("person_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"), // PKR, Dollar
  comment: text("comment"),
  status: text("status").notNull().default("Pending"),
  paymentProof: text("payment_proof"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// BV Entries (Business Verification)
export const bvEntries = drmSchema.table("bv_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  packageType: text("package_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 12, scale: 2 }),
  reward: decimal("reward", { precision: 12, scale: 2 }),
  vasAmount: decimal("vas_amount", { precision: 12, scale: 2 }),
  kwaAmount: decimal("kwa_amount", { precision: 12, scale: 2 }),
  method: text("method"),
  personName: text("person_name"),
  payAmount: decimal("pay_amount", { precision: 12, scale: 2 }),
  bvAmount: decimal("bv_amount", { precision: 12, scale: 2 }),
  entryType: text("entry_type"), // Rc, New
  type: text("type"), // 2021-07-13 17:08:25 (from screenshot seems like date or type?) Using as date string for now or specific type field
  receivedAt: timestamp("received_at").defaultNow(),
  salesPersonId: uuid("sales_person_id").references(() => users.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoices
export const invoices = drmSchema.table("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: invoiceStatusEnum("status").notNull().default("Draft"),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  items: text("items").notNull(), // JSON string of invoice line items
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paymentMethod: varchar("payment_method"),
});

// Company Ledger entries
export const ledgerEntries = drmSchema.table("ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryType: ledgerEntryTypeEnum("entry_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  category: text("category").notNull(), // Revenue, Expense, Invoice, GM, Donation, Refund, etc.
  date: timestamp("date").notNull().defaultNow(),
  referenceId: varchar("reference_id"), // Links to invoice, gm_entry, donation, etc.
  referenceType: text("reference_type"), // "invoice", "gm_entry", "donation", etc.
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }),
  entryDate: timestamp("entry_date").notNull().defaultNow(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const servicePoolEntries = drmSchema.table("service_pool_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  serviceCode: text("service_code"),
  subserviceCode: text("subservice_code"),
  servicePersonId: uuid("service_person_id").references(() => users.id),
  salesPersonId: uuid("sales_person_id").references(() => users.id),
  taPersonId: uuid("ta_person_id").references(() => users.id),
  status: servicePoolStatusEnum("status").notNull().default("active"),
  dropoutCategory: text("dropout_category"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== Password Reset / OTP Tables =====



// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertFollowUpSchema = createInsertSchema(followUps, {
  dueAt: z.coerce.date(),
  dateTime: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertTargetSchema = createInsertSchema(targets).omit({
  id: true,
  createdAt: true,
});

export const insertVasProgressSnapshotSchema = createInsertSchema(vasProgressSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  sentAt: true,
});

export const insertSupportChannelConfigSchema = createInsertSchema(supportChannelConfig).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const insertUrlPermissionSchema = createInsertSchema(urlPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAllowedIpSchema = createInsertSchema(allowedIps).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedByUserId: true,
  approvedAt: true,
  rejectionReason: true,
}).extend({
  fromDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  toDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertOvertimeRecordSchema = createInsertSchema(overtimeRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedByUserId: true,
  reviewedAt: true,
  rejectionReason: true,
}).extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertLoanRequestSchema = createInsertSchema(loanRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  remainingAmount: true,
  managerApprovedByUserId: true,
  managerApprovedAt: true,
  hodApprovedByUserId: true,
  hodApprovedAt: true,
  rejectionReason: true,
}).extend({
  amount: z.union([z.number(), z.string().transform((str) => parseFloat(str))]),
  installmentAmount: z.union([z.number(), z.string().transform((str) => parseFloat(str))]),
});

// Admin-specific schema that requires userId for submitting on behalf of employees
export const insertLoanRequestAdminSchema = insertLoanRequestSchema.extend({
  userId: z.string().uuid("Invalid user ID format"),
});

export const insertTempContactSchema = createInsertSchema(tempContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  promotedToCustomerId: true,
  promotedAt: true,
  promotedByUserId: true,
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
});

export const insertLeadServiceSchema = createInsertSchema(leadServices).omit({
  id: true,
  createdAt: true,
});

export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingProgressSchema = createInsertSchema(trainingProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGmPoolEntrySchema = createInsertSchema(gmPoolEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQueueSalesEntrySchema = createInsertSchema(queueSalesEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamPerformanceSnapshotSchema = createInsertSchema(teamPerformanceSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  isActive: true,
}).extend({
  repeatDaily: z.coerce.number().int().min(0).max(1).default(0),
});

export const updateTaskTemplateSchema = insertTaskTemplateSchema.partial();

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;

export const insertProjectFinancialSchema = createInsertSchema(projectFinancials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectPaymentSchema = createInsertSchema(projectPayments).omit({
  id: true,
  createdAt: true,
}).extend({
  paidAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertProjectApprovalSchema = createInsertSchema(projectApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approverUserId: true,
  approvedAt: true,
  rejectionReason: true,
});

export const insertProjectAssignmentSchema = createInsertSchema(projectAssignments).omit({
  id: true,
  createdAt: true,
  assignedAt: true,
});

export const insertTaskTimeLogSchema = createInsertSchema(taskTimeLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  logDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertTaskStatusHistorySchema = createInsertSchema(taskStatusHistory).omit({
  id: true,
  changedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServicePoolEntrySchema = createInsertSchema(servicePoolEntries).omit({
  id: true,
  startedAt: true,
  updatedAt: true,
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type FollowUp = typeof followUps.$inferSelect;
export type Service = typeof services.$inferSelect;
export type FollowupService = typeof followupServices.$inferSelect;
export type InsertFollowupService = typeof followupServices.$inferInsert;
export type ServiceSubservice = typeof serviceSubservices.$inferSelect;
export type InsertServiceSubservice = typeof serviceSubservices.$inferInsert;
export type FollowupSubservice = typeof followupSubservices.$inferSelect;
export type InsertFollowupSubservice = typeof followupSubservices.$inferInsert;

export type ServicePoolEntry = typeof servicePoolEntries.$inferSelect;
export type InsertServicePoolEntry = z.infer<typeof insertServicePoolEntrySchema>;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type Target = typeof targets.$inferSelect;

export type InsertVasProgressSnapshot = z.infer<typeof insertVasProgressSnapshotSchema>;
export type VasProgressSnapshot = typeof vasProgressSnapshots.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;

export type InsertSupportChannelConfig = z.infer<typeof insertSupportChannelConfigSchema>;
export type SupportChannelConfig = typeof supportChannelConfig.$inferSelect;

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export type InsertUrlPermission = z.infer<typeof insertUrlPermissionSchema>;
export type UrlPermission = typeof urlPermissions.$inferSelect;

export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policies.$inferSelect;

export type InsertAllowedIp = z.infer<typeof insertAllowedIpSchema>;
export type AllowedIp = typeof allowedIps.$inferSelect;

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;

export type InsertOvertimeRecord = z.infer<typeof insertOvertimeRecordSchema>;
export type OvertimeRecord = typeof overtimeRecords.$inferSelect;

export type InsertLoanRequest = z.infer<typeof insertLoanRequestSchema>;
export type LoanRequest = typeof loanRequests.$inferSelect;

export type InsertTempContact = z.infer<typeof insertTempContactSchema>;
export type TempContact = typeof tempContacts.$inferSelect;

export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

export type InsertLeadService = z.infer<typeof insertLeadServiceSchema>;
export type LeadService = typeof leadServices.$inferSelect;

export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;
export type TrainingModule = typeof trainingModules.$inferSelect;

export type InsertTrainingProgress = z.infer<typeof insertTrainingProgressSchema>;
export type TrainingProgress = typeof trainingProgress.$inferSelect;

export type InsertGmPoolEntry = z.infer<typeof insertGmPoolEntrySchema>;
export type GmPoolEntry = typeof gmPoolEntries.$inferSelect;

export type InsertQueueSalesEntry = z.infer<typeof insertQueueSalesEntrySchema>;
export type QueueSalesEntry = typeof queueSalesEntries.$inferSelect;

export type InsertTeamPerformanceSnapshot = z.infer<typeof insertTeamPerformanceSnapshotSchema>;
export type TeamPerformanceSnapshot = typeof teamPerformanceSnapshots.$inferSelect;

export type InsertProjectFinancial = z.infer<typeof insertProjectFinancialSchema>;
export type ProjectFinancial = typeof projectFinancials.$inferSelect;

export type InsertProjectPayment = z.infer<typeof insertProjectPaymentSchema>;
export type ProjectPayment = typeof projectPayments.$inferSelect;

export type InsertProjectApproval = z.infer<typeof insertProjectApprovalSchema>;
export type ProjectApproval = typeof projectApprovals.$inferSelect;

export type InsertProjectAssignment = z.infer<typeof insertProjectAssignmentSchema>;
export type ProjectAssignment = typeof projectAssignments.$inferSelect;

export type InsertTaskTimeLog = z.infer<typeof insertTaskTimeLogSchema>;
export type TaskTimeLog = typeof taskTimeLogs.$inferSelect;

export type InsertTaskStatusHistory = z.infer<typeof insertTaskStatusHistorySchema>;
export type TaskStatusHistory = typeof taskStatusHistory.$inferSelect;

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;

export const insertDrmPolicySchema = createInsertSchema(drmPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  penalty: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().optional()),
  minAllow: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().int().optional()),
  maxAllow: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().int().optional()),
});
export type DrmPolicy = typeof drmPolicies.$inferSelect;
export type InsertDrmPolicy = z.infer<typeof insertDrmPolicySchema>;

// Office Account Tables
export const accountHeadCategoryEnum = drmSchema.enum("account_head_category", ["Assets", "Liabilities", "OwnerEquity", "Revenue", "Expenses"]);

export const accountHeads = drmSchema.table("account_heads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: accountHeadCategoryEnum("category").notNull(),
  type: text("type").notNull(), // e.g., Current Asset, Fixed Asset, etc.
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const officeExpenses = drmSchema.table("office_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseHead: text("expense_head").notNull(),
  office: text("office").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),
  voucherNumber: text("voucher_number"),
  chequeNumber: text("cheque_number"),
  fileUrl: text("file_url"),
  detail: text("detail"),
  expenseDate: timestamp("expense_date").notNull().defaultNow(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const officeVas = drmSchema.table("office_vas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),
  method: text("method").notNull(), // Cash, Bank, Online
  vasDate: timestamp("vas_date").notNull().defaultNow(),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chequeStatusEnum = drmSchema.enum("cheque_status", ["Pending", "Cleared", "Bounced", "Cancelled"]);

export const cheques = drmSchema.table("cheques", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chequeNumber: text("cheque_number").notNull(),
  bankName: text("bank_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),
  companyName: text("company_name").notNull(),
  chequeDate: timestamp("cheque_date").notNull(),
  status: chequeStatusEnum("status").notNull().default("Pending"),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const businessCustomers = drmSchema.table("business_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  cnic: text("cnic"),
  ntn: text("ntn"),
  address: text("address"),
  totalPaid: decimal("total_paid", { precision: 15, scale: 2 }).notNull().default("0"),
  totalDue: decimal("total_due", { precision: 15, scale: 2 }).notNull().default("0"),
  isActive: integer("is_active").notNull().default(1),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Dollar Buying module
export const dollarBuyers = drmSchema.table("dollar_buyers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  reference: text("reference"),
  paypalEmail: text("paypal_email"),
  accountNo: text("account_no"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dollarBuying = drmSchema.table("dollar_buying", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => dollarBuyers.id),
  buyerName: text("buyer_name"), 
  buyerReference: text("buyer_reference"),
  paypalEmail: text("paypal_email"),
  accountNo: text("account_no"),
  chequeId: text("cheque_id"),
  paymentMethod: text("payment_method"),
  type: text("type"), // New, Renewal
  dollarAmount: decimal("dollar_amount", { precision: 12, scale: 2 }).notNull(),
  dollarRate: decimal("dollar_rate", { precision: 12, scale: 2 }).notNull(),
  pkrAmount: decimal("pkr_amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull().defaultNow(),
  screenshotUrl: text("screenshot_url"),
  detail: text("detail"),
  martini: text("martini").default("Show"),
  createdById: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDollarBuyerSchema = createInsertSchema(dollarBuyers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDollarBuyingSchema = createInsertSchema(dollarBuying).omit({ id: true, createdAt: true, updatedAt: true, createdById: true }).extend({
  date: z.coerce.date().optional(),
});

export type DollarBuyer = typeof dollarBuyers.$inferSelect;
export type InsertDollarBuyer = z.infer<typeof insertDollarBuyerSchema>;
export type DollarBuying = typeof dollarBuying.$inferSelect;
export type InsertDollarBuying = z.infer<typeof insertDollarBuyingSchema>;

// Account Module schemas
export const insertGmEntrySchema = createInsertSchema(gmEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  approvedByUserId: true,
  approvedAt: true,
  salesPersonId: true,
}).extend({
  isLoan: z.union([z.boolean(), z.number()]).transform(v => typeof v === 'boolean' ? (v ? 1 : 0) : v).optional(),
  isPartialPayment: z.union([z.boolean(), z.number()]).transform(v => typeof v === 'boolean' ? (v ? 1 : 0) : v).optional(),
});

export const insertDonationSchema = createInsertSchema(donations).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
}).extend({
  issueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
}).extend({
  activityDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

// IT Assets Tables
export const itServers = drmSchema.table("it_servers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  provider: text("provider"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const itRegistries = drmSchema.table("it_registries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url"),
  credentials: text("credentials"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const itHostingPackages = drmSchema.table("it_hosting_packages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  capacity: text("capacity"),
  price: decimal("price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const itDomains = drmSchema.table("it_domains", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").references(() => customers.id),
  domainName: text("domain_name").notNull().unique(),
  registryId: uuid("registry_id").references(() => itRegistries.id),
  serverId: uuid("server_id").references(() => itServers.id),
  hostingPackageId: uuid("hosting_package_id").references(() => itHostingPackages.id),
  cpanelUsername: text("cpanel_username"),
  cpanelPassword: text("cpanel_password"),
  activationDate: timestamp("activation_date"),
  expiryDate: timestamp("expiry_date"),
  sslExpiryDate: timestamp("ssl_expiry_date"),
  hostingExpiryDate: timestamp("hosting_expiry_date"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const itBackups = drmSchema.table("it_backups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: uuid("domain_id").references(() => itDomains.id, { onDelete: "cascade" }),
  personName: text("person_name"),
  backupType: text("backup_type").notNull(), // Full, Partial
  backupUrl: text("backup_url"),
  details: text("details"),
  backupDate: timestamp("backup_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// IT Asset Zod Schemas
export const insertItServerSchema = createInsertSchema(itServers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItRegistrySchema = createInsertSchema(itRegistries).omit({ id: true, createdAt: true });
export const insertItHostingPackageSchema = createInsertSchema(itHostingPackages).omit({ id: true, createdAt: true });
export const insertItDomainSchema = createInsertSchema(itDomains).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  activationDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  sslExpiryDate: z.coerce.date().optional(),
  hostingExpiryDate: z.coerce.date().optional(),
});
export const insertItBackupSchema = createInsertSchema(itBackups).omit({ id: true, createdAt: true }).extend({
  backupDate: z.coerce.date().optional(),
});

export type ItServer = typeof itServers.$inferSelect;
export type ItRegistry = typeof itRegistries.$inferSelect;
export type ItHostingPackage = typeof itHostingPackages.$inferSelect;
export type ItDomain = typeof itDomains.$inferSelect;
export type ItBackup = typeof itBackups.$inferSelect;

export type InsertItServer = z.infer<typeof insertItServerSchema>;
export type InsertItRegistry = z.infer<typeof insertItRegistrySchema>;
export type InsertItHostingPackage = z.infer<typeof insertItHostingPackageSchema>;
export type InsertItDomain = z.infer<typeof insertItDomainSchema>;
export type InsertItBackup = z.infer<typeof insertItBackupSchema>;

export const insertTempGmEntrySchema = createInsertSchema(tempGmEntries).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
  status: true,
});

export const insertRefundGmEntrySchema = createInsertSchema(refundGmEntries).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
  status: true,
});

// Account Module types
export type InsertGmEntry = z.infer<typeof insertGmEntrySchema>;
export type GmEntry = typeof gmEntries.$inferSelect;

export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Donation = typeof donations.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export type InsertTempGmEntry = z.infer<typeof insertTempGmEntrySchema>;
export type TempGmEntry = typeof tempGmEntries.$inferSelect;

export type InsertRefundGmEntry = z.infer<typeof insertRefundGmEntrySchema>;
export type RefundGmEntry = typeof refundGmEntries.$inferSelect;

// Office Account schemas
export const insertAccountHeadSchema = createInsertSchema(accountHeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
});

export const insertOfficeExpenseSchema = createInsertSchema(officeExpenses).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
}).extend({
  expenseDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertOfficeVasSchema = createInsertSchema(officeVas).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
}).extend({
  vasDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export const insertChequeSchema = createInsertSchema(cheques).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
}).extend({
  chequeDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertBusinessCustomerSchema = createInsertSchema(businessCustomers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  totalPaid: true,
  totalDue: true,
});

// Office Account types
export type InsertAccountHead = z.infer<typeof insertAccountHeadSchema>;
export type AccountHead = typeof accountHeads.$inferSelect;

export type InsertOfficeExpense = z.infer<typeof insertOfficeExpenseSchema>;
export type OfficeExpense = typeof officeExpenses.$inferSelect;

export type InsertOfficeVas = z.infer<typeof insertOfficeVasSchema>;
export type OfficeVas = typeof officeVas.$inferSelect;

export type InsertCheque = z.infer<typeof insertChequeSchema>;
export type Cheque = typeof cheques.$inferSelect;

export type InsertBusinessCustomer = z.infer<typeof insertBusinessCustomerSchema>;
export type BusinessCustomer = typeof businessCustomers.$inferSelect;

export type CallSession = typeof callSessions.$inferSelect;
export type InsertCallSession = typeof callSessions.$inferInsert;

// Reports & Analytics Tables
export const userActivityTypeEnum = drmSchema.enum("user_activity_type", ["GM", "Invoice", "Refund", "Donation", "Expense", "VAS", "Cheque", "Customer", "Project", "Task"]);

export const userActivities = drmSchema.table("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  department: text("department").notNull().default("Sales"),
  actionType: userActivityTypeEnum("action_type").notNull(),
  actionDescription: text("action_description"),
  referenceId: varchar("reference_id"), // ID of the related record
  referenceType: text("reference_type"), // Table name
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: text("currency").default("PKR"),
  companyName: text("company_name"),
  office: text("office"),
  activityDate: timestamp("activity_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
}).extend({
  activityDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// BV Reports
export const bvReports = drmSchema.table("bv_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  companyName: text("company_name"),
  reportDate: timestamp("report_date").notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  totalTasks: integer("total_tasks").notNull().default(0),
  valueSold: decimal("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  successRate: decimal("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  followUpsDone: integer("follow_ups_done").notNull().default(0),
  missedLeads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const bvStatusEnum = z.enum(["Draft", "Submitted", "Approved", "Rejected"]);
const emptyToNull = (val: unknown) => {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return val;
};
export const insertBvReportSchema = z.object({
  title: z.preprocess(
    val => emptyToNull(val),
    z.string().trim().min(2).max(120)
  ),
  status: z.preprocess(val => (typeof val === "string" ? val.trim() : val), bvStatusEnum).default("Draft"),
  assignedTo: z.string().uuid().optional(),
  companyName: z.preprocess(
    val => emptyToNull(val),
    z.string().trim().min(2).max(160).optional()
  ),
  customerId: z.preprocess(
    val => {
      if (val === undefined) return undefined;
      const cleaned = emptyToNull(val);
      return cleaned;
    },
    z.string().uuid().nullable().optional()
  ),
  reportDate: z.preprocess(
    val => {
      if (val instanceof Date) return val;
      if (typeof val === "string") return new Date(val);
      return val;
    },
    z.date()
  ),
  totalTasks: z.coerce.number().int().min(0).default(0),
  valueSold: z.coerce.number().min(0).default(0),
  successRate: z.coerce.number().min(0).max(100).default(0),
  followUpsDone: z.coerce.number().int().min(0).default(0),
  missedLeads: z.coerce.number().int().min(0).default(0),
  summary: z.preprocess(emptyToNull, z.string().trim().min(2).max(2000).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().min(2).max(2000).nullable().optional()),
  meta: z.unknown().optional(),
});
export type InsertBvReport = z.infer<typeof insertBvReportSchema>;
export type BvReport = typeof bvReports.$inferSelect;

// Loan/VAS/GM Reports (simple metrics aligned with BV style)
export const loanReports = drmSchema.table("loan_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  reportDate: timestamp("report_date").notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  totalTasks: integer("total_tasks").notNull().default(0),
  valueSold: decimal("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  successRate: decimal("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  followUpsDone: integer("follow_ups_done").notNull().default(0),
  missedLeads: integer("missed_leads").notNull().default(0),
  totalApplications: integer("total_applications").notNull().default(0),
  approvedLoans: integer("approved_loans").notNull().default(0),
  rejectedLoans: integer("rejected_loans").notNull().default(0),
  pendingLoans: integer("pending_loans").notNull().default(0),
  totalLoanAmount: decimal("total_loan_amount", { precision: 16, scale: 2 }).notNull().default("0"),
  disbursedAmount: decimal("disbursed_amount", { precision: 16, scale: 2 }).notNull().default("0"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vasReports = drmSchema.table("vas_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  reportDate: timestamp("report_date").notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  totalTasks: integer("total_tasks").notNull().default(0),
  valueSold: decimal("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  successRate: decimal("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  followUpsDone: integer("follow_ups_done").notNull().default(0),
  missedLeads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gmReports = drmSchema.table("gm_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  reportDate: timestamp("report_date").notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  totalTasks: integer("total_tasks").notNull().default(0),
  valueSold: decimal("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  successRate: decimal("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  followUpsDone: integer("follow_ups_done").notNull().default(0),
  missedLeads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLoanReportSchema = createInsertSchema(loanReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  customerId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const trimmed = v.trim();
      return z.string().uuid().safeParse(trimmed).success ? trimmed : undefined;
    }),
  reportDate: z.union([z.string(), z.date()]).optional(),
  totalTasks: z.coerce.number().optional(),
  valueSold: z.coerce.number().optional(),
  successRate: z.coerce.number().optional(),
  followUpsDone: z.coerce.number().optional(),
  missedLeads: z.coerce.number().optional(),
  totalApplications: z.coerce.number().optional(),
  approvedLoans: z.coerce.number().optional(),
  rejectedLoans: z.coerce.number().optional(),
  pendingLoans: z.coerce.number().optional(),
  totalLoanAmount: z.coerce.number().optional(),
  disbursedAmount: z.coerce.number().optional(),
});
export const insertVasReportSchema = createInsertSchema(vasReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  customerId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const trimmed = v.trim();
      return z.string().uuid().safeParse(trimmed).success ? trimmed : undefined;
    }),
  reportDate: z.union([z.string(), z.date()]).optional(),
  totalTasks: z.coerce.number().optional(),
  valueSold: z.coerce.number().optional(),
  successRate: z.coerce.number().optional(),
  followUpsDone: z.coerce.number().optional(),
  missedLeads: z.coerce.number().optional(),
});
export const insertGmReportSchema = createInsertSchema(gmReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  customerId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const trimmed = v.trim();
      return z.string().uuid().safeParse(trimmed).success ? trimmed : undefined;
    }),
  reportDate: z.union([z.string(), z.date()]).optional(),
  totalTasks: z.coerce.number().optional(),
  valueSold: z.coerce.number().optional(),
  successRate: z.coerce.number().optional(),
  followUpsDone: z.coerce.number().optional(),
  missedLeads: z.coerce.number().optional(),
});

export type InsertLoanReport = z.infer<typeof insertLoanReportSchema>;
export type InsertVasReport = z.infer<typeof insertVasReportSchema>;
export type InsertGmReport = z.infer<typeof insertGmReportSchema>;
export type LoanReport = typeof loanReports.$inferSelect;
export type VasReport = typeof vasReports.$inferSelect;
export type GmReport = typeof gmReports.$inferSelect;

export const attributes = drmSchema.table("attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: varchar("category", { length: 100 }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAttributeSchema = createInsertSchema(attributes);
export const selectAttributeSchema = createSelectSchema(attributes);

// ===== Product Posting Workflow Tables =====

export const projectDetails = drmSchema.table("project_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  packageName: text("package_name"),
  minisiteUrl: text("minisite_url"),
  phone: text("phone"),
  mobile: text("mobile"),
  address: text("address"),
  reference: text("reference"),
  categories: text("categories"),
  detailNotes: text("detail_notes"),
  evidenceUrl: text("evidence_url"), // Logo/Banner/Certificates link
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectDocuments = drmSchema.table("project_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  documentUrl: text("document_url").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskTimeExtensions = drmSchema.table("task_time_extensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  requestedTimeMinutes: integer("requested_time_minutes").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskResults = drmSchema.table("task_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  linksPosted: integer("links_posted").notNull().default(0),
  totalDurationMinutes: integer("total_duration_minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productPostingPhaseDefinitions = drmSchema.table("product_posting_phase_definitions", {
  phaseKey: varchar("phase_key", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isTerminal: boolean("is_terminal").notNull().default(false),
  canReturn: boolean("can_return").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productPostingWorkflows = drmSchema.table("product_posting_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }).unique(),
  currentPhase: text("current_phase").notNull().default("PENDING_PROJECT"),
  salespersonUploadedAt: timestamp("salesperson_uploaded_at"),
  dataVerifiedAt: timestamp("data_verified_at"),
  assignedAt: timestamp("assigned_at"),
  assignedDurationMinutes: integer("assigned_duration_minutes").notNull().default(0),
  executionStartedAt: timestamp("execution_started_at"),
  executiveSubmittedAt: timestamp("executive_submitted_at"),
  managerCompletedAt: timestamp("manager_completed_at"),
  qaReviewedAt: timestamp("qa_reviewed_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  managerUserId: uuid("manager_user_id").references(() => users.id),
  executiveUserId: uuid("executive_user_id").references(() => users.id),
  qaUserId: uuid("qa_user_id").references(() => users.id),
  verificationUserId: uuid("verification_user_id").references(() => users.id),
  overtimeRequestedMinutes: integer("overtime_requested_minutes").notNull().default(0),
  overtimeApprovedMinutes: integer("overtime_approved_minutes").notNull().default(0),
  overtimeReason: text("overtime_reason"),
  outputNotes: text("output_notes"),
  qaRemarks: text("qa_remarks"),
  verificationRemarks: text("verification_remarks"),
  returnCount: integer("return_count").notNull().default(0),
  lastReturnReason: text("last_return_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productPostingEvidenceLinks = drmSchema.table("product_posting_evidence_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => productPostingWorkflows.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  linkType: text("link_type").notNull().default("output"),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productPostingReworkHistory = drmSchema.table("product_posting_rework_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => productPostingWorkflows.id, { onDelete: "cascade" }),
  fromPhase: text("from_phase"),
  toPhase: text("to_phase").notNull(),
  action: text("action").notNull(),
  remarks: text("remarks"),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const softwareWorkflows = drmSchema.table("software_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }).unique(),
  currentPhase: text("current_phase").notNull().default("PENDING_PROJECT"),
  salespersonUploadedAt: timestamp("salesperson_uploaded_at"),
  dataVerifiedAt: timestamp("data_verified_at"),
  assignedAt: timestamp("assigned_at"),
  assignedDurationMinutes: integer("assigned_duration_minutes").notNull().default(0),
  executionStartedAt: timestamp("execution_started_at"),
  executiveSubmittedAt: timestamp("executive_submitted_at"),
  managerCompletedAt: timestamp("manager_completed_at"),
  qaReviewedAt: timestamp("qa_reviewed_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  managerUserId: uuid("manager_user_id").references(() => users.id),
  executiveUserId: uuid("executive_user_id").references(() => users.id),
  qaUserId: uuid("qa_user_id").references(() => users.id),
  verificationUserId: uuid("verification_user_id").references(() => users.id),
  overtimeRequestedMinutes: integer("overtime_requested_minutes").notNull().default(0),
  overtimeApprovedMinutes: integer("overtime_approved_minutes").notNull().default(0),
  overtimeReason: text("overtime_reason"),
  outputNotes: text("output_notes"),
  qaRemarks: text("qa_remarks"),
  verificationRemarks: text("verification_remarks"),
  returnCount: integer("return_count").notNull().default(0),
  lastReturnReason: text("last_return_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const softwareEvidenceLinks = drmSchema.table("software_evidence_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => softwareWorkflows.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  linkType: text("link_type").notNull().default("output"),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const softwareReworkHistory = drmSchema.table("software_rework_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => softwareWorkflows.id, { onDelete: "cascade" }),
  fromPhase: text("from_phase"),
  toPhase: text("to_phase").notNull(),
  action: text("action").notNull(),
  remarks: text("remarks"),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productPostingCommissionSlabs = drmSchema.table("product_posting_commission_slabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  minValue: integer("min_value").notNull().default(0),
  maxValue: integer("max_value"),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  rateType: text("rate_type").notNull().default("percentage"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = drmSchema.table("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  readStatus: text("read_status").notNull().default("UNREAD"),
  link: text("link"),
  targetUrl: text("target_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityLogs = drmSchema.table("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const portfolios = drmSchema.table("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyword: text("keyword"),
  mainCategory: text("main_category"),
  subCategory: text("sub_category"),
  serverLink: text("server_link"),
  topHeaderImage: text("top_header_image"),
  bodyImage: text("body_image"),
  fullImage: text("full_image"),
  sliders: jsonb("sliders"), // Array of image URLs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

export const productPostingData = drmSchema.table("product_posting_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  title: text("title"),
  keywords: text("keywords"),
  description: text("description"),
  mainImage: text("main_image"),
  otherImages: jsonb("other_images").default([]),
  platform: text("platform"),
  status: text("status").notNull().default("Pending"),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductPostingDataSchema = createInsertSchema(productPostingData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProductPostingData = typeof productPostingData.$inferSelect;
export type InsertProductPostingData = z.infer<typeof insertProductPostingDataSchema>;

export const restrictedKeywords = drmSchema.table("restricted_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyword: text("keyword").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRestrictedKeywordSchema = createInsertSchema(restrictedKeywords).omit({
  id: true,
  createdAt: true,
});

export type RestrictedKeyword = typeof restrictedKeywords.$inferSelect;
export type InsertRestrictedKeyword = z.infer<typeof insertRestrictedKeywordSchema>;

export const insertProductPostingInvoiceSchema = createInsertSchema(productPostingInvoices);
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments);
export const insertTaskTimeExtensionSchema = createInsertSchema(taskTimeExtensions);
export const insertTaskResultSchema = createInsertSchema(taskResults);
export const insertProductPostingPhaseDefinitionSchema = createInsertSchema(productPostingPhaseDefinitions);
export const insertProductPostingWorkflowSchema = createInsertSchema(productPostingWorkflows);
export const insertProductPostingEvidenceLinkSchema = createInsertSchema(productPostingEvidenceLinks);
export const insertProductPostingReworkHistorySchema = createInsertSchema(productPostingReworkHistory);
export const insertProductPostingCommissionSlabSchema = createInsertSchema(productPostingCommissionSlabs);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertSoftwareWorkflowSchema = createInsertSchema(softwareWorkflows);
export const insertSoftwareEvidenceLinkSchema = createInsertSchema(softwareEvidenceLinks);
export const insertSoftwareReworkHistorySchema = createInsertSchema(softwareReworkHistory);

export type ProductPostingPhaseDefinition = typeof productPostingPhaseDefinitions.$inferSelect;
export type ProductPostingWorkflow = typeof productPostingWorkflows.$inferSelect;
export type ProductPostingEvidenceLink = typeof productPostingEvidenceLinks.$inferSelect;
export type ProductPostingReworkHistory = typeof productPostingReworkHistory.$inferSelect;
export type ProductPostingCommissionSlab = typeof productPostingCommissionSlabs.$inferSelect;

// ===== Service Department Workflow Tables =====

export const serviceCustomerStatusEnum = drmSchema.enum("service_customer_status", ["active", "expiring", "expired", "renewed", "upgraded", "dropout", "closed"]);

export const serviceCustomers = drmSchema.table("service_customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  companyId: uuid("company_id").references(() => customers.id),
  packageId: varchar("package_id").references(() => services.id),
  serviceStartDate: timestamp("service_start_date"),
  expiryDate: timestamp("expiry_date"),
  status: serviceCustomerStatusEnum("status").notNull().default("active"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  assignedBy: uuid("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  statusChangedAt: timestamp("status_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("idx_service_customers_status").on(t.status),
  assignedToIdx: index("idx_service_customers_assigned_to").on(t.assignedTo),
  expiryDateIdx: index("idx_service_customers_expiry_date").on(t.expiryDate),
}));

export const serviceTargets = drmSchema.table("service_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }).notNull().default("0"),
  period: text("period").notNull().default("monthly"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceCustomerSchema = createInsertSchema(serviceCustomers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceTargetSchema = createInsertSchema(serviceTargets).omit({ id: true, createdAt: true, updatedAt: true });

export type ServiceCustomer = typeof serviceCustomers.$inferSelect;
export type InsertServiceCustomer = z.infer<typeof insertServiceCustomerSchema>;

export type ServiceTarget = typeof serviceTargets.$inferSelect;
export type InsertServiceTarget = z.infer<typeof insertServiceTargetSchema>;

// Phase 2: Action Workflow & History Tables

export const serviceFollowupStatusEnum = drmSchema.enum("service_followup_status", ["pending", "completed", "rescheduled", "missed"]);
export const serviceComplaintStatusEnum = drmSchema.enum("service_complaint_status", ["open", "in_progress", "resolved", "closed"]);
export const serviceDropoutStatusEnum = drmSchema.enum("service_dropout_status", ["pending_recovery", "recovered", "closed"]);
export const serviceRenewalTypeEnum = drmSchema.enum("service_renewal_type", ["renewal", "upgrade"]);

export const serviceActivities = drmSchema.table("service_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceCustomerId: uuid("service_customer_id").references(() => serviceCustomers.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => customers.id),
  method: text("method").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }),
  achievedValue: decimal("achieved_value", { precision: 10, scale: 2 }),
  remarks: text("remarks"),
  activityDate: timestamp("activity_date").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("idx_service_activities_user_id").on(t.userId),
  activityDateIdx: index("idx_service_activities_activity_date").on(t.activityDate),
}));

export const serviceFollowups = drmSchema.table("service_followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceCustomerId: uuid("service_customer_id").notNull().references(() => serviceCustomers.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id),
  companyId: uuid("company_id").references(() => customers.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  method: text("method").notNull(),
  purpose: text("purpose"),
  status: serviceFollowupStatusEnum("status").notNull().default("pending"),
  note: text("note"),
  nextFollowupDate: timestamp("next_followup_date"),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  statusChangedAt: timestamp("status_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  nextFollowupIdx: index("idx_service_followups_next_followup_date").on(t.nextFollowupDate),
}));

export const serviceComplaints = drmSchema.table("service_complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceCustomerId: uuid("service_customer_id").notNull().references(() => serviceCustomers.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id),
  companyId: uuid("company_id").references(() => customers.id),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  status: serviceComplaintStatusEnum("status").notNull().default("open"),
  remarks: text("remarks"),
  resolvedAt: timestamp("resolved_at"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  statusChangedAt: timestamp("status_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("idx_service_complaints_status").on(t.status),
}));

export const serviceDropouts = drmSchema.table("service_dropouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceCustomerId: uuid("service_customer_id").notNull().references(() => serviceCustomers.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id),
  companyId: uuid("company_id").references(() => customers.id),
  reason: text("reason").notNull(),
  status: serviceDropoutStatusEnum("status").notNull().default("pending_recovery"),
  recoveryNote: text("recovery_note"),
  recoveredAt: timestamp("recovered_at"),
  closedAt: timestamp("closed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  statusChangedAt: timestamp("status_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("idx_service_dropouts_status").on(t.status),
}));

export const serviceRenewals = drmSchema.table("service_renewals", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceCustomerId: uuid("service_customer_id").notNull().references(() => serviceCustomers.id, { onDelete: "cascade" }),
  oldPackageId: varchar("old_package_id").references(() => services.id),
  newPackageId: varchar("new_package_id").references(() => services.id),
  oldGmRecordId: uuid("old_gm_record_id").references(() => gmEntries.id),
  newGmRecordId: uuid("new_gm_record_id").references(() => gmEntries.id),
  renewalType: serviceRenewalTypeEnum("renewal_type").notNull().default("renewal"),
  oldExpiryDate: timestamp("old_expiry_date"),
  newStartDate: timestamp("new_start_date"),
  newExpiryDate: timestamp("new_expiry_date"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("completed"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceActivitySchema = createInsertSchema(serviceActivities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceFollowupSchema = createInsertSchema(serviceFollowups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceComplaintSchema = createInsertSchema(serviceComplaints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceDropoutSchema = createInsertSchema(serviceDropouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceRenewalSchema = createInsertSchema(serviceRenewals).omit({ id: true, createdAt: true, updatedAt: true });

export type ServiceActivity = typeof serviceActivities.$inferSelect;
export type InsertServiceActivity = z.infer<typeof insertServiceActivitySchema>;

export type ServiceFollowup = typeof serviceFollowups.$inferSelect;
export type InsertServiceFollowup = z.infer<typeof insertServiceFollowupSchema>;

export type ServiceComplaint = typeof serviceComplaints.$inferSelect;
export type InsertServiceComplaint = z.infer<typeof insertServiceComplaintSchema>;

export type ServiceDropout = typeof serviceDropouts.$inferSelect;
export type InsertServiceDropout = z.infer<typeof insertServiceDropoutSchema>;

export type ServiceRenewal = typeof serviceRenewals.$inferSelect;
export type InsertServiceRenewal = z.infer<typeof insertServiceRenewalSchema>;

export const targetSystemTargets = drmSchema.table("target_system_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetName: text("target_name").notNull(),
  package: text("package"),
  reward: integer("reward").notNull().default(0),
  bonus: text("bonus"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
  maxPrice: decimal("max_price", { precision: 12, scale: 2 }).notNull().default("0"),
  penalty: decimal("penalty", { precision: 12, scale: 2 }).notNull().default("0"),
  amount: text("amount"),
  number: integer("number").notNull().default(0),
  kwa: integer("kwa").notNull().default(0),
  vas: integer("vas").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTargetSystemTargetSchema = createInsertSchema(targetSystemTargets).omit({
  id: true,
  createdAt: true,
});
export type TargetSystemTarget = typeof targetSystemTargets.$inferSelect;
export type InsertTargetSystemTarget = z.infer<typeof insertTargetSystemTargetSchema>;


// Target System Backend Models
export const targetSystemUserTargets = drmSchema.table("target_system_user_targets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  targetName: text("target_name").notNull(),
  category: text("category").notNull(),
  target: text("target").notNull().default("0"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
  bonus: text("bonus"),
  vas: decimal("vas", { precision: 12, scale: 2 }).notNull().default("0"),
  kwa: decimal("kwa", { precision: 12, scale: 2 }).notNull().default("0"),
  reward: decimal("reward", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  signDate: timestamp("sign_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const targetSystemDailyTargets = drmSchema.table("target_system_daily_targets", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  method: text("method").notNull(),
  target: integer("target").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const targetSystemKwaRecords = drmSchema.table("target_system_kwa_records", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  employee: text("employee").notNull(),
  kwa: decimal("kwa", { precision: 12, scale: 2 }).notNull().default("0"),
  detail: text("detail"),
  remaining: decimal("remaining", { precision: 12, scale: 2 }).notNull().default("0"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const SOFTWARE_PHASE_KEYS = [
  "PENDING_PROJECT",
  "DATA_VERIFY",
  "PROJECT_OVERVIEW",
  "TASK_ASSIGNMENT",
  "RUNNING_PROJECT",
  "MANAGER_COMPLETE",
  "QA_REVIEW",
  "QA_COMPLETE",
  "VERIFICATION_PENDING",
  "VERIFICATION_COMPLETE",
  "RETURNED_FOR_CHANGE",
] as const;
export const SOFTWARE_PHASE_LABELS: Record<(typeof SOFTWARE_PHASE_KEYS)[number], string> = {
  PENDING_PROJECT: "Pending Project",
  DATA_VERIFY: "Data Verify",
  PROJECT_OVERVIEW: "Project Overview",
  TASK_ASSIGNMENT: "Task Assignment",
  RUNNING_PROJECT: "Running Project",
  MANAGER_COMPLETE: "Manager Complete",
  QA_REVIEW: "QA Review",
  QA_COMPLETE: "QA Complete",
  VERIFICATION_PENDING: "Verification Pending",
  VERIFICATION_COMPLETE: "Verification Complete",
  RETURNED_FOR_CHANGE: "Changing",
};

export const softwarePhaseDefinitions = drmSchema.table("software_phase_definitions", {
  phaseKey: varchar("phase_key", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isTerminal: boolean("is_terminal").notNull().default(false),
  canReturn: boolean("can_return").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const softwareCommissionSlabs = drmSchema.table("software_commission_slabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  minValue: integer("min_value").notNull().default(0),
  maxValue: integer("max_value"),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  rateType: text("rate_type").notNull().default("percentage"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSoftwarePhaseDefinitionSchema = createInsertSchema(softwarePhaseDefinitions);
export type SoftwarePhaseDefinition = typeof softwarePhaseDefinitions.$inferSelect;

export type SoftwareWorkflow = typeof softwareWorkflows.$inferSelect;
export type SoftwareEvidenceLink = typeof softwareEvidenceLinks.$inferSelect;
export type SoftwareReworkHistory = typeof softwareReworkHistory.$inferSelect;

// ─── Increment Management ────────────────────────────────────────────────────
// Persists calculated increment evaluation snapshots and manager decisions.
// See migrations/20260603_increment_management.sql.
export const incrementEvaluations = drmSchema.table("increment_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => users.id),
  calculatedBy: uuid("calculated_by").references(() => users.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewStartDate: date("review_start_date").notNull(),
  reviewEndDate: date("review_end_date").notNull(),
  currentSalary: decimal("current_salary", { precision: 12, scale: 2 }),
  perDaySalary: decimal("per_day_salary", { precision: 12, scale: 2 }),
  leaveDays: decimal("leave_days", { precision: 8, scale: 2 }),
  allowedLeaveDays: decimal("allowed_leave_days", { precision: 8, scale: 2 }),
  incrementLeaves: decimal("increment_leaves", { precision: 8, scale: 2 }),
  leaveDeductionAmount: decimal("leave_deduction_amount", { precision: 12, scale: 2 }),
  totalMinutes: integer("total_minutes"),
  relaxationMinutes: integer("relaxation_minutes"),
  incrementMinutes: integer("increment_minutes"),
  totalTasks: integer("total_tasks"),
  pendingTasks: integer("pending_tasks"),
  runningTasks: integer("running_tasks"),
  completedTasks: integer("completed_tasks"),
  noticeCount: integer("notice_count"),
  eligibilityStatus: text("eligibility_status"),
  proposedIncrementType: text("proposed_increment_type"),
  proposedIncrementValue: decimal("proposed_increment_value", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("PENDING"),
  managerRemarks: text("manager_remarks"),
  rejectionReason: text("rejection_reason"),
  effectiveDate: date("effective_date"),
  calculationSnapshot: jsonb("calculation_snapshot"),
  missingData: jsonb("missing_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
}, (t) => [
  index("idx_increment_eval_employee").on(t.employeeId),
  index("idx_increment_eval_review_dates").on(t.reviewStartDate, t.reviewEndDate),
  index("idx_increment_eval_status").on(t.status),
  index("idx_increment_eval_effective").on(t.effectiveDate),
]);

export type IncrementEvaluation = typeof incrementEvaluations.$inferSelect;
export type InsertIncrementEvaluation = typeof incrementEvaluations.$inferInsert;

// ─── D&D Manager Penalty Management ──────────────────────────────────────────
export const penalties = drmSchema.table("penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => users.id),
  department: text("department"),
  penaltyHead: text("penalty_head").notNull(),
  reason: text("reason").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  penaltyDate: date("penalty_date").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  approvalStatus: text("approval_status").notNull().default("PENDING"),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  managerRemarks: text("manager_remarks"),
  hodRemarks: text("hod_remarks"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: uuid("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  employeeAcknowledgedAt: timestamp("employee_acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_penalties_employee").on(t.employeeId),
  index("idx_penalties_created_by").on(t.createdBy),
  index("idx_penalties_date").on(t.penaltyDate),
  index("idx_penalties_status").on(t.approvalStatus),
  index("idx_penalties_department").on(t.department),
  index("idx_penalties_deleted_at").on(t.deletedAt),
]);

export type Penalty = typeof penalties.$inferSelect;
export type InsertPenalty = typeof penalties.$inferInsert;

// Link Report (Team Report submodule) tables.
export const linkReports = drmSchema.table("link_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  displayId: serial("display_id"),
  submittedByUserId: uuid("submitted_by_user_id").notNull().references(() => users.id),
  companyId: uuid("company_id"),
  companyName: text("company_name").notNull().default(""),
  linkUrl: text("link_url").notNull(),
  sourceModule: text("source_module").notNull().default("manual"),
  sourceRecordId: uuid("source_record_id"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_link_reports_submitted_by").on(t.submittedByUserId),
  index("idx_link_reports_submitted_at").on(t.submittedAt),
  index("idx_link_reports_deleted_at").on(t.deletedAt),
]);

export const linkReportCommissionVerifications = drmSchema.table("link_report_commission_verifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  verifiedByUserId: uuid("verified_by_user_id").notNull().references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  linkReportIds: jsonb("link_report_ids").notNull().default([]),
  totalLinks: integer("total_links").notNull().default(0),
  reward: decimal("reward", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("VERIFIED"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_lrcv_user").on(t.userId),
  index("idx_lrcv_verified_by").on(t.verifiedByUserId),
  index("idx_lrcv_start_date").on(t.startDate),
  index("idx_lrcv_end_date").on(t.endDate),
]);

export type LinkReport = typeof linkReports.$inferSelect;
export type InsertLinkReport = typeof linkReports.$inferInsert;
export type LinkReportCommissionVerification = typeof linkReportCommissionVerifications.$inferSelect;
export type InsertLinkReportCommissionVerification = typeof linkReportCommissionVerifications.$inferInsert;
