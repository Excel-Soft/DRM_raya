import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, pgEnum, boolean, date, jsonb, primaryKey, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "LD", "QF", "AY", "IN", "PM", "GM", "BV", "NC", "RC", "EC", "FW", "NF"
]);

export const customerStatusEnum = pgEnum("customer_status", ["New", "Renew", "Expire"]);

export const activityMethodEnum = pgEnum("activity_method", [
  "mobile", "whatsapp", "onsite", "email", "seminar", "webinar"
]);

export const followUpStatusEnum = pgEnum("followup_status", ["Open", "Completed"]);
export const followUpMethodEnum = pgEnum("followup_method", ["Call", "Email", "WhatsApp", "Visit"]);
export const followUpOutcomeEnum = pgEnum("followup_outcome", ["Interested", "NotInterested", "CallBack", "NoAnswer", "Converted", "Lost"]);

export const targetTypeEnum = pgEnum("target_type", ["AB", "VAS"]);

// PMS enums
export const projectStatusEnum = pgEnum("project_status", ["Active", "Completed", "OnHold", "READY_FOR_QA", "IN_EXECUTION"]);
export const taskCategoryEnum = pgEnum("task_category", ["Work", "Personal", "Meeting", "Announcement", "Other"]);
export const taskPriorityEnum = pgEnum("task_priority", ["High", "Medium", "Low"]);
export const taskStatusEnum = pgEnum("task_status", ["ToDo", "InProgress", "Blocked", "Completed", "READY_FOR_QA", "IN_EXECUTION"]);

// Product Posting Workflow enums
export const productInvoiceStatusEnum = pgEnum("product_invoice_status", ["PENDING_HOD", "PENDING_ACCOUNT", "APPROVED", "REJECTED", "CANCELLED"]);
export const documentStatusEnum = pgEnum("document_status", ["PENDING", "APPROVED", "REJECTED"]);
export const extensionStatusEnum = pgEnum("extension_status", ["PENDING", "APPROVED", "REJECTED"]);
export const notificationTypeEnum = pgEnum("notification_type", ["INFO", "WARNING", "SUCCESS", "ERROR"]);
export const notificationReadStatusEnum = pgEnum("notification_read_status", ["UNREAD", "READ"]);

// Support enums
export const supportChannelEnum = pgEnum("support_channel", ["whatsapp", "web", "email", "phone"]);
export const supportTicketStatusEnum = pgEnum("support_ticket_status", ["Open", "InProgress", "Resolved", "Failed"]);
export const supportPriorityEnum = pgEnum("support_priority", ["Low", "Medium", "High"]);
export const supportMessageFromEnum = pgEnum("support_message_from", ["customer", "agent", "system"]);

// Attendance enum
export const attendanceStatusEnum = pgEnum("attendance_status", ["Present", "Absent", "Late", "HalfDay", "Leave"]);

// Leave request enums
export const leaveTypeEnum = pgEnum("leave_type", ["Sick", "Casual", "Annual", "Emergency", "HalfDay", "Unpaid", "Maternity", "Paternity", "Other"]);
export const leaveStatusEnum = pgEnum("leave_status", ["Pending", "Approved", "Rejected", "Cancelled"]);

// Overtime enum
export const overtimeStatusEnum = pgEnum("overtime_status", ["Pending", "Approved", "Rejected"]);

// Loan/Advance Salary enum
export const loanStatusEnum = pgEnum("loan_status", ["Pending", "ManagerApproved", "HODApproved", "Rejected", "Completed"]);

// Pool type enum
export const poolTypeEnum = pgEnum("pool_type", ["Private", "Service", "GMBV", "Public"]);

// Project approval status enum
export const projectApprovalStatusEnum = pgEnum("project_approval_status", ["Pending", "Approved", "Rejected"]);

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", ["Cash", "BankTransfer", "CreditCard", "Cheque", "Online"]);

