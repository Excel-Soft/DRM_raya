import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

function uuidPk() {
  return uuid("id").primaryKey().defaultRandom();
}

function timestamps() {
  return {
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  } as const;
}

function softDelete() {
  return {
    is_deleted: boolean("is_deleted").notNull().default(false),
  } as const;
}

// ======================================================================
// 1) Auth / Access control
// ======================================================================

export const users = pgTable(
  "users",
  {
    id: uuidPk(),
    full_name: text("full_name").notNull(),
    email: text("email").notNull(),
    password_hash: text("password_hash").notNull(),
    // role examples (NOT enforced at DB level): admin, manager, sales_executive, support_agent, accountant
    role: text("role").notNull(),
    is_active: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => ({
    usersEmailUq: uniqueIndex("users_email_uq").on(t.email),
    usersRoleIdx: index("users_role_idx").on(t.role),
    usersIsActiveIdx: index("users_is_active_idx").on(t.is_active),
  }),
);

export const roles = pgTable(
  "roles",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps(),
  },
  (t) => ({
    rolesNameUq: uniqueIndex("roles_name_uq").on(t.name),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuidPk(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    ...timestamps(),
  },
  (t) => ({
    permissionsModuleActionUq: uniqueIndex("permissions_module_action_uq").on(
      t.module,
      t.action,
    ),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuidPk(),
    role_id: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission_id: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => ({
    rolePermissionsRolePermissionUq: uniqueIndex(
      "role_permissions_role_id_permission_id_uq",
    ).on(t.role_id, t.permission_id),
    rolePermissionsRoleIdx: index("role_permissions_role_id_idx").on(t.role_id),
    rolePermissionsPermissionIdx: index("role_permissions_permission_id_idx").on(
      t.permission_id,
    ),
  }),
);

export const urlPermissions = pgTable(
  "url_permissions",
  {
    id: uuidPk(),
    path_pattern: text("path_pattern").notNull(),
    // method examples (NOT enforced at DB level): GET, POST, PUT, PATCH, DELETE
    method: text("method").notNull(),
    permission_id: uuid("permission_id").references(() => permissions.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => ({
    urlPermissionsPathMethodIdx: index("url_permissions_path_method_idx").on(
      t.path_pattern,
      t.method,
    ),
    urlPermissionsPermissionIdx: index("url_permissions_permission_id_idx").on(
      t.permission_id,
    ),
  }),
);

export const allowedIps = pgTable(
  "allowed_ips",
  {
    id: uuidPk(),
    ip_cidr: text("ip_cidr").notNull(),
    description: text("description"),
    is_active: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => ({
    allowedIpsActiveIdx: index("allowed_ips_is_active_idx").on(t.is_active),
    allowedIpsCidrIdx: index("allowed_ips_ip_cidr_idx").on(t.ip_cidr),
  }),
);

export const policies = pgTable(
  "policies",
  {
    id: uuidPk(),
    key: text("key").notNull(),
    value_json: jsonb("value_json").notNull().$type<Record<string, unknown>>(),
    description: text("description"),
    ...timestamps(),
  },
  (t) => ({
    policiesKeyUq: uniqueIndex("policies_key_uq").on(t.key),
  }),
);

// ======================================================================
// 2) CRM / Sales
// ======================================================================

export const customers = pgTable(
  "customers",
  {
    id: uuidPk(),
    company_name: text("company_name").notNull(),
    country: text("country"),
    city: text("city"),
    address: text("address"),
    website: text("website"),
    region: text("region"),
    // status examples (NOT enforced): New, Renew, Expire
    // status examples (NOT enforced): New, Renew, Expire (rest is same as before)
    status: text("status").notNull().default("New"),
    source: text("source"),
    grade: text("grade"),
    rc_link: text("rc_link"),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => ({
    customersCompanyNameIdx: index("customers_company_name_idx").on(
      t.company_name,
    ),
    customersCountryCityIdx: index("customers_country_city_idx").on(
      t.country,
      t.city,
    ),
    customersStatusIdx: index("customers_status_idx").on(t.status),
    customersCreatedByIdx: index("customers_created_by_idx").on(t.created_by),
    customersIsDeletedIdx: index("customers_is_deleted_idx").on(t.is_deleted),
  }),
);

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    is_primary: boolean("is_primary").notNull().default(true),
    title: text("title"),
    person_name: text("person_name"),
    account_holder_name: text("account_holder_name").notNull(),
    cnic: text("cnic"),
    ntn: text("ntn"),
    email: text("email").notNull(),
    phone: text("phone"),
    ...timestamps(),
  },
  (t) => ({
    customerContactsCustomerIdx: index("customer_contacts_customer_id_idx").on(
      t.customer_id,
    ),
    customerContactsEmailIdx: index("customer_contacts_email_idx").on(t.email),
    customerContactsPhoneIdx: index("customer_contacts_phone_idx").on(t.phone),
  }),
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    // stage examples (NOT enforced): lead, qualified, proposal, won, lost
    stage: text("stage").notNull(),
    value: numeric("value", { precision: 14, scale: 2 }),
    expected_close_date: date("expected_close_date"),
    owner_id: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    opportunitiesCustomerIdx: index("opportunities_customer_id_idx").on(
      t.customer_id,
    ),
    opportunitiesOwnerIdx: index("opportunities_owner_id_idx").on(t.owner_id),
    opportunitiesStageIdx: index("opportunities_stage_idx").on(t.stage),
    opportunitiesExpectedCloseIdx: index("opportunities_expected_close_date_idx").on(
      t.expected_close_date,
    ),
    opportunitiesIsDeletedIdx: index("opportunities_is_deleted_idx").on(
      t.is_deleted,
    ),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    // type examples (NOT enforced): call, whatsapp, onsite, email, webinar
    type: text("type").notNull(),
    notes: text("notes"),
    activity_date: timestamp("activity_date", { withTimezone: true }).notNull(),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    activitiesCustomerIdx: index("activities_customer_id_idx").on(t.customer_id),
    activitiesCreatedByIdx: index("activities_created_by_idx").on(t.created_by),
    activitiesDateIdx: index("activities_activity_date_idx").on(t.activity_date),
    activitiesTypeIdx: index("activities_type_idx").on(t.type),
    activitiesIsDeletedIdx: index("activities_is_deleted_idx").on(t.is_deleted),
  }),
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    due_at: timestamp("due_at", { withTimezone: true }).notNull(),
    // status examples (NOT enforced): Open, Completed, Cancelled
    status: text("status").notNull().default("Open"),
    notes: text("notes"),
    assigned_to: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    followUpsCustomerIdx: index("follow_ups_customer_id_idx").on(t.customer_id),
    followUpsDueIdx: index("follow_ups_due_at_idx").on(t.due_at),
    followUpsStatusIdx: index("follow_ups_status_idx").on(t.status),
    followUpsAssignedIdx: index("follow_ups_assigned_to_idx").on(t.assigned_to),
    followUpsIsDeletedIdx: index("follow_ups_is_deleted_idx").on(t.is_deleted),
  }),
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
    ends_at: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    notes: text("notes"),
    assigned_to: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    appointmentsCustomerIdx: index("appointments_customer_id_idx").on(
      t.customer_id,
    ),
    appointmentsStartsIdx: index("appointments_starts_at_idx").on(t.starts_at),
    appointmentsAssignedIdx: index("appointments_assigned_to_idx").on(
      t.assigned_to,
    ),
    appointmentsIsDeletedIdx: index("appointments_is_deleted_idx").on(t.is_deleted),
  }),
);

