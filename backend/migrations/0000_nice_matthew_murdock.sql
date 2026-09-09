CREATE SCHEMA "drm";
--> statement-breakpoint
CREATE TYPE "drm"."account_head_category" AS ENUM('Assets', 'Liabilities', 'OwnerEquity', 'Revenue', 'Expenses');--> statement-breakpoint
CREATE TYPE "drm"."activity_method" AS ENUM('mobile', 'whatsapp', 'onsite', 'email', 'seminar', 'webinar');--> statement-breakpoint
CREATE TYPE "drm"."attendance_status" AS ENUM('Present', 'Absent', 'Late', 'HalfDay', 'Leave');--> statement-breakpoint
CREATE TYPE "drm"."cheque_status" AS ENUM('Pending', 'Cleared', 'Bounced', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."communication_channel" AS ENUM('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VISIT', 'SMS', 'NOTE', 'OTHER');--> statement-breakpoint
CREATE TYPE "drm"."communication_outcome" AS ENUM('INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'NO_RESPONSE', 'CONVERTED', 'COMPLAINT', 'RENEWAL', 'RESOLVED', 'DROPOUT_RISK', 'OTHER');--> statement-breakpoint
CREATE TYPE "drm"."customer_status" AS ENUM('New', 'Renew', 'Expire');--> statement-breakpoint
CREATE TYPE "drm"."document_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "drm"."extension_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "drm"."followup_method" AS ENUM('Call', 'Email', 'WhatsApp', 'Visit');--> statement-breakpoint
CREATE TYPE "drm"."followup_outcome" AS ENUM('Interested', 'NotInterested', 'CallBack', 'NoAnswer', 'Converted', 'Lost');--> statement-breakpoint
CREATE TYPE "drm"."followup_status" AS ENUM('Open', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."gm_entry_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."gm_entry_type" AS ENUM('GM', 'TempGM', 'RefundGM');--> statement-breakpoint
CREATE TYPE "drm"."gm_pool_status" AS ENUM('Active', 'Pending', 'Inactive');--> statement-breakpoint
CREATE TYPE "drm"."invoice_status" AS ENUM('Draft', 'Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."leave_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."leave_type" AS ENUM('Sick', 'Casual', 'Annual', 'Emergency', 'HalfDay', 'Unpaid', 'Maternity', 'Paternity', 'Other');--> statement-breakpoint
CREATE TYPE "drm"."ledger_entry_type" AS ENUM('Credit', 'Debit');--> statement-breakpoint
CREATE TYPE "drm"."loan_status" AS ENUM('Pending', 'ManagerApproved', 'HODApproved', 'Rejected', 'Completed');--> statement-breakpoint
CREATE TYPE "drm"."meeting_person_type" AS ENUM('user', 'contact', 'external');--> statement-breakpoint
CREATE TYPE "drm"."meeting_status" AS ENUM('expected', 'in_progress', 'ended');--> statement-breakpoint
CREATE TYPE "drm"."notice_assignment_status" AS ENUM('created', 'assigned', 'unread', 'read');--> statement-breakpoint
CREATE TYPE "drm"."notice_status" AS ENUM('Active', 'Inactive', 'Archived');--> statement-breakpoint
CREATE TYPE "drm"."notification_read_status" AS ENUM('UNREAD', 'READ');--> statement-breakpoint
CREATE TYPE "drm"."notification_type" AS ENUM('INFO', 'WARNING', 'SUCCESS', 'ERROR');--> statement-breakpoint
CREATE TYPE "drm"."overtime_status" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."payment_method" AS ENUM('Cash', 'BankTransfer', 'CreditCard', 'Cheque', 'Online');--> statement-breakpoint
CREATE TYPE "drm"."pipeline_stage" AS ENUM('LD', 'QF', 'AY', 'IN', 'PM', 'GM', 'BV', 'NC', 'RC', 'EC', 'FW', 'NF');--> statement-breakpoint
CREATE TYPE "drm"."policy_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "drm"."policy_type" AS ENUM('text', 'numericRange');--> statement-breakpoint
CREATE TYPE "drm"."pool_type" AS ENUM('Private', 'Service', 'GMBV', 'Public');--> statement-breakpoint
CREATE TYPE "drm"."product_invoice_status" AS ENUM('PENDING_HOD', 'PENDING_ACCOUNT', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "drm"."project_approval_status" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."project_status" AS ENUM('Active', 'Completed', 'OnHold', 'READY_FOR_QA', 'IN_EXECUTION');--> statement-breakpoint
CREATE TYPE "drm"."queue_sales_status" AS ENUM('Waiting', 'InProgress', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "drm"."service_complaint_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "drm"."service_customer_status" AS ENUM('active', 'expiring', 'expired', 'renewed', 'upgraded', 'dropout', 'closed');--> statement-breakpoint
CREATE TYPE "drm"."service_dropout_status" AS ENUM('pending_recovery', 'recovered', 'closed');--> statement-breakpoint
CREATE TYPE "drm"."service_followup_status" AS ENUM('pending', 'completed', 'rescheduled', 'missed');--> statement-breakpoint
CREATE TYPE "drm"."service_pool_status" AS ENUM('active', 'dropout', 'completed', 'refund', 'temp', 'pending');--> statement-breakpoint
CREATE TYPE "drm"."service_renewal_type" AS ENUM('renewal', 'upgrade');--> statement-breakpoint
CREATE TYPE "drm"."support_channel" AS ENUM('whatsapp', 'web', 'email', 'phone');--> statement-breakpoint
CREATE TYPE "drm"."support_message_from" AS ENUM('customer', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "drm"."support_priority" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "drm"."support_ticket_status" AS ENUM('Open', 'InProgress', 'Resolved', 'Failed');--> statement-breakpoint
CREATE TYPE "drm"."target_type" AS ENUM('AB', 'VAS');--> statement-breakpoint
CREATE TYPE "drm"."task_category" AS ENUM('Work', 'Personal', 'Meeting', 'Announcement', 'Other');--> statement-breakpoint
CREATE TYPE "drm"."task_priority" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "drm"."task_status" AS ENUM('ToDo', 'InProgress', 'Blocked', 'Completed', 'READY_FOR_QA', 'IN_EXECUTION');--> statement-breakpoint
CREATE TYPE "drm"."temp_contact_status" AS ENUM('Pending', 'Promoted', 'Rejected');--> statement-breakpoint
CREATE TYPE "drm"."training_category" AS ENUM('DRM', 'SEO', 'Alibaba', 'SalesTools');--> statement-breakpoint
CREATE TYPE "drm"."training_content_type" AS ENUM('video', 'document', 'link');--> statement-breakpoint
CREATE TYPE "drm"."user_activity_type" AS ENUM('GM', 'Invoice', 'Refund', 'Donation', 'Expense', 'VAS', 'Cheque', 'Customer', 'Project', 'Task');--> statement-breakpoint
CREATE TABLE "drm"."account_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "drm"."account_head_category" NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"parent_account_id" uuid,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"normal_balance" text,
	"branch" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_heads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"customer_id" uuid,
	"type" text,
	"duration_minutes" integer,
	"activity_date" timestamp with time zone,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."allowed_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_cidr" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_ips_ip_cidr_unique" UNIQUE("ip_cidr")
);
--> statement-breakpoint
CREATE TABLE "drm"."appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assigned_to" uuid,
	"customer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"check_in" timestamp,
	"check_out" timestamp,
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
CREATE TABLE "drm"."attendance_edit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid,
	"user_id" uuid NOT NULL,
	"attendance_date" timestamp NOT NULL,
	"field" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"salary_locked" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."business_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."bv_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"assigned_to" uuid,
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
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejected_by" uuid,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."call_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"assigned_to" uuid,
	"followup_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cheque_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"company_name" text NOT NULL,
	"cheque_date" timestamp NOT NULL,
	"status" "drm"."cheque_status" DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."communication_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"customer_id" uuid,
	"lead_id" uuid,
	"user_id" uuid,
	"channel" "drm"."communication_channel" NOT NULL,
	"outcome" "drm"."communication_outcome",
	"notes" text,
	"next_action" text,
	"next_followup_at" timestamp,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"related_followup_id" text,
	"related_appointment_id" text,
	"message_template" text,
	"external_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."cross_department_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"source_module" text NOT NULL,
	"source_department" text,
	"target_module" text,
	"target_department" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" uuid,
	"target_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"notified_count" integer DEFAULT 0 NOT NULL,
	"audit_log_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cross_department_status_history_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "drm"."customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"title" text,
	"person_name" text,
	"account_holder_name" text NOT NULL,
	"cnic" text,
	"ntn" text,
	"email" text NOT NULL,
	"phone" text,
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
	"is_deleted" boolean DEFAULT false,
	"ab_type" text,
	"drm_id" text,
	"phone_normalized" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_drm_id_unique" UNIQUE("drm_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."diagnosis_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"company_name" text,
	"person_name" text,
	"diagnosis_type" text,
	"diagnosis_status" text DEFAULT 'OPEN' NOT NULL,
	"diagnosis_date" date NOT NULL,
	"assigned_to" uuid,
	"branch" text,
	"department" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "drm"."dollar_buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"paypal_email" text,
	"account_no" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."dollar_buying" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid,
	"buyer_name" text,
	"buyer_reference" text,
	"paypal_email" text,
	"account_no" text,
	"cheque_id" text,
	"payment_method" text,
	"type" text,
	"dollar_amount" numeric(12, 2) NOT NULL,
	"dollar_rate" numeric(12, 2) NOT NULL,
	"pkr_amount" numeric(12, 2) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"screenshot_url" text,
	"detail" text,
	"martini" text DEFAULT 'Show',
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "drm"."drm_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head" text NOT NULL,
	"type" text,
	"file_url" text,
	"penalty" numeric(10, 2),
	"min_allow" integer,
	"max_allow" integer,
	"description" text,
	"status" "drm"."policy_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."employee_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid,
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
	"followup_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "followup_services_followup_id_service_id_pk" PRIMARY KEY("followup_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."followup_subservices" (
	"followup_id" uuid NOT NULL,
	"subservice_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "followup_subservices_followup_id_subservice_id_pk" PRIMARY KEY("followup_id","subservice_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gm_type" "drm"."gm_entry_type" DEFAULT 'GM' NOT NULL,
	"drm_id" text NOT NULL,
	"member_id" text,
	"order_id" text,
	"company_name" text NOT NULL,
	"sales_person_id" uuid,
	"sales_person_name" text,
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
	"payment_status" text,
	"status" "drm"."gm_entry_status" DEFAULT 'Pending' NOT NULL,
	"is_loan" integer DEFAULT 0 NOT NULL,
	"is_partial_payment" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"notes" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"update_request_status" text,
	"update_requested_at" timestamp,
	"update_requested_by" uuid,
	"super_hod_status" text,
	"super_hod_actioned_by" uuid,
	"super_hod_actioned_at" timestamp,
	"withdrawal_status" text,
	"withdrawal_reason" text,
	"withdrawal_requested_at" timestamp,
	"withdrawal_requested_by" uuid,
	"withdrawal_actioned_by" uuid,
	"withdrawal_actioned_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_by_role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_loan_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gm_id" uuid NOT NULL,
	"loan_amount_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"company_copay_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"agreed_return_date" date,
	"admin_approval_status" text DEFAULT 'PENDING' NOT NULL,
	"admin_approved_by" uuid,
	"admin_approved_at" timestamp,
	"admin_comment" text,
	"return_status" text DEFAULT 'PENDING' NOT NULL,
	"returned_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gm_loan_terms_gm_id_unique" UNIQUE("gm_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_partial_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gm_id" uuid NOT NULL,
	"amount_usd" numeric(12, 2) NOT NULL,
	"amount_pkr" numeric(15, 2),
	"dollar_rate" numeric(12, 4),
	"receipt_date" timestamp DEFAULT now() NOT NULL,
	"method" text,
	"reference" text,
	"notes" text,
	"collected_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_pool_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"sales_person_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"target_role" varchar NOT NULL,
	"action" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."increment_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"calculated_by" uuid,
	"reviewed_by" uuid,
	"review_start_date" date NOT NULL,
	"review_end_date" date NOT NULL,
	"current_salary" numeric(12, 2),
	"per_day_salary" numeric(12, 2),
	"leave_days" numeric(8, 2),
	"allowed_leave_days" numeric(8, 2),
	"increment_leaves" numeric(8, 2),
	"leave_deduction_amount" numeric(12, 2),
	"total_minutes" integer,
	"relaxation_minutes" integer,
	"increment_minutes" integer,
	"total_tasks" integer,
	"pending_tasks" integer,
	"running_tasks" integer,
	"completed_tasks" integer,
	"notice_count" integer,
	"eligibility_status" text,
	"proposed_increment_type" text,
	"proposed_increment_value" numeric(12, 2),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"manager_remarks" text,
	"rejection_reason" text,
	"effective_date" date,
	"calculation_snapshot" jsonb,
	"missing_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "drm"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" uuid,
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
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"payment_method" varchar,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "drm"."it_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid,
	"person_name" text,
	"backup_type" text NOT NULL,
	"backup_url" text,
	"details" text,
	"backup_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."it_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"domain_name" text NOT NULL,
	"registry_id" uuid,
	"server_id" uuid,
	"hosting_package_id" uuid,
	"cpanel_username" text,
	"cpanel_password" text,
	"activation_date" timestamp,
	"expiry_date" timestamp,
	"ssl_expiry_date" timestamp,
	"hosting_expiry_date" timestamp,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "it_domains_domain_name_unique" UNIQUE("domain_name")
);
--> statement-breakpoint
CREATE TABLE "drm"."it_hosting_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"capacity" text,
	"price" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."it_registries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"credentials" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."it_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ip" text NOT NULL,
	"provider" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"notes" text,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."journal_voucher_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"account_head_id" uuid NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"narration" text,
	"line_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."journal_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_no" text NOT NULL,
	"voucher_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"remarks" text,
	"branch" text,
	"total_debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by_user_id" uuid,
	"posted_at" timestamp,
	"posted_by_user_id" uuid,
	"cancelled_at" timestamp,
	"cancelled_by_user_id" uuid,
	"cancel_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journal_vouchers_voucher_no_unique" UNIQUE("voucher_no")
);
--> statement-breakpoint
CREATE TABLE "drm"."lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"action" text NOT NULL,
	"performed_by" uuid NOT NULL,
	"note" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."lead_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"service_type" text NOT NULL,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"leave_type" "drm"."leave_type" NOT NULL,
	"alternative" text NOT NULL,
	"from_date" timestamp NOT NULL,
	"to_date" timestamp NOT NULL,
	"time" text,
	"description" text,
	"status" "drm"."leave_status" DEFAULT 'Pending' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_type" "drm"."ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"reference_id" uuid,
	"reference_type" text,
	"balance_after" numeric(12, 2),
	"entry_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"account_head_id" uuid,
	"status" text DEFAULT 'Posted' NOT NULL,
	"voucher_id" uuid,
	"voucher_line_id" uuid,
	"reversal_of_id" uuid,
	"branch" text,
	"remarks" text,
	"posted_at" timestamp,
	"posted_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."link_report_commission_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verified_by_user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"link_report_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_links" integer DEFAULT 0 NOT NULL,
	"reward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'VERIFIED' NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."link_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" serial NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"company_id" uuid,
	"company_name" text DEFAULT '' NOT NULL,
	"link_url" text NOT NULL,
	"source_module" text DEFAULT 'manual' NOT NULL,
	"source_record_id" uuid,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "drm"."loan_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"detail" text NOT NULL,
	"status" "drm"."loan_status" DEFAULT 'Pending' NOT NULL,
	"manager_approved_by_user_id" uuid,
	"manager_approved_at" timestamp,
	"hod_approved_by_user_id" uuid,
	"hod_approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"person_type" "drm"."meeting_person_type" DEFAULT 'contact' NOT NULL,
	"user_id" uuid,
	"contact_id" uuid,
	"person_name" text,
	"meeting_type" text NOT NULL,
	"meeting_date" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_time" text,
	"last_contact_time" text,
	"status" "drm"."meeting_status" DEFAULT 'expected' NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"total_duration_seconds" integer,
	"file_url" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."notice_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"read_status" "drm"."notice_assignment_status" DEFAULT 'unread' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "drm"."notice_status" DEFAULT 'Active' NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"assigned_to_role" text,
	"assigned_to_department" text,
	"assigned_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'INFO' NOT NULL,
	"read_status" text DEFAULT 'UNREAD' NOT NULL,
	"link" text,
	"target_url" text,
	"module" text,
	"entity_type" text,
	"entity_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."office_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_head" text NOT NULL,
	"office" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"voucher_number" text,
	"cheque_number" text,
	"file_url" text,
	"detail" text,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."office_vas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"method" text NOT NULL,
	"vas_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_title" text NOT NULL,
	"time_spent" integer NOT NULL,
	"task_details" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"status" "drm"."overtime_status" DEFAULT 'Pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."penalties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"department" text,
	"penalty_head" text NOT NULL,
	"reason" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"penalty_date" date NOT NULL,
	"created_by" uuid NOT NULL,
	"approval_status" text DEFAULT 'PENDING' NOT NULL,
	"attachment_url" text,
	"attachment_name" text,
	"manager_remarks" text,
	"hod_remarks" text,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejected_by" uuid,
	"rejected_at" timestamp,
	"employee_acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"voided_by" uuid,
	"voided_at" timestamp,
	"void_reason" text
);
--> statement-breakpoint
CREATE TABLE "drm"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drm"."policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policies_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "drm"."portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text,
	"main_category" text,
	"sub_category" text,
	"server_link" text,
	"top_header_image" text,
	"body_image" text,
	"full_image" text,
	"sliders" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_commission_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"min_value" integer DEFAULT 0 NOT NULL,
	"max_value" integer,
	"commission_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rate_type" text DEFAULT 'percentage' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"title" text,
	"keywords" text,
	"description" text,
	"main_image" text,
	"other_images" jsonb DEFAULT '[]'::jsonb,
	"platform" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"url" text NOT NULL,
	"label" text,
	"link_type" text DEFAULT 'output' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sales_exec_id" uuid NOT NULL,
	"customer_id" uuid,
	"project_name" text,
	"company_name" text,
	"status" text DEFAULT 'PENDING_HOD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"payment_method" varchar,
	"currency" text DEFAULT 'USD',
	"invoice_date" timestamp with time zone,
	"payment_terms" text,
	"service_type" text,
	"service_package" text,
	"source_module" text,
	"source_id" text,
	"receipt_reference" text,
	"paid_amount" numeric(12, 2),
	"paid_date" timestamp with time zone,
	"rejection_reason" text,
	"notes" text,
	"gm_id" text,
	"invoice_type" text,
	"auto_generated" boolean DEFAULT false,
	"generated_by" uuid,
	"generated_at" timestamp with time zone,
	"generation_event" text,
	"hod_approved_by" uuid,
	"hod_approved_at" timestamp with time zone,
	"accounts_approved_by" uuid,
	"accounts_approved_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_phase_definitions" (
	"phase_key" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"can_return" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_rework_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"from_phase" text,
	"to_phase" text NOT NULL,
	"action" text NOT NULL,
	"remarks" text,
	"actor_user_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."product_posting_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"current_phase" text DEFAULT 'PENDING_PROJECT' NOT NULL,
	"salesperson_uploaded_at" timestamp,
	"data_verified_at" timestamp,
	"assigned_at" timestamp,
	"assigned_duration_minutes" integer DEFAULT 0 NOT NULL,
	"execution_started_at" timestamp,
	"executive_submitted_at" timestamp,
	"manager_completed_at" timestamp,
	"qa_reviewed_at" timestamp,
	"verification_reviewed_at" timestamp,
	"manager_user_id" uuid,
	"executive_user_id" uuid,
	"qa_user_id" uuid,
	"verification_user_id" uuid,
	"overtime_requested_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_approved_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_reason" text,
	"output_notes" text,
	"qa_remarks" text,
	"verification_remarks" text,
	"return_count" integer DEFAULT 0 NOT NULL,
	"last_return_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_posting_workflows_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "product_posting_workflows_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."project_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" "drm"."project_approval_status" DEFAULT 'Pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"approver_user_id" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'Member' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"dependency_project_id" uuid,
	"gm_id" text,
	"dependency_type" text DEFAULT 'LISTING_PAGE_QA_APPROVAL' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"satisfied_at" timestamp with time zone,
	"satisfied_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"package_name" text,
	"minisite_url" text,
	"phone" text,
	"mobile" text,
	"address" text,
	"reference" text,
	"categories" text,
	"detail_notes" text,
	"evidence_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_url" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."project_financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "drm"."payment_method" DEFAULT 'BankTransfer' NOT NULL,
	"reference" text,
	"notes" text,
	"paid_by_user_id" uuid,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"owner_user_id" uuid NOT NULL,
	"workspace" text,
	"department_type" text,
	"gm_id" text,
	"service_type" text,
	"invoice_type" text,
	"project_type" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."queue_sales_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"sales_person_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"person_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_type" text DEFAULT 'PKR' NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."restricted_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "restricted_keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE "drm"."role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drm"."salary_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_name" text,
	"department" text,
	"branch" text,
	"gross_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"per_day_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"days_present" integer DEFAULT 0 NOT NULL,
	"days_absent" integer DEFAULT 0 NOT NULL,
	"absence_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"overtime_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"basic_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"leave_days" integer DEFAULT 0 NOT NULL,
	"unpaid_leave_days" integer DEFAULT 0 NOT NULL,
	"unpaid_leave_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"late_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"penalty_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"loan_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"bonus_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"allowance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payable_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"paid_by_user_id" uuid,
	"paid_at" timestamp,
	"remarks" text,
	"calculation_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."salary_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"branch" text,
	"department" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"employee_count" integer DEFAULT 0 NOT NULL,
	"total_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"generated_by" uuid,
	"generated_at" timestamp,
	"finalized_by" uuid,
	"finalized_at" timestamp,
	"remarks" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_customer_id" uuid,
	"company_id" uuid,
	"method" text NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"target_value" numeric(10, 2),
	"achieved_value" numeric(10, 2),
	"remarks" text,
	"activity_date" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_customer_id" uuid NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assigned_to" uuid,
	"status" "drm"."service_complaint_status" DEFAULT 'open' NOT NULL,
	"remarks" text,
	"resolved_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"status_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"customer_id" uuid NOT NULL,
	"company_id" uuid,
	"package_id" uuid,
	"service_start_date" timestamp,
	"expiry_date" timestamp,
	"status" "drm"."service_customer_status" DEFAULT 'active' NOT NULL,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"status_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_dropouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_customer_id" uuid NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"reason" text NOT NULL,
	"status" "drm"."service_dropout_status" DEFAULT 'pending_recovery' NOT NULL,
	"recovery_note" text,
	"recovered_at" timestamp,
	"closed_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"status_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_customer_id" uuid NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"assigned_to" uuid,
	"method" text NOT NULL,
	"purpose" text,
	"status" "drm"."service_followup_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"next_followup_date" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"status_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "drm"."service_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_customer_id" uuid NOT NULL,
	"old_package_id" uuid,
	"new_package_id" uuid,
	"old_gm_record_id" uuid,
	"new_gm_record_id" uuid,
	"renewal_type" "drm"."service_renewal_type" DEFAULT 'renewal' NOT NULL,
	"old_expiry_date" timestamp,
	"new_start_date" timestamp,
	"new_expiry_date" timestamp,
	"amount" numeric(12, 2),
	"status" text DEFAULT 'completed' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_subservices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_subservices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."service_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drm"."social_media_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"social_account_id" uuid,
	"title" text,
	"content" text NOT NULL,
	"media_url" text,
	"media_name" text,
	"linked_customer_id" uuid,
	"linked_project_id" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"approval_status" text DEFAULT 'DRAFT' NOT NULL,
	"publishing_status" text DEFAULT 'DRAFT' NOT NULL,
	"failure_reason" text,
	"rejection_reason" text,
	"cancel_reason" text,
	"external_ref" text,
	"created_by" uuid,
	"approved_by" uuid,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drm"."software_commission_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"min_value" integer DEFAULT 0 NOT NULL,
	"max_value" integer,
	"commission_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rate_type" text DEFAULT 'percentage' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."software_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"url" text NOT NULL,
	"label" text,
	"link_type" text DEFAULT 'output' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."software_phase_definitions" (
	"phase_key" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"can_return" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."software_rework_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"from_phase" text,
	"to_phase" text NOT NULL,
	"action" text NOT NULL,
	"remarks" text,
	"actor_user_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."software_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"current_phase" text DEFAULT 'PENDING_PROJECT' NOT NULL,
	"salesperson_uploaded_at" timestamp,
	"data_verified_at" timestamp,
	"assigned_at" timestamp,
	"assigned_duration_minutes" integer DEFAULT 0 NOT NULL,
	"execution_started_at" timestamp,
	"executive_submitted_at" timestamp,
	"manager_completed_at" timestamp,
	"qa_reviewed_at" timestamp,
	"verification_reviewed_at" timestamp,
	"manager_user_id" uuid,
	"executive_user_id" uuid,
	"qa_user_id" uuid,
	"verification_user_id" uuid,
	"overtime_requested_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_approved_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_reason" text,
	"output_notes" text,
	"qa_remarks" text,
	"verification_remarks" text,
	"return_count" integer DEFAULT 0 NOT NULL,
	"last_return_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "software_workflows_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "software_workflows_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."support_channel_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "drm"."support_channel" NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_channel_config_channel_unique" UNIQUE("channel")
);
--> statement-breakpoint
CREATE TABLE "drm"."support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from" "drm"."support_message_from" NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"channel" "drm"."support_channel" DEFAULT 'web' NOT NULL,
	"subject" text NOT NULL,
	"status" "drm"."support_ticket_status" DEFAULT 'Open' NOT NULL,
	"priority" "drm"."support_priority" DEFAULT 'Medium' NOT NULL,
	"assigned_to_user_id" uuid,
	"data_send" integer DEFAULT 0 NOT NULL,
	"external_reference" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."target_system_daily_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"method" text NOT NULL,
	"target" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."target_system_kwa_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"employee" text NOT NULL,
	"kwa" numeric(12, 2) DEFAULT '0' NOT NULL,
	"detail" text,
	"remaining" numeric(12, 2) DEFAULT '0' NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."target_system_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_name" text NOT NULL,
	"package" text,
	"reward" integer DEFAULT 0 NOT NULL,
	"bonus" text,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"penalty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" text,
	"number" integer DEFAULT 0 NOT NULL,
	"kwa" integer DEFAULT 0 NOT NULL,
	"vas" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."target_system_user_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_name" text NOT NULL,
	"category" text NOT NULL,
	"target" text DEFAULT '0' NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"bonus" text,
	"vas" numeric(12, 2) DEFAULT '0' NOT NULL,
	"kwa" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"sign_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"links_posted" integer DEFAULT 0 NOT NULL,
	"total_duration_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_results_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."task_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_status" "drm"."task_status",
	"to_status" "drm"."task_status" NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "drm"."task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"time" integer NOT NULL,
	"detail" text,
	"repeat_daily" integer DEFAULT 0 NOT NULL,
	"department" text,
	"created_by_user_id" uuid,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_time_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"requested_time_minutes" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."task_time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"participants" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" "drm"."task_category" DEFAULT 'Work' NOT NULL,
	"priority" "drm"."task_priority" DEFAULT 'Medium' NOT NULL,
	"status" "drm"."task_status" DEFAULT 'ToDo' NOT NULL,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"timer_started_at" timestamp with time zone,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."team_performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
	"promoted_to_customer_id" uuid,
	"promoted_at" timestamp,
	"promoted_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "temp_contacts_drm_id_unique" UNIQUE("drm_id")
);
--> statement-breakpoint
CREATE TABLE "drm"."temp_gm_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"person_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_type" text DEFAULT 'PKR' NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."training_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"department" text DEFAULT 'Sales' NOT NULL,
	"action_type" "drm"."user_activity_type" NOT NULL,
	"action_description" text,
	"reference_id" uuid,
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
	"password" text,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"target_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."vas_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
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
CREATE TABLE "drm"."workflow_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text,
	"next_status" text NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"reason" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audit_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ADD CONSTRAINT "account_heads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."activities" ADD CONSTRAINT "activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."activities" ADD CONSTRAINT "activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."appointments" ADD CONSTRAINT "appointments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "drm"."attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."business_customers" ADD CONSTRAINT "business_customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ADD CONSTRAINT "bv_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ADD CONSTRAINT "bv_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ADD CONSTRAINT "bv_reports_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ADD CONSTRAINT "call_sessions_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."cheques" ADD CONSTRAINT "cheques_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."cross_department_status_history" ADD CONSTRAINT "cross_department_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD CONSTRAINT "customers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."diagnosis_reports" ADD CONSTRAINT "diagnosis_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."diagnosis_reports" ADD CONSTRAINT "diagnosis_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."diagnosis_reports" ADD CONSTRAINT "diagnosis_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ADD CONSTRAINT "dollar_buying_buyer_id_dollar_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "drm"."dollar_buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ADD CONSTRAINT "dollar_buying_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."drm_policies" ADD CONSTRAINT "drm_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."employee_bonuses" ADD CONSTRAINT "employee_bonuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."employee_bonuses" ADD CONSTRAINT "employee_bonuses_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."employee_bonuses" ADD CONSTRAINT "employee_bonuses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD CONSTRAINT "follow_ups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ADD CONSTRAINT "followup_services_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ADD CONSTRAINT "followup_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "drm"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ADD CONSTRAINT "followup_subservices_followup_id_follow_ups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "drm"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ADD CONSTRAINT "followup_subservices_subservice_id_service_subservices_id_fk" FOREIGN KEY ("subservice_id") REFERENCES "drm"."service_subservices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_update_requested_by_users_id_fk" FOREIGN KEY ("update_requested_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_super_hod_actioned_by_users_id_fk" FOREIGN KEY ("super_hod_actioned_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_withdrawal_requested_by_users_id_fk" FOREIGN KEY ("withdrawal_requested_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_withdrawal_actioned_by_users_id_fk" FOREIGN KEY ("withdrawal_actioned_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD CONSTRAINT "gm_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_loan_terms" ADD CONSTRAINT "gm_loan_terms_admin_approved_by_users_id_fk" FOREIGN KEY ("admin_approved_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_loan_terms" ADD CONSTRAINT "gm_loan_terms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_partial_receipts" ADD CONSTRAINT "gm_partial_receipts_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ADD CONSTRAINT "gm_pool_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ADD CONSTRAINT "gm_pool_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ADD CONSTRAINT "gm_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ADD CONSTRAINT "gm_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."impersonation_audit_logs" ADD CONSTRAINT "impersonation_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."increment_evaluations" ADD CONSTRAINT "increment_evaluations_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."increment_evaluations" ADD CONSTRAINT "increment_evaluations_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."increment_evaluations" ADD CONSTRAINT "increment_evaluations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."it_backups" ADD CONSTRAINT "it_backups_domain_id_it_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "drm"."it_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."it_domains" ADD CONSTRAINT "it_domains_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."it_domains" ADD CONSTRAINT "it_domains_registry_id_it_registries_id_fk" FOREIGN KEY ("registry_id") REFERENCES "drm"."it_registries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."it_domains" ADD CONSTRAINT "it_domains_server_id_it_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "drm"."it_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."it_domains" ADD CONSTRAINT "it_domains_hosting_package_id_it_hosting_packages_id_fk" FOREIGN KEY ("hosting_package_id") REFERENCES "drm"."it_hosting_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ADD CONSTRAINT "lead_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ADD CONSTRAINT "lead_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."lead_services" ADD CONSTRAINT "lead_services_lead_id_customers_id_fk" FOREIGN KEY ("lead_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ADD CONSTRAINT "leave_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."link_report_commission_verifications" ADD CONSTRAINT "link_report_commission_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."link_report_commission_verifications" ADD CONSTRAINT "link_report_commission_verifications_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."link_reports" ADD CONSTRAINT "link_reports_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ADD CONSTRAINT "loan_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ADD CONSTRAINT "loan_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_manager_approved_by_user_id_users_id_fk" FOREIGN KEY ("manager_approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ADD CONSTRAINT "loan_requests_hod_approved_by_user_id_users_id_fk" FOREIGN KEY ("hod_approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."meetings" ADD CONSTRAINT "meetings_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."meetings" ADD CONSTRAINT "meetings_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "drm"."customer_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."meetings" ADD CONSTRAINT "meetings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notice_assignments" ADD CONSTRAINT "notice_assignments_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "drm"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notice_assignments" ADD CONSTRAINT "notice_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notice_assignments" ADD CONSTRAINT "notice_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notices" ADD CONSTRAINT "notices_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."office_expenses" ADD CONSTRAINT "office_expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."office_vas" ADD CONSTRAINT "office_vas_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ADD CONSTRAINT "overtime_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ADD CONSTRAINT "overtime_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."penalties" ADD CONSTRAINT "penalties_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."penalties" ADD CONSTRAINT "penalties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."penalties" ADD CONSTRAINT "penalties_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."penalties" ADD CONSTRAINT "penalties_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."penalties" ADD CONSTRAINT "penalties_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_data" ADD CONSTRAINT "product_posting_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_evidence_links" ADD CONSTRAINT "product_posting_evidence_links_workflow_id_product_posting_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "drm"."product_posting_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_evidence_links" ADD CONSTRAINT "product_posting_evidence_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_evidence_links" ADD CONSTRAINT "product_posting_evidence_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_evidence_links" ADD CONSTRAINT "product_posting_evidence_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_invoices" ADD CONSTRAINT "product_posting_invoices_sales_exec_id_users_id_fk" FOREIGN KEY ("sales_exec_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_invoices" ADD CONSTRAINT "product_posting_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_rework_history" ADD CONSTRAINT "product_posting_rework_history_workflow_id_product_posting_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "drm"."product_posting_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_rework_history" ADD CONSTRAINT "product_posting_rework_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_executive_user_id_users_id_fk" FOREIGN KEY ("executive_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_qa_user_id_users_id_fk" FOREIGN KEY ("qa_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD CONSTRAINT "product_posting_workflows_verification_user_id_users_id_fk" FOREIGN KEY ("verification_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ADD CONSTRAINT "project_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_dependencies" ADD CONSTRAINT "project_dependencies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_dependencies" ADD CONSTRAINT "project_dependencies_dependency_project_id_projects_id_fk" FOREIGN KEY ("dependency_project_id") REFERENCES "drm"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_dependencies" ADD CONSTRAINT "project_dependencies_satisfied_by_users_id_fk" FOREIGN KEY ("satisfied_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_details" ADD CONSTRAINT "project_details_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_documents" ADD CONSTRAINT "project_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_financials" ADD CONSTRAINT "project_financials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ADD CONSTRAINT "project_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ADD CONSTRAINT "project_payments_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD CONSTRAINT "projects_invoice_id_product_posting_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "drm"."product_posting_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ADD CONSTRAINT "queue_sales_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ADD CONSTRAINT "queue_sales_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."refund_gm_entries" ADD CONSTRAINT "refund_gm_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "drm"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "drm"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_run_items" ADD CONSTRAINT "salary_run_items_run_id_salary_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "drm"."salary_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_run_items" ADD CONSTRAINT "salary_run_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_run_items" ADD CONSTRAINT "salary_run_items_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_runs" ADD CONSTRAINT "salary_runs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_runs" ADD CONSTRAINT "salary_runs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_runs" ADD CONSTRAINT "salary_runs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."salary_runs" ADD CONSTRAINT "salary_runs_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_activities" ADD CONSTRAINT "service_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_activities" ADD CONSTRAINT "service_activities_service_customer_id_service_customers_id_fk" FOREIGN KEY ("service_customer_id") REFERENCES "drm"."service_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_activities" ADD CONSTRAINT "service_activities_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_activities" ADD CONSTRAINT "service_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_activities" ADD CONSTRAINT "service_activities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_service_customer_id_service_customers_id_fk" FOREIGN KEY ("service_customer_id") REFERENCES "drm"."service_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_complaints" ADD CONSTRAINT "service_complaints_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_package_id_services_id_fk" FOREIGN KEY ("package_id") REFERENCES "drm"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ADD CONSTRAINT "service_customers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_dropouts" ADD CONSTRAINT "service_dropouts_service_customer_id_service_customers_id_fk" FOREIGN KEY ("service_customer_id") REFERENCES "drm"."service_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_dropouts" ADD CONSTRAINT "service_dropouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_dropouts" ADD CONSTRAINT "service_dropouts_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_dropouts" ADD CONSTRAINT "service_dropouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_dropouts" ADD CONSTRAINT "service_dropouts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_service_customer_id_service_customers_id_fk" FOREIGN KEY ("service_customer_id") REFERENCES "drm"."service_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_company_id_customers_id_fk" FOREIGN KEY ("company_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_followups" ADD CONSTRAINT "service_followups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_service_person_id_users_id_fk" FOREIGN KEY ("service_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_pool_entries" ADD CONSTRAINT "service_pool_entries_ta_person_id_users_id_fk" FOREIGN KEY ("ta_person_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_service_customer_id_service_customers_id_fk" FOREIGN KEY ("service_customer_id") REFERENCES "drm"."service_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_old_package_id_services_id_fk" FOREIGN KEY ("old_package_id") REFERENCES "drm"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_new_package_id_services_id_fk" FOREIGN KEY ("new_package_id") REFERENCES "drm"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_old_gm_record_id_gm_entries_id_fk" FOREIGN KEY ("old_gm_record_id") REFERENCES "drm"."gm_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_new_gm_record_id_gm_entries_id_fk" FOREIGN KEY ("new_gm_record_id") REFERENCES "drm"."gm_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ADD CONSTRAINT "service_renewals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD CONSTRAINT "service_subservices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "drm"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_targets" ADD CONSTRAINT "service_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_targets" ADD CONSTRAINT "service_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_targets" ADD CONSTRAINT "service_targets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_evidence_links" ADD CONSTRAINT "software_evidence_links_workflow_id_software_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "drm"."software_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_evidence_links" ADD CONSTRAINT "software_evidence_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_evidence_links" ADD CONSTRAINT "software_evidence_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_evidence_links" ADD CONSTRAINT "software_evidence_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_rework_history" ADD CONSTRAINT "software_rework_history_workflow_id_software_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "drm"."software_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_rework_history" ADD CONSTRAINT "software_rework_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "drm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_executive_user_id_users_id_fk" FOREIGN KEY ("executive_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_qa_user_id_users_id_fk" FOREIGN KEY ("qa_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."software_workflows" ADD CONSTRAINT "software_workflows_verification_user_id_users_id_fk" FOREIGN KEY ("verification_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "drm"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ADD CONSTRAINT "support_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ADD CONSTRAINT "task_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_results" ADD CONSTRAINT "task_results_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ADD CONSTRAINT "task_status_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ADD CONSTRAINT "task_status_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_templates" ADD CONSTRAINT "task_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."task_time_extensions" ADD CONSTRAINT "task_time_extensions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "drm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "drm"."vas_reports" ADD CONSTRAINT "vas_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_att_edit_user" ON "drm"."attendance_edit_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_att_edit_status" ON "drm"."attendance_edit_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_comm_logs_entity" ON "drm"."communication_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_comm_logs_customer" ON "drm"."communication_logs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_comm_logs_user" ON "drm"."communication_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_comm_logs_followup_due" ON "drm"."communication_logs" USING btree ("next_followup_at","status");--> statement-breakpoint
CREATE INDEX "idx_cross_dept_status_entity" ON "drm"."cross_department_status_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_cross_dept_status_created" ON "drm"."cross_department_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_diagnosis_reports_assigned" ON "drm"."diagnosis_reports" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_diagnosis_reports_date" ON "drm"."diagnosis_reports" USING btree ("diagnosis_date");--> statement-breakpoint
CREATE INDEX "idx_diagnosis_reports_status" ON "drm"."diagnosis_reports" USING btree ("diagnosis_status");--> statement-breakpoint
CREATE INDEX "idx_employee_bonuses_user" ON "drm"."employee_bonuses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_employee_bonuses_period" ON "drm"."employee_bonuses" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_employee_bonuses_status" ON "drm"."employee_bonuses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gm_loan_terms_admin_status" ON "drm"."gm_loan_terms" USING btree ("admin_approval_status");--> statement-breakpoint
CREATE INDEX "idx_gm_loan_terms_return_status" ON "drm"."gm_loan_terms" USING btree ("return_status");--> statement-breakpoint
CREATE INDEX "idx_gm_loan_terms_return_date" ON "drm"."gm_loan_terms" USING btree ("agreed_return_date");--> statement-breakpoint
CREATE INDEX "idx_gm_partial_receipts_gm" ON "drm"."gm_partial_receipts" USING btree ("gm_id");--> statement-breakpoint
CREATE INDEX "idx_gm_partial_receipts_date" ON "drm"."gm_partial_receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "idx_gm_partial_receipts_collected_by" ON "drm"."gm_partial_receipts" USING btree ("collected_by");--> statement-breakpoint
CREATE INDEX "idx_increment_eval_employee" ON "drm"."increment_evaluations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_increment_eval_review_dates" ON "drm"."increment_evaluations" USING btree ("review_start_date","review_end_date");--> statement-breakpoint
CREATE INDEX "idx_increment_eval_status" ON "drm"."increment_evaluations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_increment_eval_effective" ON "drm"."increment_evaluations" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_lrcv_user" ON "drm"."link_report_commission_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lrcv_verified_by" ON "drm"."link_report_commission_verifications" USING btree ("verified_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_lrcv_start_date" ON "drm"."link_report_commission_verifications" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_lrcv_end_date" ON "drm"."link_report_commission_verifications" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "idx_link_reports_submitted_by" ON "drm"."link_reports" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_link_reports_submitted_at" ON "drm"."link_reports" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "idx_link_reports_deleted_at" ON "drm"."link_reports" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_status" ON "drm"."meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_date" ON "drm"."meetings" USING btree ("meeting_date");--> statement-breakpoint
CREATE INDEX "idx_meeting_company" ON "drm"."meetings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_penalties_employee" ON "drm"."penalties" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_penalties_created_by" ON "drm"."penalties" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_penalties_date" ON "drm"."penalties" USING btree ("penalty_date");--> statement-breakpoint
CREATE INDEX "idx_penalties_status" ON "drm"."penalties" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_penalties_department" ON "drm"."penalties" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_penalties_deleted_at" ON "drm"."penalties" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_penalties_lifecycle_status" ON "drm"."penalties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_salary_run_items_run" ON "drm"."salary_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_salary_run_items_user" ON "drm"."salary_run_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_salary_run_items_run_user" ON "drm"."salary_run_items" USING btree ("run_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_salary_run_items_payment_status" ON "drm"."salary_run_items" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_salary_runs_period" ON "drm"."salary_runs" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_salary_runs_status" ON "drm"."salary_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_salary_runs_generated_by" ON "drm"."salary_runs" USING btree ("generated_by");--> statement-breakpoint
CREATE INDEX "idx_salary_runs_deleted_at" ON "drm"."salary_runs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_service_activities_user_id" ON "drm"."service_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_service_activities_activity_date" ON "drm"."service_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "idx_service_complaints_status" ON "drm"."service_complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_customers_status" ON "drm"."service_customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_customers_assigned_to" ON "drm"."service_customers" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_service_customers_expiry_date" ON "drm"."service_customers" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_service_dropouts_status" ON "drm"."service_dropouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_followups_next_followup_date" ON "drm"."service_followups" USING btree ("next_followup_date");--> statement-breakpoint
CREATE INDEX "idx_workflow_status_hist_entity" ON "drm"."workflow_status_history" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_status_hist_actor" ON "drm"."workflow_status_history" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_status_hist_action" ON "drm"."workflow_status_history" USING btree ("action","created_at");