// Training Center enums
export const trainingCategoryEnum = pgEnum("training_category", ["DRM", "SEO", "Alibaba", "SalesTools"]);
export const trainingContentTypeEnum = pgEnum("training_content_type", ["video", "document", "link"]);

// Temporary contact status enum
export const tempContactStatusEnum = pgEnum("temp_contact_status", ["Pending", "Promoted", "Rejected"]);

export const servicePoolStatusEnum = pgEnum("service_pool_status", ["active", "dropout", "completed", "refund", "temp", "pending"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  full_name: text("full_name"),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  password_hash: text("password_hash"),
  roleId: text("role_id"),
  role: text("role"),
  roles: text("roles").array(),
  branch: text("branch").notNull().default("Lahore Gulburg"),
  country: text("country").notNull().default("Pakistan"),
  department: text("department"),
  designation: text("designation"),
  phone: text("phone"),
  is_active: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customers table
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  accountName: text("account_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  region: text("region").notNull(),
  grade: text("grade").notNull(), // A+, A-, B+, B-, C+, C, D
  status: customerStatusEnum("status").notNull().default("New"),
  ntn: text("ntn"),
  lastNote: text("last_note"),
  // Company Detail fields
  country: text("country"),
  city: text("city"),
  address: text("address"),
  crmId: text("crm_id"),
  crmDate: timestamp("crm_date"),
  companyType: text("company_type"),
  // Primary Detail fields
  title: text("title"), // Mr, Mrs, Ms, Dr, etc.
  personName: text("person_name"),
  cnic: text("cnic"),
  website: text("website"),
  mobile: text("mobile"),
  designation: text("designation"),
  comment: text("comment"),
  // Lead Detail fields
  rcLink: text("rc_link"),
  source: text("source"), // Lead source
  serviceTypes: text("service_types").array().default(sql`'{}'::text[]`), // Multi-select services
  businessLine: text("business_line"), // Industry/niche/sector
  // Pool management
  poolType: poolTypeEnum("pool_type").default("Private"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  lastFollowUpDate: timestamp("last_followup_date"),
  expiresAt: timestamp("expires_at"),
  isGoldMember: integer("is_gold_member").default(0), // 0 = no, 1 = yes
  isBusinessVerified: integer("is_business_verified").default(0), // 0 = no, 1 = yes
  abType: text("ab_type"),
  drmId: text("drm_id").unique(),
  phoneNormalized: text("phone_normalized"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Temporary Contacts table
export const tempContacts = pgTable("temp_contacts", {
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
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  performedBy: varchar("performed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadServices = pgTable("lead_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Opportunities (Customer stages in pipeline) - aligns with existing DB columns
export const opportunities = pgTable("opportunities", {
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
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  method: activityMethodEnum("method").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  dateTime: timestamp("date_time").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// FollowUps
export const followUps = pgTable("follow_ups", {
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

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followupServices = pgTable("followup_services", {
  followupId: varchar("followup_id").notNull().references(() => followUps.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followupId, t.serviceId] }),
}));

export const serviceSubservices = pgTable("service_subservices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followupSubservices = pgTable("followup_subservices", {
  followupId: varchar("followup_id").notNull().references(() => followUps.id, { onDelete: "cascade" }),
  subserviceId: varchar("subservice_id").notNull().references(() => serviceSubservices.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followupId, t.subserviceId] }),
}));

export const callSessions = pgTable("call_sessions", {
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
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  purpose: text("purpose").notNull(),
  dateTime: timestamp("date_time").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Targets
export const targets = pgTable("targets", {
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
export const vasProgressSnapshots = pgTable("vas_progress_snapshots", {
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

export const productPostingInvoices = pgTable("product_posting_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  salesExecId: uuid("sales_exec_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING_HOD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => productPostingInvoices.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  workSpace: text("workspace"),
  status: projectStatusEnum("status").notNull().default("Active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  participants: text("participants").array().notNull().default(sql`'{}'::text[]`),
  category: taskCategoryEnum("category").notNull().default("Work"),
  priority: taskPriorityEnum("priority").notNull().default("Medium"),
  status: taskStatusEnum("status").notNull().default("ToDo"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  timerStartedAt: timestamp("timer_started_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Comments
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== PMS Financial & Approval Tables =====

// Project Financials (one-to-one with projects)
export const projectFinancials = pgTable("project_financials", {
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
export const projectPayments = pgTable("project_payments", {
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
export const projectApprovals = pgTable("project_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // "HOD", "Department", "Finance", etc.
  status: projectApprovalStatusEnum("status").notNull().default("Pending"),
  approverUserId: varchar("approver_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project Assignments (team members assigned to projects)
export const projectAssignments = pgTable("project_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("Member"), // "Lead", "Member", "Reviewer"
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Time Logs (for time tracking history)
export const taskTimeLogs = pgTable("task_time_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  timeSpentMinutes: integer("time_spent_minutes").notNull(),
  description: text("description"),
  logDate: timestamp("log_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Status History (for tracking task status changes)
export const taskStatusHistory = pgTable("task_status_history", {
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
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  module: text("module").notNull(), // "customers", "pms", "hr", "support", "reports"
  action: text("action").notNull(), // "read", "write", "delete", "approve", "manage"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Role Permissions (junction table)
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Impersonation Audit Logs
export const impersonationAuditLogs = pgTable("impersonation_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  targetRole: varchar("target_role").notNull(),
  action: text("action").notNull(), // "start" or "stop"
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  channel: supportChannelEnum("channel").notNull().default("web"),
  subject: text("subject").notNull(),
  status: supportTicketStatusEnum("status").notNull().default("Open"),
  priority: supportPriorityEnum("priority").notNull().default("Medium"),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  dataSend: integer("data_send").notNull().default(0), // 0 = not sent, 1 = sent
  externalReference: text("external_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Support Messages
export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  from: supportMessageFromEnum("from").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Support Channel Config
export const supportChannelConfig = pgTable("support_channel_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: supportChannelEnum("channel").notNull().unique(),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Settings enums
export const policyTypeEnum = pgEnum("policy_type", ["text", "numericRange"]);

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// URL Permissions table
export const urlPermissions = pgTable("url_permissions", {
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
export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value_json: jsonb("value_json").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Allowed IPs table
export const allowedIps = pgTable("allowed_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ip_cidr: text("ip_cidr").notNull().unique(),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// ===== HR / Attendance Tables =====

// Attendance Records
export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  timeIn: timestamp("time_in"),
  timeOut: timestamp("time_out"),
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
export const leaveRequests = pgTable("leave_requests", {
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
export const overtimeRecords = pgTable("overtime_records", {
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
export const loanRequests = pgTable("loan_requests", {
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
export const trainingModules = pgTable("training_modules", {
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
export const trainingProgress = pgTable("training_progress", {
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
export const gmPoolStatusEnum = pgEnum("gm_pool_status", ["Active", "Pending", "Inactive"]);

// GM Pool Entries
export const gmPoolEntries = pgTable("gm_pool_entries", {
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
export const queueSalesStatusEnum = pgEnum("queue_sales_status", ["Waiting", "InProgress", "Completed", "Cancelled"]);

// Queue Sales Entries
export const queueSalesEntries = pgTable("queue_sales_entries", {
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
export const teamPerformanceSnapshots = pgTable("team_performance_snapshots", {
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
export const taskTemplates = pgTable("task_templates", {
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
export const gmEntryTypeEnum = pgEnum("gm_entry_type", ["GM", "TempGM", "RefundGM"]);

// GM Entry status enum
export const gmEntryStatusEnum = pgEnum("gm_entry_status", ["Pending", "Approved", "Rejected", "Completed"]);

// Invoice status enum
export const invoiceStatusEnum = pgEnum("invoice_status", ["Draft", "Pending", "Sent", "Paid", "Overdue", "Cancelled"]);

// Ledger entry type enum
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", ["Credit", "Debit"]);

// GM Entries (GM, Temp GM, Refund GM)
export const gmEntries = pgTable("gm_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gmType: gmEntryTypeEnum("gm_type").notNull().default("GM"),
  drmId: text("drm_id").notNull(),
  memberId: text("member_id"),
  orderId: text("order_id"),
  companyName: text("company_name").notNull(),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  salesPersonName: text("sales_person_name"),
  addedById: varchar("added_by_id").references(() => users.id),
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

  status: gmEntryStatusEnum("status").notNull().default("Pending"),
  isLoan: integer("is_loan").notNull().default(0),
  isPartialPayment: integer("is_partial_payment").notNull().default(0),
  notes: text("notes"),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Temporary GM Entries (for Add Temporary GM screen)
export const tempGmEntries = pgTable("temp_gm_entries", {
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
export const refundGmEntries = pgTable("refund_gm_entries", {
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
export const donations = pgTable("donations", {
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
export const bvEntries = pgTable("bv_entries", {
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
export const invoices = pgTable("invoices", {
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
});

// Company Ledger entries
export const ledgerEntries = pgTable("ledger_entries", {
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

export const servicePoolEntries = pgTable("service_pool_entries", {
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

export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;
export type TaskTemplate = typeof taskTemplates.$inferSelect;

// Office Account Tables
export const accountHeadCategoryEnum = pgEnum("account_head_category", ["Assets", "Liabilities", "OwnerEquity", "Revenue", "Expenses"]);

export const accountHeads = pgTable("account_heads", {
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

export const officeExpenses = pgTable("office_expenses", {
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

export const officeVas = pgTable("office_vas", {
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

export const chequeStatusEnum = pgEnum("cheque_status", ["Pending", "Cleared", "Bounced", "Cancelled"]);

export const cheques = pgTable("cheques", {
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

export const businessCustomers = pgTable("business_customers", {
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

// Account Module schemas
export const insertGmEntrySchema = createInsertSchema(gmEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  approvedByUserId: true,
  approvedAt: true,
  salesPersonId: true,
  addedById: true,
}).extend({
  isLoan: z.union([z.boolean(), z.number()]).transform(v => typeof v === 'boolean' ? (v ? 1 : 0) : v).optional(),
  isPartialPayment: z.union([z.boolean(), z.number()]).transform(v => typeof v === 'boolean' ? (v ? 1 : 0) : v).optional(),
});

export const insertDonationSchema = createInsertSchema(donations).omit({
  id: true,
  createdAt: true,
  createdByUserId: true,
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
  entryDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

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
export const userActivityTypeEnum = pgEnum("user_activity_type", ["GM", "Invoice", "Refund", "Donation", "Expense", "VAS", "Cheque", "Customer", "Project", "Task"]);

export const userActivities = pgTable("user_activities", {
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
export const bvReports = pgTable("bv_reports", {
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
export const loanReports = pgTable("loan_reports", {
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

export const vasReports = pgTable("vas_reports", {
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

export const gmReports = pgTable("gm_reports", {
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

export const attributes = pgTable("attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: varchar("category", { length: 100 }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttributeSchema = createInsertSchema(attributes);
export const selectAttributeSchema = createInsertSchema(attributes);

// ===== Product Posting Workflow Tables =====

export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  documentUrl: text("document_url").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskTimeExtensions = pgTable("task_time_extensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  requestedTimeMinutes: integer("requested_time_minutes").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskResults = pgTable("task_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  linksPosted: integer("links_posted").notNull().default(0),
  totalDurationMinutes: integer("total_duration_minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  readStatus: text("read_status").notNull().default("UNREAD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductPostingInvoiceSchema = createInsertSchema(productPostingInvoices);
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments);
export const insertTaskTimeExtensionSchema = createInsertSchema(taskTimeExtensions);
export const insertTaskResultSchema = createInsertSchema(taskResults);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