export const targets = pgTable(
  "targets",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    ab_target: numeric("ab_target", { precision: 14, scale: 2 }),
    vas_target: numeric("vas_target", { precision: 14, scale: 2 }),
    ...timestamps(),
  },
  (t) => ({
    targetsUserMonthYearUq: uniqueIndex("targets_user_id_month_year_uq").on(
      t.user_id,
      t.month,
      t.year,
    ),
    targetsUserIdx: index("targets_user_id_idx").on(t.user_id),
    targetsYearMonthIdx: index("targets_year_month_idx").on(t.year, t.month),
  }),
);

export const teamPerformanceSnapshots = pgTable(
  "team_performance_snapshots",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshot_date: date("snapshot_date").notNull(),
    metrics_json: jsonb("metrics_json").notNull().$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => ({
    teamPerfUserDateUq: uniqueIndex("team_perf_user_id_snapshot_date_uq").on(
      t.user_id,
      t.snapshot_date,
    ),
    teamPerfDateIdx: index("team_perf_snapshot_date_idx").on(t.snapshot_date),
    teamPerfUserIdx: index("team_perf_user_id_idx").on(t.user_id),
  }),
);

// Lead pools

export const gmPoolEntries = pgTable(
  "gm_pool_entries",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    // status examples (NOT enforced): New, Assigned, Closed
    status: text("status").notNull().default("New"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    gmPoolCustomerIdx: index("gm_pool_entries_customer_id_idx").on(t.customer_id),
    gmPoolStatusIdx: index("gm_pool_entries_status_idx").on(t.status),
  }),
);

