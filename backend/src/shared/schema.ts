import { sql } from "drizzle-orm";
import { pgTable, pgSchema, text, varchar, timestamp, integer, decimal, pgEnum, boolean, date, jsonb, primaryKey, uuid, index, uniqueIndex, serial } from "drizzle-orm/pg-core";
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
  // Legacy plaintext column — deprecated and nullable. New writes use password_hash only.
  password: text("password"),
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
  isFocus: boolean("is_focus").default(false),
  abType: text("ab_type"),
  drmId: text("drm_id").unique(),
  phoneNormalized: text("phone_normalized"),
  emails: text("emails").array().default(sql`'{}'::text[]`),
  mobiles: text("mobiles").array().default(sql`'{}'::text[]`),
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
  // Sales Manager dashboard's Follow-Up Details grid: a manager-authored note on
  // this follow-up, distinct from the salesperson's own `notes`/subservice note.
  managerComment: text("manager_comment"),
  smComment: text("sm_comment"),
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
  // Human-facing invoice number: DB-generated (sequence-backed DEFAULT set in
  // server/db/ensure.ts, since db:push is broken repo-wide), unique and stable
  // across every screen/role — replaces the old per-screen practice of slicing
  // the internal `id` UUID differently in each place (never consistent).
  invoiceNumber: text("invoice_number").notNull().unique()
    .default(sql`nextval('drm.product_posting_invoice_number_seq')`),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  salesExecId: uuid("sales_exec_id").notNull().references(() => users.id),
  customerId: uuid("customer_id").references(() => customers.id),
  projectName: text("project_name"),
  companyName: text("company_name"),
  status: text("status").notNull().default("PENDING_HOD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paymentMethod: varchar("payment_method"),
  // --- Stage 3 invoice-workflow additive fields (all optional, no data loss) ---
  currency: text("currency").default("USD"),
  invoiceDate: timestamp("invoice_date", { withTimezone: true }),
  paymentTerms: text("payment_terms"),
  serviceType: text("service_type"),
  servicePackage: text("service_package"),
  sourceModule: text("source_module"),
  sourceId: text("source_id"),
  receiptReference: text("receipt_reference"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  // --- Patch 5 Stage 4 additive fields (invoice generation + approval audit) ---
  // GM linkage + canonical invoice type. gm_id is varchar to match drm.gm_entries
  // (whose id is varchar, not uuid) and avoid a cross-type FK mismatch.
  gmId: text("gm_id"),
  invoiceType: text("invoice_type"),
  autoGenerated: boolean("auto_generated").default(false),
  generatedBy: uuid("generated_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generationEvent: text("generation_event"),
  // Approval / rejection audit (who acted + when), additive to the existing
  // status + rejection_reason columns.
  hodApprovedBy: uuid("hod_approved_by"),
  hodApprovedAt: timestamp("hod_approved_at", { withTimezone: true }),
  accountsApprovedBy: uuid("accounts_approved_by"),
  accountsApprovedAt: timestamp("accounts_approved_at", { withTimezone: true }),
  rejectedBy: uuid("rejected_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
});

// Projects
export const projects = drmSchema.table("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Professional, unique, sequential display ID — mirrors productPostingInvoices'
  // invoiceNumber (same sequence-backed pattern), replacing the old per-screen
  // practice of slicing the internal `id` UUID for display.
  projectNumber: text("project_number").notNull().unique()
    .default(sql`nextval('drm.project_number_seq')`),
  invoiceId: uuid("invoice_id").references(() => productPostingInvoices.id),
  customerId: uuid("customer_id").references(() => customers.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  workSpace: text("workspace"),
  // Structured routing department for this project: DND | PRODUCT_POSTING |
  // SOFTWARE. Set at workflow creation so notification/dashboard routing reads a
  // stored value instead of guessing from free-text project/invoice names.
  departmentType: text("department_type"),
  // Patch 5 Stage 5 (P9) — structured invoice->project routing fields. These let
  // generation/dependency logic read stored values instead of parsing names:
  //   gmId        — the originating GM key (shared by an invoice set)
  //   serviceType — canonical service/product name (mirrors invoice service_type)
  //   invoiceType — canonical INVOICE_TYPES value (LISTING_PAGE/MINIWEBSITE/PRODUCT_POSTING)
  //   projectType — PROJECT_TYPES kind: INVOICE_ROOT (generated/linked from an
  //                 invoice) vs SUBPROJECT (created by the assign-task flow).
  gmId: text("gm_id"),
  serviceType: text("service_type"),
  invoiceType: text("invoice_type"),
  projectType: text("project_type"),
  status: text("status").notNull().default("Active"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Project dependencies (Patch 5 Stage 5, P10) — a Product Posting project may not
// start until a prerequisite project (the same GM's Listing Page project) has
// passed QA. Rows are created only when the controlling config
// (requireProductPostingWaitForListingQa) is true. Matching/satisfaction is keyed
// on gm_id so it is robust to the order in which the two projects are generated;
// dependency_project_id is backfilled for traceability once the prerequisite root
// project exists. db:push is broken repo-wide, so the table is also created at
// runtime in server/db/ensure.ts (ensureProjectStage5Schema).
export const projectDependencies = drmSchema.table("project_dependencies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // The dependent (blocked) project — the Product Posting INVOICE_ROOT project.
  projectId: uuid("project_id").notNull().references(() => projects.id),
  // The prerequisite project — the Listing Page INVOICE_ROOT project. Nullable
  // until that root exists; resolution/satisfaction works via gmId regardless.
  dependencyProjectId: uuid("dependency_project_id").references(() => projects.id),
  // Shared GM key linking the prerequisite & dependent invoice/project set.
  gmId: text("gm_id"),
  dependencyType: text("dependency_type").notNull().default("LISTING_PAGE_QA_APPROVAL"),
  status: text("status").notNull().default("PENDING"),
  satisfiedAt: timestamp("satisfied_at", { withTimezone: true }),
  satisfiedBy: uuid("satisfied_by").references(() => users.id),
  metadata: jsonb("metadata"),
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
  // Phase 11 — live DB has this as `uuid NOT NULL` (schema drift: was missing
  // from this Drizzle definition entirely, which broke ticket creation).
  createdBy: varchar("created_by").notNull(),
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

// Employee Bonuses — authoritative source for approved per-employee bonuses.
// Salary preview pulls APPROVED rows matching the pay period into bonusAmount
// (still overridable by a manual adjustment on the salary line).
export const employeeBonuses = drmSchema.table("employee_bonuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  periodMonth: integer("period_month").notNull(), // 1-12, the pay period it belongs to
  periodYear: integer("period_year").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_employee_bonuses_user").on(t.userId),
  index("idx_employee_bonuses_period").on(t.periodYear, t.periodMonth),
  index("idx_employee_bonuses_status").on(t.status),
]);

// ===== Stage 3: Salary & Attendance-Edit Tables =====

// Salary Runs — one row per generated payroll run (period + scope).
export const salaryRuns = drmSchema.table("salary_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodMonth: integer("period_month").notNull(), // 1-12
  periodYear: integer("period_year").notNull(),
  branch: text("branch"),
  department: text("department"),
  status: text("status").notNull().default("DRAFT"), // DRAFT | FINALIZED | APPROVED | LOCKED
  notes: text("notes"),
  employeeCount: integer("employee_count").notNull().default(0),
  totalGross: decimal("total_gross", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDeductions: decimal("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  totalNet: decimal("total_net", { precision: 14, scale: 2 }).notNull().default("0"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  // Patch 2 Stage 4 — lifecycle actors, remarks, soft-delete (additive).
  generatedBy: uuid("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at"),
  finalizedBy: uuid("finalized_by").references(() => users.id),
  finalizedAt: timestamp("finalized_at"),
  remarks: text("remarks"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_salary_runs_period").on(t.periodYear, t.periodMonth),
  index("idx_salary_runs_status").on(t.status),
  index("idx_salary_runs_generated_by").on(t.generatedBy),
  index("idx_salary_runs_deleted_at").on(t.deletedAt),
]);

// Salary Run Items — per-employee line items within a run.
export const salaryRunItems = drmSchema.table("salary_run_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => salaryRuns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  employeeName: text("employee_name"),
  department: text("department"),
  branch: text("branch"),
  grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  perDaySalary: decimal("per_day_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  absenceDeduction: decimal("absence_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  overtimeAmount: decimal("overtime_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  // Patch 2 Stage 4 — full payroll component/deduction breakdown (additive).
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  leaveDays: integer("leave_days").notNull().default(0),
  unpaidLeaveDays: integer("unpaid_leave_days").notNull().default(0),
  unpaidLeaveDeduction: decimal("unpaid_leave_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  lateMinutes: integer("late_minutes").notNull().default(0),
  lateDeduction: decimal("late_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  overtimeMinutes: integer("overtime_minutes").notNull().default(0),
  penaltyAmount: decimal("penalty_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  loanDeduction: decimal("loan_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  bonusAmount: decimal("bonus_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  allowanceAmount: decimal("allowance_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDeductions: decimal("total_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  payableSalary: decimal("payable_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("UNPAID"),
  paidByUserId: uuid("paid_by_user_id").references(() => users.id),
  paidAt: timestamp("paid_at"),
  remarks: text("remarks"),
  calculationSnapshot: jsonb("calculation_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_salary_run_items_run").on(t.runId),
  index("idx_salary_run_items_user").on(t.userId),
  uniqueIndex("uq_salary_run_items_run_user").on(t.runId, t.userId),
  index("idx_salary_run_items_payment_status").on(t.paymentStatus),
]);

// Attendance Edit Requests — audited before/after edits to attendance records.
export const attendanceEditRequests = drmSchema.table("attendance_edit_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  attendanceId: varchar("attendance_id").references(() => attendance.id),
  userId: uuid("user_id").notNull().references(() => users.id), // employee whose attendance
  attendanceDate: timestamp("attendance_date").notNull(),
  field: text("field").notNull(), // e.g. "status" | "check_in" | "check_out"
  beforeValue: text("before_value"),
  afterValue: text("after_value"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("Pending"), // Pending | Approved | Rejected
  requestedByUserId: uuid("requested_by_user_id").notNull().references(() => users.id),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  // Patch 2 Stage 3 — salary-lock guard on approval/correction.
  salaryLocked: boolean("salary_locked").notNull().default(false),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_att_edit_user").on(t.userId),
  index("idx_att_edit_status").on(t.status),
]);

export type SalaryRun = typeof salaryRuns.$inferSelect;
export type InsertSalaryRun = typeof salaryRuns.$inferInsert;
export type SalaryRunItem = typeof salaryRunItems.$inferSelect;
export type InsertSalaryRunItem = typeof salaryRunItems.$inferInsert;
export type AttendanceEditRequest = typeof attendanceEditRequests.$inferSelect;
export type InsertAttendanceEditRequest = typeof attendanceEditRequests.$inferInsert;

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
  // Explicit, first-class FULL/PARTIAL/LOAN classification (mirrors resolveCanonicalGmType's
  // resolved value at create time). Nullable/additive — legacy rows fall back to deriving
  // this from isLoan/isPartialPayment via mapDbFlagsToGmType. NOT the same concept as gmType
  // above (GM/TempGM/RefundGM, a record-kind distinction from an unrelated feature).
  canonicalGmType: text("canonical_gm_type"),
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
  // Patch 5 Stage 2 — active role of the creator at GM creation (nullable, additive).
  createdByRole: text("created_by_role"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Patch 5 Stage 3 (P4) — Partial GM payment receipts. First-class receipt rows so a
// partial GM's remaining balance = customer_dollar - SUM(receipts.amount_usd). `gm_id`
// links drm.gm_entries(id) (varchar) WITHOUT a hard FK (gm_entries.id is varchar but
// users.id is uuid; a cross-type FK risks a type-clash rollback — existence is validated
// in the app layer). The live table is created at runtime in server/db/ensure.ts because
// db:push is broken repo-wide; this def supplies the TS/Drizzle types only.
export const gmPartialReceipts = drmSchema.table("gm_partial_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmId: varchar("gm_id").notNull(),
  amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }).notNull(),
  amountPkr: decimal("amount_pkr", { precision: 15, scale: 2 }),
  dollarRate: decimal("dollar_rate", { precision: 12, scale: 4 }),
  receiptDate: timestamp("receipt_date").notNull().defaultNow(),
  method: text("method"),
  reference: text("reference"),
  notes: text("notes"),
  collectedBy: uuid("collected_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  gmIdIdx: index("idx_gm_partial_receipts_gm").on(table.gmId),
  receiptDateIdx: index("idx_gm_partial_receipts_date").on(table.receiptDate),
  collectedByIdx: index("idx_gm_partial_receipts_collected_by").on(table.collectedBy),
}));

// Patch 5 Stage 3 (P5) — Loan GM terms: agreed return date, optional company co-pay,
// the mandatory Admin (Super HOD) approval gate, and return/overdue tracking. One row
// per GM (`gm_id` unique). Same mixed-type-FK caveat as gm_partial_receipts: `gm_id`
// is a plain varchar link, actor columns reference drm.users(id) (uuid). Live table is
// created at runtime in server/db/ensure.ts; this def supplies the TS/Drizzle types only.
export const gmLoanTerms = drmSchema.table("gm_loan_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmId: varchar("gm_id").notNull().unique(),
  loanAmountUsd: decimal("loan_amount_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  companyCopayUsd: decimal("company_copay_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  agreedReturnDate: date("agreed_return_date"),
  adminApprovalStatus: text("admin_approval_status").notNull().default("PENDING"),
  adminApprovedBy: uuid("admin_approved_by").references(() => users.id),
  adminApprovedAt: timestamp("admin_approved_at"),
  adminComment: text("admin_comment"),
  returnStatus: text("return_status").notNull().default("PENDING"),
  returnedAt: timestamp("returned_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  adminStatusIdx: index("idx_gm_loan_terms_admin_status").on(table.adminApprovalStatus),
  returnStatusIdx: index("idx_gm_loan_terms_return_status").on(table.returnStatus),
  returnDateIdx: index("idx_gm_loan_terms_return_date").on(table.agreedReturnDate),
}));

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
  // Patch 4 Stage 2 — account-head linkage + posting lifecycle + voucher refs
  // (additive). No FK on the linkage columns (mixed varchar/uuid id types);
  // existence is validated in the application layer.
  accountHeadId: varchar("account_head_id"),
  status: text("status").notNull().default("Posted"), // Posted | Reversed | Reversal
  voucherId: varchar("voucher_id"),
  voucherLineId: varchar("voucher_line_id"),
  reversalOfId: varchar("reversal_of_id"),
  branch: text("branch"),
  remarks: text("remarks"),
  postedAt: timestamp("posted_at"),
  postedByUserId: varchar("posted_by_user_id"),
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
  // Patch 4 Stage 2 — chart-of-accounts master fields (additive). No FK on
  // parentAccountId (self-ref varchar); existence/!=self validated in the app.
  parentAccountId: varchar("parent_account_id"),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  normalBalance: text("normal_balance"), // "Debit" | "Credit"
  branch: text("branch"),
  isActive: integer("is_active").notNull().default(1),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Patch 4 Stage 2 — Journal Voucher header + lines (double-entry source docs).
export const journalVouchers = drmSchema.table("journal_vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherNo: text("voucher_no").notNull().unique(),
  voucherDate: timestamp("voucher_date").notNull().defaultNow(),
  status: text("status").notNull().default("DRAFT"), // DRAFT | POSTED | CANCELLED
  remarks: text("remarks"),
  branch: text("branch"),
  totalDebit: decimal("total_debit", { precision: 12, scale: 2 }).notNull().default("0"),
  totalCredit: decimal("total_credit", { precision: 12, scale: 2 }).notNull().default("0"),
  createdByUserId: varchar("created_by_user_id"),
  postedAt: timestamp("posted_at"),
  postedByUserId: varchar("posted_by_user_id"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledByUserId: varchar("cancelled_by_user_id"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const journalVoucherLines = drmSchema.table("journal_voucher_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull(),
  accountHeadId: varchar("account_head_id").notNull(),
  debit: decimal("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  narration: text("narration"),
  lineNo: integer("line_no").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  ip: text("ip").notNull(), // Patch 4 Stage 4 — used as the required "Host / IP" field
  provider: text("provider"),
  status: text("status").notNull().default("Active"),
  // Patch 4 Stage 4 (additive) — soft delete + audit. Plain columns (no FK) to
  // avoid db:push FK type-mismatch; existence not enforced at the DB layer.
  notes: text("notes"),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  deletedBy: uuid("deleted_by"),
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

export const insertJournalVoucherSchema = createInsertSchema(journalVouchers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  postedAt: true,
  postedByUserId: true,
  cancelledAt: true,
  cancelledByUserId: true,
  cancelReason: true,
  totalDebit: true,
  totalCredit: true,
});

export const insertJournalVoucherLineSchema = createInsertSchema(journalVoucherLines).omit({
  id: true,
  createdAt: true,
  voucherId: true,
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
export type InsertJournalVoucher = z.infer<typeof insertJournalVoucherSchema>;
export type JournalVoucher = typeof journalVouchers.$inferSelect;
export type InsertJournalVoucherLine = z.infer<typeof insertJournalVoucherLineSchema>;
export type JournalVoucherLine = typeof journalVoucherLines.$inferSelect;

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
  // Patch 2 Stage 7 — approval workflow metadata. Populated by the
  // approve/reject routes (rejection always carries a reason).
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id, { onDelete: "set null" }),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
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
  // Required self-review confirmation, captured at the same moment as
  // executiveSubmittedAt (enforced in submit-to-manager) — the developer's own
  // sign-off before manager/QA see the work, distinct from the manager's own
  // review at managerCompletedAt.
  selfReviewedAt: timestamp("self_reviewed_at"),
  executiveSubmittedAt: timestamp("executive_submitted_at"),
  managerCompletedAt: timestamp("manager_completed_at"),
  qaReviewedAt: timestamp("qa_reviewed_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  // Miniwebsite-specific "Delivered" signal — set the moment a Miniwebsite
  // project's workflow reaches VERIFICATION_COMPLETE (verification-review
  // route). Display-only: the underlying phase/state-machine is untouched, so
  // commission/reporting logic keyed on VERIFICATION_COMPLETE is unaffected;
  // this only changes what label a Miniwebsite project shows to the user.
  deliveredAt: timestamp("delivered_at"),
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
  projectLevel: text("project_level"), // QA-assigned project quality level (Excellent/Very Good/Good/Normal/Very Poor)
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

// MD-16 (Posting Executive): a slab set is never edited in place — a new
// commission decision creates a new versioned batch of rows (same
// effectiveFrom), and the previous batch's effectiveTo is closed out, so a
// past period's commission is always computed against the rule that was
// actually in force at the time, never today's rule applied retroactively.
export const productPostingCommissionSlabs = drmSchema.table("product_posting_commission_slabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  area: text("area").notNull().default("posting_executive"),
  name: text("name").notNull(),
  minValue: integer("min_value").notNull().default(0),
  maxValue: integer("max_value"),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  rateType: text("rate_type").notNull().default("percentage"),
  isActive: boolean("is_active").notNull().default(true),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// MD-23, Project Owner decision (2026-07-27): a manually authorized override
// of the fixed department-routing rule (resolveWorkflowRouting's deterministic
// DND/PRODUCT_POSTING pick). At most one row is enabled+in-range at a time —
// creating a new override auto-disables whatever was previously enabled, the
// same "close old, insert new" versioning used for productPostingCommissionSlabs.
// "Currently in force" is computed live at read time from effectiveFrom/
// effectiveTo vs now() (see server/services/assignment-override.service.ts),
// never by a background job flipping isEnabled.
export const assignmentRatioOverrides = drmSchema.table("assignment_ratio_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull().default("product_posting_workflow_routing"),
  previousRatio: text("previous_ratio").notNull(),
  newRatio: text("new_ratio").notNull(),
  reason: text("reason").notNull(),
  approvedByUserId: uuid("approved_by_user_id").notNull().references(() => users.id),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  disabledByUserId: uuid("disabled_by_user_id").references(() => users.id),
  disabledReason: text("disabled_reason"),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = drmSchema.table("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  readStatus: text("read_status").notNull().default("UNREAD"),
  link: text("link"),
  targetUrl: text("target_url"),
  // Patch 3 Stage 2 — additive routing/context metadata (idempotent runtime
  // migration in server/db/ensure.ts). entity_id is text because entity ids vary
  // (uuid customers, varchar opportunities, etc.) across modules.
  module: text("module"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  priority: text("priority").notNull().default("normal"),
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

export const abPayments = drmSchema.table("ab_payments", {
  id: serial("id").primaryKey(),
  abId: text("ab_id"),
  orderId: text("order_id"),
  gmDrmId: text("gm_drm_id"),
  gmEntryId: uuid("gm_entry_id").references(() => gmEntries.id),
  companyName: text("company_name"),
  amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPkr: decimal("amount_pkr", { precision: 15, scale: 2 }).notNull().default("0"),
  rate: decimal("rate", { precision: 12, scale: 4 }),
  proofUrl: text("proof_url"),
  status: text("status").notNull().default("pending"),
  paidDate: date("paid_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => users.id),
  deletionReason: text("deletion_reason"),
});

export const notificationOutbox = drmSchema.table("notification_outbox", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: jsonb("payload").notNull(),
  userId: uuid("user_id").references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextRetryTime: timestamp("next_retry_time").notNull().defaultNow(),
  lockedTimestamp: timestamp("locked_timestamp"),
  lockedWorker: text("locked_worker"),
  processedTimestamp: timestamp("processed_timestamp"),
  lastError: text("last_error"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});


// ===== Patch 3 Stage 5 — Cross-department status synchronization ledger =====
// Append-only ledger of cross-department workflow hand-offs (HOD→Account,
// Account→PMS, Manager→QA→Verification, etc.). It records WHAT moved and WHO is
// now responsible — it never owns or sets business status (the module tables
// remain authoritative). entity ids are TEXT because they vary across modules
// (uuid invoices/projects vs varchar leave/loan ids). Created at runtime via
// CrossDepartmentStatusService.ensureSchema() (db:push is broken repo-wide), and
// mirrored here so Drizzle/types stay in sync.
export const crossDepartmentStatusHistory = drmSchema.table("cross_department_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Idempotency key: `${module}:${entityId}:${action}:${toStatus}` — a repeated
  // hook for the same transition is a no-op instead of a duplicate row.
  eventKey: text("event_key").notNull().unique(),
  sourceModule: text("source_module").notNull(),
  sourceDepartment: text("source_department"),
  targetModule: text("target_module"),
  targetDepartment: text("target_department"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  // Real (UUID) user ids responsible at the next stage. Never role strings.
  targetUserIds: jsonb("target_user_ids").notNull().default(sql`'[]'::jsonb`),
  // Whether THIS hook sent the notifications (false when the originating module
  // already notifies inline, so we record the hand-off without double-sending).
  notified: boolean("notified").notNull().default(false),
  notifiedCount: integer("notified_count").notNull().default(0),
  // Nullable: the audit service writes to drm.activity_logs but does not return
  // an id, so this stays null unless a future caller can supply it.
  auditLogId: uuid("audit_log_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_cross_dept_status_entity").on(t.entityType, t.entityId),
  index("idx_cross_dept_status_created").on(t.createdAt),
]);

export const insertCrossDepartmentStatusHistorySchema = createInsertSchema(crossDepartmentStatusHistory).omit({
  id: true,
  createdAt: true,
});

/**
 * Patch 5 Stage 6 (P14): append-only workflow status history.
 *
 * One canonical ledger of every transition the central WorkflowStatusService
 * performs (GM, invoice, project, QA, verification). It is intentionally
 * generic: `entity_id` is TEXT because GM ids are `varchar` while invoice /
 * project ids are `uuid` — a single typed column could not hold both.
 * `actor_user_id` is a plain `uuid` with NO foreign key, to stay an immutable
 * audit record (a user deletion must never cascade away history) and to avoid
 * the repo-wide FK-type-mismatch that breaks `db:push`. The table is created
 * idempotently at boot by `ensureWorkflowStatusHistorySchema`.
 */
export const workflowStatusHistory = drmSchema.table("workflow_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  nextStatus: text("next_status").notNull(),
  actorUserId: uuid("actor_user_id"),
  actorRole: text("actor_role"),
  reason: text("reason"),
  evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  auditLogId: uuid("audit_log_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_workflow_status_hist_entity").on(t.entityType, t.entityId, t.createdAt),
  index("idx_workflow_status_hist_actor").on(t.actorUserId, t.createdAt),
  index("idx_workflow_status_hist_action").on(t.action, t.createdAt),
]);

export const insertWorkflowStatusHistorySchema = createInsertSchema(workflowStatusHistory).omit({
  id: true,
  createdAt: true,
});
export type WorkflowStatusHistory = typeof workflowStatusHistory.$inferSelect;
export type InsertWorkflowStatusHistory = typeof workflowStatusHistory.$inferInsert;
export type InsertCrossDepartmentStatusHistory = z.infer<typeof insertCrossDepartmentStatusHistorySchema>;
export type CrossDepartmentStatusHistory = typeof crossDepartmentStatusHistory.$inferSelect;

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

// MD-21, Project Owner decision (2026-07-27): Portfolio Reserve — a time-boxed
// lock on a portfolio design while it's being presented to a customer/company
// for booking. `status` only ever stores a human decision ('active' while
// awaiting Verification Manager action, 'confirmed', or 'rejected'); whether an
// 'active' row has auto-released after 48h is computed live at read time by
// comparing `expiresAt` to now(), the same lazy-expiry approach already used
// for service due-dates (see server/utils/service-expiry.ts) — no background
// job flips a stored flag.
export const portfolioReservations = drmSchema.table("portfolio_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  companyName: text("company_name"),
  status: text("status").notNull().default("active"), // 'active' | 'confirmed' | 'rejected'
  reservedByUserId: uuid("reserved_by_user_id").notNull().references(() => users.id),
  reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionReason: text("resolution_reason"),
  extensionCount: integer("extension_count").notNull().default(0),
  lastExtendedAt: timestamp("last_extended_at", { withTimezone: true }),
  lastExtendedByUserId: uuid("last_extended_by_user_id").references(() => users.id),
  lastExtensionReason: text("last_extension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortfolioReservationSchema = createInsertSchema(portfolioReservations).omit({
  id: true,
  status: true,
  reservedByUserId: true,
  reservedAt: true,
  expiresAt: true,
  resolvedByUserId: true,
  resolvedAt: true,
  resolutionReason: true,
  extensionCount: true,
  lastExtendedAt: true,
  lastExtendedByUserId: true,
  lastExtensionReason: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPortfolioReservation = z.infer<typeof insertPortfolioReservationSchema>;
export type PortfolioReservation = typeof portfolioReservations.$inferSelect;

// MD-16(c), Project Owner decision (2026-07-27): GM commission engine —
// role-based, versioned slabs (same effectiveFrom/effectiveTo "close old,
// insert new" pattern as productPostingCommissionSlabs/assignmentRatioOverrides,
// keyed by role instead of area), a persisted per-GM commission ledger (unlike
// MD-16(b)/MD-20's live-computed approach, this feature explicitly requires an
// auditable, stored reversal/adjustment trail), and adjustments recording every
// cancellation/void/withdrawal/amount-reduction as a negative row rather than
// mutating the original record. See server/services/gm-commission.service.ts.
export const gmCommissionSlabs = drmSchema.table("gm_commission_slabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  minValue: decimal("min_value", { precision: 15, scale: 2 }).notNull().default("0"),
  maxValue: decimal("max_value", { precision: 15, scale: 2 }),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  rateType: text("rate_type").notNull().default("percentage"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GmCommissionSlab = typeof gmCommissionSlabs.$inferSelect;

// One row per eligible GM per beneficiary per commission-rule version (the
// unique constraint below is the "Duplicate Prevention" rule) — a persisted
// ledger entry, not a live-recomputed value, so reversals have something real
// to point at and adjust.
export const gmCommissionRecords = drmSchema.table("gm_commission_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceType: text("source_type").notNull().default("GM_ENTRY"),
  sourceRecordId: varchar("source_record_id").notNull().references(() => gmEntries.id, { onDelete: "cascade" }),
  beneficiaryUserId: uuid("beneficiary_user_id").notNull().references(() => users.id),
  beneficiaryRole: text("beneficiary_role"),
  commissionSlabId: uuid("commission_slab_id").references(() => gmCommissionSlabs.id),
  commissionBasisField: text("commission_basis_field").notNull(),
  commissionBasisAmount: decimal("commission_basis_amount", { precision: 15, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 2 }).notNull(),
  baseCommission: decimal("base_commission", { precision: 15, scale: 2 }).notNull(),
  accrualDate: timestamp("accrual_date", { withTimezone: true }).notNull(),
  payableDate: timestamp("payable_date", { withTimezone: true }).notNull(),
  quarterKey: text("quarter_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GmCommissionRecord = typeof gmCommissionRecords.$inferSelect;

// Every cancellation, refund, void, withdrawal, or amount-reduction that
// affects an already-recorded GM commission creates a new, auditable negative
// row here instead of mutating gmCommissionRecords.baseCommission in place.
export const gmCommissionAdjustments = drmSchema.table("gm_commission_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  commissionRecordId: uuid("commission_record_id").notNull().references(() => gmCommissionRecords.id, { onDelete: "cascade" }),
  adjustmentType: text("adjustment_type").notNull(), // 'REVERSAL' | 'MANUAL_ADJUSTMENT'
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // negative for reversals/reductions
  reason: text("reason").notNull(),
  sourceEvent: text("source_event"), // e.g. 'GM_VOIDED', 'GM_WITHDRAWN', 'GM_AMOUNT_REDUCED'
  actorUserId: uuid("actor_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GmCommissionAdjustment = typeof gmCommissionAdjustments.$inferSelect;

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

// ===== Patch 4 Stage 5 — Social Media Posts (approval + publishing lifecycle) =====
// The runtime source of truth for this table is ensureSocialMediaPostsTable() in
// server/social-media-routes.ts (db:push is broken repo-wide, so DDL is applied at
// boot via CREATE TABLE IF NOT EXISTS). This Drizzle definition documents the shape
// and provides types. Lifecycle fields are TEXT and validated at the API layer:
//   approval_status   : DRAFT | PENDING | APPROVED | REJECTED
//   publishing_status : DRAFT | SCHEDULED | READY | PUBLISHED | FAILED | CANCELLED
// linked_project_id is TEXT (not uuid) to match the existing project_id columns and
// avoid the known varchar/uuid mismatch.
export const socialMediaPosts = drmSchema.table("social_media_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),
  socialAccountId: uuid("social_account_id"),
  title: text("title"),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaName: text("media_name"),
  linkedCustomerId: uuid("linked_customer_id"),
  linkedProjectId: text("linked_project_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  approvalStatus: text("approval_status").notNull().default("DRAFT"),
  publishingStatus: text("publishing_status").notNull().default("DRAFT"),
  failureReason: text("failure_reason"),
  rejectionReason: text("rejection_reason"),
  cancelReason: text("cancel_reason"),
  externalRef: text("external_ref"),
  createdBy: uuid("created_by"),
  approvedBy: uuid("approved_by"),
  publishedBy: uuid("published_by"),
  // Manually recorded after publish — no live platform-API integration exists yet.
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertSocialMediaPostSchema = createInsertSchema(socialMediaPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SocialMediaPost = typeof socialMediaPosts.$inferSelect;
export type InsertSocialMediaPost = z.infer<typeof insertSocialMediaPostSchema>;

// Phase 11 — was previously runtime-DDL-only (ensureSocialAccountsTable() in
// server/social-accounts-routes.ts); added here for typing/schema-drift
// parity with socialMediaPosts. Columns mirror that DDL exactly.
export const socialAccounts = drmSchema.table("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerName: text("owner_name"),
  platform: text("platform").notNull(),
  accountName: text("account_name"),
  url: text("url"),
  customerId: uuid("customer_id"),
  projectId: text("project_id"),
  status: text("status").notNull().default("active"),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: uuid("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertSocialAccountSchema = createInsertSchema(socialAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;

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

// Service Department "Team Work Performance" real tracking for fields that
// previously had no source anywhere in the app: a rep-recorded customer
// satisfaction rating (also backs the Alibaba/WebExcels "happy" split via
// customers.source) and a sample-request log.
export const serviceCustomerFeedback = drmSchema.table("service_customer_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceSampleRequests = drmSchema.table("service_sample_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  productName: text("product_name"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  // Patch 2 Stage 2: lifecycle status (ACTIVE/VOIDED), distinct from approval_status.
  status: text("status").notNull().default("ACTIVE"),
  voidedBy: uuid("voided_by").references(() => users.id),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
}, (t) => [
  index("idx_penalties_employee").on(t.employeeId),
  index("idx_penalties_created_by").on(t.createdBy),
  index("idx_penalties_date").on(t.penaltyDate),
  index("idx_penalties_status").on(t.approvalStatus),
  index("idx_penalties_department").on(t.department),
  index("idx_penalties_deleted_at").on(t.deletedAt),
  index("idx_penalties_lifecycle_status").on(t.status),
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

// ===========================================================================
// Stage 7 — Unified Follow-Up Communication Model
// A single timeline of calls, WhatsApp, emails, meetings, visits, notes and
// reminders across Sales / CRM / Service. Net-new; does not replace the existing
// per-module follow-up tables (lead_activities, follow_ups, service_followups,
// service_complaints, ...). The physical table + enum types are also created at
// runtime by CommunicationService.ensureCommunicationSchema() because repo-wide
// `db:push` is broken on a pre-existing FK mismatch.
// ===========================================================================

export const communicationChannelEnum = drmSchema.enum("communication_channel", [
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "VISIT",
  "SMS",
  "NOTE",
  "OTHER",
]);

export const communicationOutcomeEnum = drmSchema.enum("communication_outcome", [
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "NO_RESPONSE",
  "CONVERTED",
  "COMPLAINT",
  "RENEWAL",
  "RESOLVED",
  "DROPOUT_RISK",
  "OTHER",
]);

export const communicationLogs = drmSchema.table("communication_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Polymorphic subject of the communication.
  entityType: text("entity_type").notNull(), // customer | lead | service_customer | ticket | project
  entityId: text("entity_id").notNull(),
  customerId: uuid("customer_id"),
  leadId: uuid("lead_id"),
  userId: uuid("user_id"), // actor
  channel: communicationChannelEnum("channel").notNull(),
  outcome: communicationOutcomeEnum("outcome"),
  notes: text("notes"),
  nextAction: text("next_action"),
  nextFollowupAt: timestamp("next_followup_at"),
  status: text("status").notNull().default("COMPLETED"), // PENDING | COMPLETED | CANCELLED
  relatedFollowupId: text("related_followup_id"),
  relatedAppointmentId: text("related_appointment_id"),
  messageTemplate: text("message_template"),
  externalReference: text("external_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_comm_logs_entity").on(t.entityType, t.entityId),
  index("idx_comm_logs_customer").on(t.customerId),
  index("idx_comm_logs_user").on(t.userId),
  index("idx_comm_logs_followup_due").on(t.nextFollowupAt, t.status),
]);

export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type InsertCommunicationLog = typeof communicationLogs.$inferInsert;

// ===== Patch 2 Stage 6 — Diagnosis Report =====
// Dedicated, honest source for the Diagnosis Report. NOT a reuse of BV/GM data or
// service_complaints — diagnosis is its own business concept. The physical table is
// also created at runtime by ensureDiagnosisSchema() in server/db/ensure.ts because
// `db:push` is broken repo-wide; this definition is the source of truth.
export const diagnosisReports = drmSchema.table("diagnosis_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").references(() => customers.id),
  companyName: text("company_name"),
  personName: text("person_name"),
  diagnosisType: text("diagnosis_type"),
  diagnosisStatus: text("diagnosis_status").notNull().default("OPEN"),
  diagnosisDate: date("diagnosis_date").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  branch: text("branch"),
  department: text("department"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_diagnosis_reports_assigned").on(t.assignedTo),
  index("idx_diagnosis_reports_date").on(t.diagnosisDate),
  index("idx_diagnosis_reports_status").on(t.diagnosisStatus),
]);

export const insertDiagnosisReportSchema = createInsertSchema(diagnosisReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type DiagnosisReport = typeof diagnosisReports.$inferSelect;
export type InsertDiagnosisReport = z.infer<typeof insertDiagnosisReportSchema>;
