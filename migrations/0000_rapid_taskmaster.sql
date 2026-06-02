CREATE SCHEMA "drm";
--> statement-breakpoint
CREATE TYPE "drm"."account_head_category" AS ENUM('Assets', 'Liabilities', 'OwnerEquity', 'Revenue', 'Expenses');--> statement-breakpoint
CREATE TYPE "drm"."activity_method" AS ENUM('mobile', 'whatsapp', 'onsite', 'email', 'seminar', 'webinar');--> statement-breakpoint
CREATE TYPE "drm"."attendance_status" AS ENUM('Present', 'Absent', 'Late', 'HalfDay', 'Leave');--> statement-breakpoint
CREATE TYPE "drm"."cheque_status" AS ENUM('Pending', 'Cleared', 'Bounced', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."customer_status" AS ENUM('New', 'Renew', 'Expire');--> statement-breakpoint
CREATE TYPE "drm"."followup_method" AS ENUM('Call', 'Email', 'WhatsApp', 'Visit');--> statement-breakpoint
CREATE TYPE "drm"."followup_outcome" AS ENUM('Interested', 'NotInterested', 'CallBack', 'NoAnswer', 'Converted', 'Lost');--> statement-breakpoint
CREATE TYPE "drm"."followup_status" AS ENUM('Open', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."gm_entry_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."gm_entry_type" AS ENUM('GM', 'TempGM', 'RefundGM');--> statement-breakpoint
CREATE TYPE "drm"."gm_pool_status" AS ENUM('Active', 'Pending', 'Inactive');--> statement-breakpoint
CREATE TYPE "drm"."invoice_status" AS ENUM('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."leave_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."leave_type" AS ENUM('Sick', 'Casual', 'Annual', 'Emergency', 'HalfDay', 'Unpaid', 'Maternity', 'Paternity', 'Other');--> statement-breakpoint
CREATE TYPE "drm"."ledger_entry_type" AS ENUM('Credit', 'Debit');--> statement-breakpoint
CREATE TYPE "drm"."loan_status" AS ENUM('Pending', 'ManagerApproved', 'HODApproved', 'Rejected', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."overtime_status" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."payment_method" AS ENUM('Cash', 'BankTransfer', 'CreditCard', 'Cheque', 'Online');--> statement-breakpoint
CREATE TYPE "drm"."pipeline_stage" AS ENUM('LD', 'QF', 'AY', 'IN', 'PM', 'GM', 'BV', 'NC', 'RC', 'EC', 'FW', 'NF');--> statement-breakpoint
CREATE TYPE "drm"."policy_type" AS ENUM('text', 'numericRange');--> statement-breakpoint
CREATE TYPE "drm"."pool_type" AS ENUM('Private', 'Service', 'GMBV', 'Public');--> statement-breakpoint
CREATE TYPE "drm"."project_approval_status" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."project_status" AS ENUM('Active', 'Completed', 'OnHold');--> statement-breakpoint
CREATE TYPE "drm"."queue_sales_status" AS ENUM('Waiting', 'InProgress', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."service_pool_status" AS ENUM('active', 'dropout', 'completed', 'refund', 'temp', 'pending');--> statement-breakpoint
CREATE TYPE "drm"."support_channel" AS ENUM('whatsapp', 'web', 'email', 'phone');--> statement-breakpoint
CREATE TYPE "drm"."support_message_from" AS ENUM('customer', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "drm"."support_priority" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "drm"."support_ticket_status" AS ENUM('Open', 'InProgress', 'Resolved', 'Failed');--> statement-breakpoint
CREATE TYPE "drm"."target_type" AS ENUM('AB', 'VAS');--> statement-breakpoint
CREATE TYPE "drm"."task_category" AS ENUM('Work', 'Personal', 'Meeting', 'Announcement', 'Other');--> statement-breakpoint
CREATE TYPE "drm"."task_priority" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "drm"."task_status" AS ENUM('ToDo', 'InProgress', 'Blocked', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."temp_contact_status" AS ENUM('Pending', 'Promoted', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."training_category" AS ENUM('DRM', 'SEO', 'Alibaba', 'SalesTools');--> statement-breakpoint
CREATE TYPE "drm"."training_content_type" AS ENUM('video', 'document', 'link');--> statement-breakpoint
CREATE TYPE "drm"."user_activity_type" AS ENUM('GM', 'Invoice', 'Refund', 'Donation', 'Expense', 'VAS', 'Cheque', 'Customer', 'Project', 'Task');--> statement-breakpoint
CREATE TABLE "drm"."account_heads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "drm"."account_head_category" NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_heads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"method" "drm"."activity_method" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"date_time" timestamp NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."allowed_ips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_cidr" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_ips_ip_cidr_unique" UNIQUE("ip_cidr")
);
--> statement-breakpoint
CREATE TABLE "drm"."appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"purpose" text NOT NULL,
	"date_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"time_in" timestamp,
	"time_out" timestamp,
	"status" "drm"."attendance_status" DEFAULT 'Absent' NOT NULL,
	"late_checkin" boolean DEFAULT false NOT NULL,
	"late_checkout" boolean DEFAULT false NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"working_hours" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."business_customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"cnic" text,
	"ntn" text,
	"address" text,
	"total_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_due" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."bv_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"package_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"commission" numeric(12, 2),
	"reward" numeric(12, 2),
	"vas_amount" numeric(12, 2),
	"kwa_amount" numeric(12, 2),
	"method" text,
	"person_name" text,
	"pay_amount" numeric(12, 2),
	"bv_amount" numeric(12, 2),
	"entry_type" text,
	"type" text,
	"received_at" timestamp DEFAULT now(),
	"sales_person_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."bv_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"assigned_to" varchar,
	"company_name" text,
	"report_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"title" text,
	"summary" text,
	"notes" text,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"value_sold" numeric(14, 2) DEFAULT '0' NOT NULL,
	"success_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"follow_ups_done" integer DEFAULT 0 NOT NULL,
	"missed_leads" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."call_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"assigned_to" varchar,
	"followup_id" varchar,
	"reservation_type" text NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"provider_call_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."cheques" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cheque_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"company_name" text NOT NULL,
	"cheque_date" timestamp NOT NULL,
	"status" "drm"."cheque_status" DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"account_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"region" text NOT NULL,
	"grade" text NOT NULL,
	"status" "drm"."customer_status" DEFAULT 'New' NOT NULL,
	"ntn" text,
	"last_note" text,
	"country" text,
	"city" text,
	"address" text,
	"crm_id" text,
	"crm_date" timestamp,
	"company_type" text,
	"title" text,
	"person_name" text,
	"cnic" text,
	"website" text,
	"mobile" text,
	"designation" text,
	"comment" text,
	"rc_link" text,
	"source" text,
	"service_types" text[] DEFAULT '{}'::text[],
	"business_line" text,
	"pool_type" "drm"."pool_type" DEFAULT 'Private',
	"owner_user_id" uuid,
	"created_by" uuid,
	"last_followup_date" timestamp,
	"expires_at" timestamp,
	"is_gold_member" integer DEFAULT 0,
	"is_business_verified" integer DEFAULT 0,
	"ab_type" text,
	"drm_id" text,
	"phone_normalized" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_drm_id_unique" UNIQUE("drm_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."donations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"title" text DEFAULT 'Mr.' NOT NULL,
	"person_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"comment" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"payment_proof" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."follow_ups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"assigned_to" varchar,
	"created_by" varchar,
	"due_at" timestamp NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"notes" text,
	"method" text,
	"reservation_type" text,
	"talk_time_seconds" integer DEFAULT 0 NOT NULL,
	"date_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."followup_services" (
	"followup_id" varchar NOT NULL,
	"service_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "followup_services_followup_id_service_id_pk" PRIMARY KEY("followup_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."followup_subservices" (
	"followup_id" varchar NOT NULL,
	"subservice_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "followup_subservices_followup_id_subservice_id_pk" PRIMARY KEY("followup_id","subservice_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gm_type" "drm"."gm_entry_type" DEFAULT 'GM' NOT NULL,
	"drm_id" text NOT NULL,
	"member_id" text,
	"order_id" text,
	"company_name" text NOT NULL,
	"sales_person_id" varchar,
	"sales_person_name" text,
	"added_by_id" varchar,
	"added_by_name" text,
	"package_type" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount_usd" numeric(12, 2) NOT NULL,
	"customer_dollar" numeric(12, 2),
	"dollar_rate" numeric(12, 4),
	"amount_pkr" numeric(15, 2),
	"alibaba_discount_usd" numeric(12, 2),
	"final_order_usd" numeric(12, 2),
	"extra_discount_usd" numeric(12, 2),
	"extra_discount_pkr" numeric(15, 2),
	"extra_discount_hod" numeric(12, 2),
	"installments" jsonb,
	"status" "drm"."gm_entry_status" DEFAULT 'Pending' NOT NULL,
	"is_loan" integer DEFAULT 0 NOT NULL,
	"is_partial_payment" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_pool_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"customer_id" varchar,
	"sales_person_id" varchar NOT NULL,
	"package" text NOT NULL,
	"dollar_rate" numeric(10, 2) NOT NULL,
	"discount" numeric(5, 2) DEFAULT '0',
	"status" "drm"."gm_pool_status" DEFAULT 'Pending' NOT NULL,
	"hod_approved" integer DEFAULT 0,
	"accountant_verified" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"report_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"title" text,
	"summary" text,
	"notes" text,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"value_sold" numeric(14, 2) DEFAULT '0' NOT NULL,
	"success_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"follow_ups_done" integer DEFAULT 0 NOT NULL,
	"missed_leads" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."impersonation_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar NOT NULL,
	"target_role" varchar NOT NULL,
	"action" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" varchar,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_address" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "drm"."invoice_status" DEFAULT 'Draft' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"notes" text,
	"items" text NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "drm"."lead_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"action" text NOT NULL,
	"performed_by" varchar NOT NULL,
	"note" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."lead_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"service_type" text NOT NULL,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."leave_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"purpose" text NOT NULL,
	"leave_type" "drm"."leave_type" NOT NULL,
	"alternative" text NOT NULL,
	"from_date" timestamp NOT NULL,
	"to_date" timestamp NOT NULL,
	"time" text,
	"description" text,
	"status" "drm"."leave_status" DEFAULT 'Pending' NOT NULL,
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."ledger_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_type" "drm"."ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"reference_id" varchar,
	"reference_type" text,
	"balance_after" numeric(12, 2),
	"entry_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."loan_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"report_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"title" text,
	"summary" text,
	"notes" text,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"value_sold" numeric(14, 2) DEFAULT '0' NOT NULL,
	"success_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"follow_ups_done" integer DEFAULT 0 NOT NULL,
	"missed_leads" integer DEFAULT 0 NOT NULL,
	"total_applications" integer DEFAULT 0 NOT NULL,
	"approved_loans" integer DEFAULT 0 NOT NULL,
	"rejected_loans" integer DEFAULT 0 NOT NULL,
	"pending_loans" integer DEFAULT 0 NOT NULL,
	"total_loan_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"disbursed_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."loan_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"detail" text NOT NULL,
	"status" "drm"."loan_status" DEFAULT 'Pending' NOT NULL,
	"manager_approved_by_user_id" varchar,
	"manager_approved_at" timestamp,
	"hod_approved_by_user_id" varchar,
	"hod_approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."office_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_head" text NOT NULL,
	"office" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"voucher_number" text,
	"cheque_number" text,
	"file_url" text,
	"detail" text,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."office_vas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"method" text NOT NULL,
	"vas_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"title" text,
	"stage" "drm"."pipeline_stage" DEFAULT 'LD' NOT NULL,
	"value" numeric(10, 2) DEFAULT '0',
	"expected_close_date" date,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."overtime_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"task_title" text NOT NULL,
	"time_spent" integer NOT NULL,
	"task_details" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"status" "drm"."overtime_status" DEFAULT 'Pending' NOT NULL,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drm"."policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policies_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "drm"."project_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"stage" text NOT NULL,
	"status" "drm"."project_approval_status" DEFAULT 'Pending' NOT NULL,
	"approver_user_id" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'Member' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_financials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"last_payment_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_financials_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."project_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "drm"."payment_method" DEFAULT 'BankTransfer' NOT NULL,
	"reference" text,
	"notes" text,
	"paid_by_user_id" varchar,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_user_id" varchar NOT NULL,
	"workspace" text,
	"status" "drm"."project_status" DEFAULT 'Active' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."queue_sales_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"sales_person_id" varchar NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" "drm"."queue_sales_status" DEFAULT 'Waiting' NOT NULL,
	"queue_number" integer,
	"estimated_time" integer,
	"notes" text,
	"assigned_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."refund_gm_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"person_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_type" text DEFAULT 'PKR' NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drm"."service_pool_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_code" text,
	"subservice_code" text,
	"service_person_id" uuid,
	"sales_person_id" uuid,
	"ta_person_id" uuid,
	"status" "drm"."service_pool_status" DEFAULT 'active' NOT NULL,
	"dropout_category" text,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_subservices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" varchar NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_subservices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."support_channel_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "drm"."support_channel" NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_channel_config_channel_unique" UNIQUE("channel")
);
--> statement-breakpoint
CREATE TABLE "drm"."support_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"from" "drm"."support_message_from" NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"channel" "drm"."support_channel" DEFAULT 'web' NOT NULL,
	"subject" text NOT NULL,
	"status" "drm"."support_ticket_status" DEFAULT 'Open' NOT NULL,
	"priority" "drm"."support_priority" DEFAULT 'Medium' NOT NULL,
	"assigned_to_user_id" varchar,
	"data_send" integer DEFAULT 0 NOT NULL,
	"external_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"type" "drm"."target_type" NOT NULL,
	"name" text NOT NULL,
	"bonus_type" text NOT NULL,
	"bonus_value" text NOT NULL,
	"price_target" text NOT NULL,
	"reward_text" text NOT NULL,
	"kwa_requirement" text,
	"vas_requirement" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_status_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"from_status" "drm"."task_status",
	"to_status" "drm"."task_status" NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "drm"."task_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"time" integer NOT NULL,
	"detail" text,
	"repeat_daily" integer DEFAULT 0 NOT NULL,
	"department" text,
	"created_by_user_id" varchar,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_time_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"time_spent_minutes" integer NOT NULL,
	"description" text,
	"log_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"participants" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" "drm"."task_category" DEFAULT 'Work' NOT NULL,
	"priority" "drm"."task_priority" DEFAULT 'Medium' NOT NULL,
	"status" "drm"."task_status" DEFAULT 'ToDo' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."team_performance_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"total_sales" numeric(12, 2) DEFAULT '0',
	"total_leads" integer DEFAULT 0,
	"converted_leads" integer DEFAULT 0,
	"activities_count" integer DEFAULT 0,
	"call_minutes" integer DEFAULT 0,
	"meetings_count" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"avg_deal_size" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."temp_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text,
	"person_name" text NOT NULL,
	"email" text NOT NULL,
	"mobile" text NOT NULL,
	"country" text,
	"drm_id" text,
	"source" text,
	"grade" text NOT NULL,
	"comment" text,
	"service_types" text[] DEFAULT '{}'::text[],
	"status" "drm"."temp_contact_status" DEFAULT 'Pending' NOT NULL,
	"promoted_to_customer_id" varchar,
	"promoted_at" timestamp,
	"promoted_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "temp_contacts_drm_id_unique" UNIQUE("drm_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."temp_gm_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"person_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_type" text DEFAULT 'PKR' NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."training_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "drm"."training_category" NOT NULL,
	"content_type" "drm"."training_content_type" DEFAULT 'video' NOT NULL,
	"content_url" text NOT NULL,
	"thumbnail_url" text,
	"estimated_minutes" integer DEFAULT 30,
	"order_index" integer DEFAULT 0,
	"quiz_json" text,
	"department" text,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."training_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"module_id" varchar NOT NULL,
	"is_completed" integer DEFAULT 0,
	"quiz_score" integer,
	"progress_percent" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."url_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"menu_icon" text,
	"allowed_role_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"sub_urls" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "url_permissions_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "drm"."user_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"department" text DEFAULT 'Sales' NOT NULL,
	"action_type" "drm"."user_activity_type" NOT NULL,
	"action_description" text,
	"reference_id" varchar,
	"reference_type" text,
	"amount" numeric(12, 2),
	"currency" text DEFAULT 'PKR',
	"company_name" text,
	"office" text,
	"activity_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"full_name" text,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"password_hash" text,
	"role_id" text,
	"role" text,
	"roles" text[],
	"branch" text DEFAULT 'Lahore Gulburg' NOT NULL,
	"country" text DEFAULT 'Pakistan' NOT NULL,
	"department" text,
	"designation" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "drm"."vas_progress_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"target_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."vas_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"customer_id" varchar,
	"report_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"title" text,
	"summary" text,
	"notes" text,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"value_sold" numeric(14, 2) DEFAULT '0' NOT NULL,
	"success_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"follow_ups_done" integer DEFAULT 0 NOT NULL,
	"missed_leads" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ADD CONSTRAINT "account_heads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."activities" ADD CONSTRAINT "activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."appointments" ADD CONSTRAINT "appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."business_customers" ADD CONSTRAINT "business_customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ADD CONSTRAINT "bv_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ADD CONSTRAINT "bv_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."cheques" ADD CONSTRAINT "cheques_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD CONSTRAINT "customers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ADD CONSTRAINT "followup_services_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ADD CONSTRAINT "followup_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "drm"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ADD CONSTRAINT "followup_subservices_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ADD CONSTRAINT "followup_subservices_subservice_id_service_subservices_id_fk" FOREIGN KEY ("subservice_id") REFERENCES "drm"."service_subservices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ADD CONSTRAINT "gm_pool_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ADD CONSTRAINT "gm_pool_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ADD CONSTRAINT "gm_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ADD CONSTRAINT "gm_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."impersonation_audit_logs" ADD CONSTRAINT "impersonation_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ADD CONSTRAINT "lead_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ADD CONSTRAINT "lead_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_services" ADD CONSTRAINT "lead_services_lead_id_customers_id_fk" FOREIGN KEY ("lead_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ADD CONSTRAINT "leave_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ADD CONSTRAINT "loan_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ADD CONSTRAINT "loan_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_manager_approved_by_user_id_users_id_fk" FOREIGN KEY ("manager_approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_hod_approved_by_user_id_users_id_fk" FOREIGN KEY ("hod_approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."office_expenses" ADD CONSTRAINT "office_expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."office_vas" ADD CONSTRAINT "office_vas_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ADD CONSTRAINT "overtime_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ADD CONSTRAINT "overtime_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_financials" ADD CONSTRAINT "project_financials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ADD CONSTRAINT "project_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ADD CONSTRAINT "project_payments_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ADD CONSTRAINT "queue_sales_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ADD CONSTRAINT "queue_sales_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."refund_gm_entries" ADD CONSTRAINT "refund_gm_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "drm"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "drm"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_service_person_id_users_id_fk" FOREIGN KEY ("service_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_ta_person_id_users_id_fk" FOREIGN KEY ("ta_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD CONSTRAINT "service_subservices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "drm"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "drm"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ADD CONSTRAINT "support_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ADD CONSTRAINT "task_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ADD CONSTRAINT "task_status_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ADD CONSTRAINT "task_status_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_templates" ADD CONSTRAINT "task_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_time_logs" ADD CONSTRAINT "task_time_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_time_logs" ADD CONSTRAINT "task_time_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."team_performance_snapshots" ADD CONSTRAINT "team_performance_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ADD CONSTRAINT "temp_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ADD CONSTRAINT "temp_contacts_promoted_to_customer_id_customers_id_fk" FOREIGN KEY ("promoted_to_customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ADD CONSTRAINT "temp_contacts_promoted_by_user_id_users_id_fk" FOREIGN KEY ("promoted_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."temp_gm_entries" ADD CONSTRAINT "temp_gm_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ADD CONSTRAINT "training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ADD CONSTRAINT "training_progress_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "drm"."training_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."vas_progress_snapshots" ADD CONSTRAINT "vas_progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ADD CONSTRAINT "vas_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ADD CONSTRAINT "vas_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;