export const queueSalesEntries = pgTable(
  "queue_sales_entries",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    // status examples (NOT enforced): New, Queued, Assigned, Closed
    status: text("status").notNull().default("New"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    queueSalesCustomerIdx: index("queue_sales_entries_customer_id_idx").on(
      t.customer_id,
    ),
    queueSalesStatusIdx: index("queue_sales_entries_status_idx").on(t.status),
  }),
);

export const tempContacts = pgTable(
  "temp_contacts",
  {
    id: uuidPk(),
    raw_name: text("raw_name"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    tempContactsEmailIdx: index("temp_contacts_email_idx").on(t.email),
    tempContactsPhoneIdx: index("temp_contacts_phone_idx").on(t.phone),
  }),
);

// ======================================================================
// 3) PMS (Project Management)
// ======================================================================

export const projects = pgTable(
  "projects",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    invoice_id: uuid("invoice_id").references(() => productPostingInvoices.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    // status examples (NOT enforced): Active, Completed, OnHold
    status: text("status").notNull().default("Active"),
    start_date: date("start_date"),
    end_date: date("end_date"),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    ...softDelete(),
    ...timestamps(),
  },
  (t) => ({
    projectsCustomerIdx: index("projects_customer_id_idx").on(t.customer_id),
    projectsNameIdx: index("projects_name_idx").on(t.name),
    projectsStatusIdx: index("projects_status_idx").on(t.status),
    projectsCreatedByIdx: index("projects_created_by_idx").on(t.created_by),
    projectsIsDeletedIdx: index("projects_is_deleted_idx").on(t.is_deleted),
  }),
);

export const projectAssignments = pgTable(
  "project_assignments",
  {
    id: uuidPk(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // role examples (NOT enforced): owner, contributor, reviewer
    role: text("role"),
    assigned_at: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (t) => ({
    projectAssignmentsProjectUserUq: uniqueIndex(
      "project_assignments_project_id_user_id_uq",
    ).on(t.project_id, t.user_id),
    projectAssignmentsProjectIdx: index("project_assignments_project_id_idx").on(
      t.project_id,
    ),
    projectAssignmentsUserIdx: index("project_assignments_user_id_idx").on(t.user_id),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuidPk(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // status examples (NOT enforced): ToDo, InProgress, Blocked, Completed
    status: text("status").notNull().default("ToDo"),
    // priority examples (NOT enforced): High, Medium, Low
    priority: text("priority").default("Medium"),
    due_at: timestamp("due_at", { withTimezone: true }),
    assigned_to: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    tasksProjectIdx: index("tasks_project_id_idx").on(t.project_id),
    tasksAssignedIdx: index("tasks_assigned_to_idx").on(t.assigned_to),
    tasksStatusIdx: index("tasks_status_idx").on(t.status),
    tasksDueIdx: index("tasks_due_at_idx").on(t.due_at),
    tasksIsDeletedIdx: index("tasks_is_deleted_idx").on(t.is_deleted),
  }),
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuidPk(),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    comment: text("comment").notNull(),
    ...timestamps(),
  },
  (t) => ({
    taskCommentsTaskIdx: index("task_comments_task_id_idx").on(t.task_id),
    taskCommentsUserIdx: index("task_comments_user_id_idx").on(t.user_id),
  }),
);

export const taskStatusHistory = pgTable(
  "task_status_history",
  {
    id: uuidPk(),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    from_status: text("from_status"),
    to_status: text("to_status").notNull(),
    changed_by: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changed_at: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (t) => ({
    taskStatusTaskIdx: index("task_status_history_task_id_idx").on(t.task_id),
    taskStatusChangedAtIdx: index("task_status_history_changed_at_idx").on(
      t.changed_at,
    ),
  }),
);

export const taskTimeLogs = pgTable(
  "task_time_logs",
  {
    id: uuidPk(),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    start_at: timestamp("start_at", { withTimezone: true }).notNull(),
    end_at: timestamp("end_at", { withTimezone: true }),
    duration_minutes: integer("duration_minutes"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    taskTimeLogsTaskIdx: index("task_time_logs_task_id_idx").on(t.task_id),
    taskTimeLogsUserIdx: index("task_time_logs_user_id_idx").on(t.user_id),
    taskTimeLogsStartIdx: index("task_time_logs_start_at_idx").on(t.start_at),
  }),
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    template_json: jsonb("template_json")
      .notNull()
      .$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => ({
    taskTemplatesNameUq: uniqueIndex("task_templates_name_uq").on(t.name),
  }),
);

export const projectApprovals = pgTable(
  "project_approvals",
  {
    id: uuidPk(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requested_by: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    approved_by: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // status examples (NOT enforced): Pending, Approved, Rejected
    status: text("status").notNull().default("Pending"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    projectApprovalsProjectIdx: index("project_approvals_project_id_idx").on(
      t.project_id,
    ),
    projectApprovalsStatusIdx: index("project_approvals_status_idx").on(t.status),
  }),
);

export const projectFinancials = pgTable(
  "project_financials",
  {
    id: uuidPk(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    budget: numeric("budget", { precision: 14, scale: 2 }),
    cost: numeric("cost", { precision: 14, scale: 2 }),
    revenue: numeric("revenue", { precision: 14, scale: 2 }),
    ...timestamps(),
  },
  (t) => ({
    projectFinancialsProjectUq: uniqueIndex("project_financials_project_id_uq").on(
      t.project_id,
    ),
  }),
);

export const projectPayments = pgTable(
  "project_payments",
  {
    id: uuidPk(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paid_at: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    // method examples (NOT enforced): Cash, BankTransfer, CreditCard, Cheque, Online
    method: text("method"),
    reference: text("reference"),
    ...timestamps(),
  },
  (t) => ({
    projectPaymentsProjectIdx: index("project_payments_project_id_idx").on(
      t.project_id,
    ),
    projectPaymentsPaidAtIdx: index("project_payments_paid_at_idx").on(t.paid_at),
  }),
);

// ======================================================================
// 4) Support
// ======================================================================

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    // status examples (NOT enforced): Open, InProgress, Resolved, Failed
    status: text("status").notNull().default("Open"),
    // priority examples (NOT enforced): Low, Medium, High
    priority: text("priority").default("Medium"),
    // channel examples (NOT enforced): whatsapp, web, email, phone
    channel: text("channel"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    supportTicketsCustomerIdx: index("support_tickets_customer_id_idx").on(
      t.customer_id,
    ),
    supportTicketsCreatedByIdx: index("support_tickets_created_by_idx").on(
      t.created_by,
    ),
    supportTicketsStatusIdx: index("support_tickets_status_idx").on(t.status),
    supportTicketsPriorityIdx: index("support_tickets_priority_idx").on(t.priority),
    supportTicketsChannelIdx: index("support_tickets_channel_idx").on(t.channel),
    supportTicketsIsDeletedIdx: index("support_tickets_is_deleted_idx").on(
      t.is_deleted,
    ),
  }),
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuidPk(),
    ticket_id: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    sender_user_id: uuid("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    message: text("message").notNull(),
    ...timestamps(),
  },
  (t) => ({
    supportMessagesTicketIdx: index("support_messages_ticket_id_idx").on(t.ticket_id),
    supportMessagesCreatedAtIdx: index("support_messages_created_at_idx").on(
      t.created_at,
    ),
  }),
);

export const supportChannelConfig = pgTable(
  "support_channel_config",
  {
    id: uuidPk(),
    channel: text("channel").notNull(),
    config_json: jsonb("config_json").notNull().$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => ({
    supportChannelConfigChannelUq: uniqueIndex(
      "support_channel_config_channel_uq",
    ).on(t.channel),
  }),
);

// ======================================================================
// 5) HR
// ======================================================================

export const attendance = pgTable(
  "attendance",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    check_in: timestamp("check_in", { withTimezone: true }),
    check_out: timestamp("check_out", { withTimezone: true }),
    // status examples (NOT enforced): Present, Absent, Late, HalfDay, Leave
    status: text("status").default("Present"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    attendanceUserDateUq: uniqueIndex("attendance_user_id_date_uq").on(
      t.user_id,
      t.date,
    ),
    attendanceUserIdx: index("attendance_user_id_idx").on(t.user_id),
    attendanceDateIdx: index("attendance_date_idx").on(t.date),
  }),
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    from_date: date("from_date").notNull(),
    to_date: date("to_date").notNull(),
    // type examples (NOT enforced): Sick, Casual, Annual, Emergency, Other
    type: text("type").notNull(),
    // status examples (NOT enforced): Pending, Approved, Rejected, Cancelled
    status: text("status").notNull().default("Pending"),
    reason: text("reason"),
    approved_by: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => ({
    leaveRequestsUserIdx: index("leave_requests_user_id_idx").on(t.user_id),
    leaveRequestsStatusIdx: index("leave_requests_status_idx").on(t.status),
    leaveRequestsFromIdx: index("leave_requests_from_date_idx").on(t.from_date),
  }),
);

// ======================================================================
// 6) Product Posting Workflow
// ======================================================================

export const productPostingInvoices = pgTable(
  "product_posting_invoices",
  {
    id: uuidPk(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    sales_exec_id: uuid("sales_exec_id").notNull().references(() => users.id),
    status: text("status").notNull().default("PENDING_HOD"),
    ...timestamps(),
  }
);

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuidPk(),
    project_id: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    document_url: text("document_url").notNull(),
    uploaded_by: uuid("uploaded_by").notNull().references(() => users.id),
    status: text("status").notNull().default("PENDING"),
    ...timestamps(),
  }
);

export const taskTimeExtensions = pgTable(
  "task_time_extensions",
  {
    id: uuidPk(),
    task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    requested_time_minutes: integer("requested_time_minutes").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("PENDING"),
    ...timestamps(),
  }
);

export const taskResults = pgTable(
  "task_results",
  {
    id: uuidPk(),
    task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    links_posted: integer("links_posted").notNull().default(0),
    total_duration_minutes: integer("total_duration_minutes").notNull().default(0),
    ...timestamps(),
  }
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuidPk(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    type: text("type").notNull().default("INFO"),
    read_status: text("read_status").notNull().default("UNREAD"),
    ...timestamps(),
  }
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuidPk(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    resource_type: text("resource_type").notNull(),
    resource_id: text("resource_id").notNull(),
    details: text("details"),
    ...timestamps(),
  }
);

export const overtimeRecords = pgTable(
  "overtime_records",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    hours: numeric("hours", { precision: 8, scale: 2 }).notNull().default("0"),
    // status examples (NOT enforced): Pending, Approved, Rejected
    status: text("status").notNull().default("Pending"),
    reason: text("reason"),
    approved_by: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => ({
    overtimeUserIdx: index("overtime_records_user_id_idx").on(t.user_id),
    overtimeDateIdx: index("overtime_records_date_idx").on(t.date),
    overtimeStatusIdx: index("overtime_records_status_idx").on(t.status),
  }),
);

export const loanRequests = pgTable(
  "loan_requests",
  {
    id: uuidPk(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    // status examples (NOT enforced): Pending, Approved, Rejected, Completed
    status: text("status").notNull().default("Pending"),
    reason: text("reason"),
    approved_by: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => ({
    loanRequestsUserIdx: index("loan_requests_user_id_idx").on(t.user_id),
    loanRequestsStatusIdx: index("loan_requests_status_idx").on(t.status),
  }),
);

// ======================================================================
// 6) Accounts
// ======================================================================

export const gmEntries = pgTable(
  "gm_entries",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    // status examples (NOT enforced): Pending, Approved, Rejected, Posted
    status: text("status").notNull().default("Pending"),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    gmEntriesCustomerIdx: index("gm_entries_customer_id_idx").on(t.customer_id),
    gmEntriesCreatedByIdx: index("gm_entries_created_by_idx").on(t.created_by),
    gmEntriesStatusIdx: index("gm_entries_status_idx").on(t.status),
    gmEntriesIsDeletedIdx: index("gm_entries_is_deleted_idx").on(t.is_deleted),
  }),
);

export const tempGmEntries = pgTable(
  "temp_gm_entries",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("Pending"),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    tempGmEntriesCustomerIdx: index("temp_gm_entries_customer_id_idx").on(
      t.customer_id,
    ),
    tempGmEntriesCreatedByIdx: index("temp_gm_entries_created_by_idx").on(
      t.created_by,
    ),
    tempGmEntriesStatusIdx: index("temp_gm_entries_status_idx").on(t.status),
    tempGmEntriesIsDeletedIdx: index("temp_gm_entries_is_deleted_idx").on(
      t.is_deleted,
    ),
  }),
);

export const refundGmEntries = pgTable(
  "refund_gm_entries",
  {
    id: uuidPk(),
    gm_entry_id: uuid("gm_entry_id").references(() => gmEntries.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("Pending"),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    refundGmEntryIdx: index("refund_gm_entries_gm_entry_id_idx").on(t.gm_entry_id),
    refundGmStatusIdx: index("refund_gm_entries_status_idx").on(t.status),
    refundGmIsDeletedIdx: index("refund_gm_entries_is_deleted_idx").on(t.is_deleted),
  }),
);

export const donations = pgTable(
  "donations",
  {
    id: uuidPk(),
    donor_name: text("donor_name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date").notNull(),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    donationsDateIdx: index("donations_date_idx").on(t.date),
    donationsDonorIdx: index("donations_donor_name_idx").on(t.donor_name),
    donationsIsDeletedIdx: index("donations_is_deleted_idx").on(t.is_deleted),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuidPk(),
    customer_id: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    invoice_no: text("invoice_no").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    // status examples (NOT enforced): Draft, Issued, Paid, Overdue, Cancelled
    status: text("status").notNull().default("Draft"),
    issued_at: date("issued_at"),
    due_at: date("due_at"),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    invoicesInvoiceNoUq: uniqueIndex("invoices_invoice_no_uq").on(t.invoice_no),
    invoicesCustomerIdx: index("invoices_customer_id_idx").on(t.customer_id),
    invoicesStatusIdx: index("invoices_status_idx").on(t.status),
    invoicesDueIdx: index("invoices_due_at_idx").on(t.due_at),
    invoicesIsDeletedIdx: index("invoices_is_deleted_idx").on(t.is_deleted),
  }),
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuidPk(),
    entry_date: date("entry_date").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    description: text("description"),
    reference_type: text("reference_type").notNull(),
    reference_id: uuid("reference_id"),
    ...timestamps(),
  },
  (t) => ({
    ledgerEntryDateIdx: index("ledger_entries_entry_date_idx").on(t.entry_date),
    ledgerReferenceIdx: index("ledger_entries_reference_idx").on(
      t.reference_type,
      t.reference_id,
    ),
  }),
);

// ======================================================================
// 7) Office
// ======================================================================

export const accountHeads = pgTable(
  "account_heads",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    // type examples (NOT enforced): expense, income, asset, liability
    type: text("type").notNull(),
    ...timestamps(),
  },
  (t) => ({
    accountHeadsNameUq: uniqueIndex("account_heads_name_uq").on(t.name),
    accountHeadsTypeIdx: index("account_heads_type_idx").on(t.type),
  }),
);

export const officeExpenses = pgTable(
  "office_expenses",
  {
    id: uuidPk(),
    account_head_id: uuid("account_head_id")
      .notNull()
      .references(() => accountHeads.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    expense_date: date("expense_date").notNull(),
    notes: text("notes"),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    officeExpensesHeadIdx: index("office_expenses_account_head_id_idx").on(
      t.account_head_id,
    ),
    officeExpensesDateIdx: index("office_expenses_expense_date_idx").on(
      t.expense_date,
    ),
    officeExpensesCreatedByIdx: index("office_expenses_created_by_idx").on(
      t.created_by,
    ),
    officeExpensesIsDeletedIdx: index("office_expenses_is_deleted_idx").on(t.is_deleted),
  }),
);

export const officeVas = pgTable(
  "office_vas",
  {
    id: uuidPk(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    value: numeric("value", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => ({
    officeVasMonthYearUq: uniqueIndex("office_vas_month_year_uq").on(
      t.month,
      t.year,
    ),
    officeVasYearMonthIdx: index("office_vas_year_month_idx").on(t.year, t.month),
  }),
);

export const cheques = pgTable(
  "cheques",
  {
    id: uuidPk(),
    cheque_no: text("cheque_no").notNull(),
    bank: text("bank"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    issue_date: date("issue_date").notNull(),
    // status examples (NOT enforced): Issued, Cleared, Bounced, Cancelled
    status: text("status").notNull().default("Issued"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    chequesChequeNoIdx: index("cheques_cheque_no_idx").on(t.cheque_no),
    chequesIssueDateIdx: index("cheques_issue_date_idx").on(t.issue_date),
    chequesStatusIdx: index("cheques_status_idx").on(t.status),
    chequesIsDeletedIdx: index("cheques_is_deleted_idx").on(t.is_deleted),
  }),
);

export const businessCustomers = pgTable(
  "business_customers",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    contact_person: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    businessCustomersNameIdx: index("business_customers_name_idx").on(t.name),
    businessCustomersEmailIdx: index("business_customers_email_idx").on(t.email),
    businessCustomersPhoneIdx: index("business_customers_phone_idx").on(t.phone),
    businessCustomersIsDeletedIdx: index("business_customers_is_deleted_idx").on(
      t.is_deleted,
    ),
  }),
);

// ======================================================================
// 8) Training Center
// ======================================================================

export const trainingModules = pgTable(
  "training_modules",
  {
    id: uuidPk(),
    title: text("title").notNull(),
    category: text("category"),
    content_url: text("content_url"),
    description: text("description"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => ({
    trainingModulesTitleIdx: index("training_modules_title_idx").on(t.title),
    trainingModulesCategoryIdx: index("training_modules_category_idx").on(t.category),
    trainingModulesIsDeletedIdx: index("training_modules_is_deleted_idx").on(
      t.is_deleted,
    ),
  }),
);

export const trainingProgress = pgTable(
  "training_progress",
  {
    id: uuidPk(),
    module_id: uuid("module_id")
      .notNull()
      .references(() => trainingModules.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    progress_percent: integer("progress_percent").notNull().default(0),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => ({
    trainingProgressModuleUserUq: uniqueIndex(
      "training_progress_module_id_user_id_uq",
    ).on(t.module_id, t.user_id),
    trainingProgressModuleIdx: index("training_progress_module_id_idx").on(t.module_id),
    trainingProgressUserIdx: index("training_progress_user_id_idx").on(t.user_id),
  }),
);

export const bvReports = pgTable("bv_reports", {
  id: uuidPk(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  assigned_to: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  company_name: text("company_name"),
  report_date: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  total_tasks: integer("total_tasks").notNull().default(0),
  value_sold: numeric("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  success_rate: numeric("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  follow_ups_done: integer("follow_ups_done").notNull().default(0),
  missed_leads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  ...timestamps(),
});

export const loanReports = pgTable("loan_reports", {
  id: uuidPk(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  report_date: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  total_tasks: integer("total_tasks").notNull().default(0),
  value_sold: numeric("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  success_rate: numeric("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  follow_ups_done: integer("follow_ups_done").notNull().default(0),
  missed_leads: integer("missed_leads").notNull().default(0),
  total_applications: integer("total_applications").notNull().default(0),
  approved_loans: integer("approved_loans").notNull().default(0),
  rejected_loans: integer("rejected_loans").notNull().default(0),
  pending_loans: integer("pending_loans").notNull().default(0),
  total_loan_amount: numeric("total_loan_amount", { precision: 16, scale: 2 }).notNull().default("0"),
  disbursed_amount: numeric("disbursed_amount", { precision: 16, scale: 2 }).notNull().default("0"),
  meta: jsonb("meta"),
  ...timestamps(),
});

export const vasReports = pgTable("vas_reports", {
  id: uuidPk(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  report_date: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  total_tasks: integer("total_tasks").notNull().default(0),
  value_sold: numeric("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  success_rate: numeric("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  follow_ups_done: integer("follow_ups_done").notNull().default(0),
  missed_leads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  ...timestamps(),
});

export const gmReports = pgTable("gm_reports", {
  id: uuidPk(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  report_date: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("Draft"),
  title: text("title"),
  summary: text("summary"),
  notes: text("notes"),
  total_tasks: integer("total_tasks").notNull().default(0),
  value_sold: numeric("value_sold", { precision: 14, scale: 2 }).notNull().default("0"),
  success_rate: numeric("success_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  follow_ups_done: integer("follow_ups_done").notNull().default(0),
  missed_leads: integer("missed_leads").notNull().default(0),
  meta: jsonb("meta"),
  ...timestamps(),
});
