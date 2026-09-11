CREATE TABLE "drm"."ab_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ab_id" text,
	"order_id" text,
	"gm_drm_id" text,
	"gm_entry_id" uuid,
	"company_name" text,
	"amount_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_pkr" numeric(15, 2) DEFAULT '0' NOT NULL,
	"rate" numeric(12, 4),
	"proof_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_date" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"deletion_reason" text
);
--> statement-breakpoint
CREATE TABLE "drm"."assignment_ratio_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'product_posting_workflow_routing' NOT NULL,
	"previous_ratio" text NOT NULL,
	"new_ratio" text NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_by_user_id" uuid,
	"disabled_reason" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_commission_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_record_id" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"reason" text NOT NULL,
	"source_event" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_commission_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text DEFAULT 'GM_ENTRY' NOT NULL,
	"source_record_id" varchar NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"beneficiary_role" text,
	"commission_slab_id" uuid,
	"commission_basis_field" text NOT NULL,
	"commission_basis_amount" numeric(15, 2) NOT NULL,
	"commission_rate" numeric(10, 2) NOT NULL,
	"base_commission" numeric(15, 2) NOT NULL,
	"accrual_date" timestamp with time zone NOT NULL,
	"payable_date" timestamp with time zone NOT NULL,
	"quarter_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."gm_commission_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"min_value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"max_value" numeric(15, 2),
	"commission_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rate_type" text DEFAULT 'percentage' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_time" timestamp DEFAULT now() NOT NULL,
	"locked_timestamp" timestamp,
	"locked_worker" text,
	"processed_timestamp" timestamp,
	"last_error" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "drm"."portfolio_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"customer_id" uuid,
	"company_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"reserved_by_user_id" uuid NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_reason" text,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"last_extended_at" timestamp with time zone,
	"last_extended_by_user_id" uuid,
	"last_extension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_customer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"rating" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."service_sample_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"product_name" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drm"."social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_name" text,
	"platform" text NOT NULL,
	"account_name" text,
	"url" text,
	"customer_id" uuid,
	"project_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ALTER COLUMN "parent_account_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."account_heads" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."activity_logs" ALTER COLUMN "resource_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."allowed_ips" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."allowed_ips" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."attendance" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."attendance" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."attendance" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."attendance_edit_requests" ALTER COLUMN "attendance_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."business_customers" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."business_customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."business_customers" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "assigned_to" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "approved_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."bv_reports" ALTER COLUMN "rejected_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "assigned_to" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."call_sessions" ALTER COLUMN "followup_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."cheques" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."cheques" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."cheques" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buyers" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buyers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ALTER COLUMN "buyer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."dollar_buying" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."donations" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."donations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ALTER COLUMN "assigned_to" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ALTER COLUMN "created_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ALTER COLUMN "followup_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."followup_services" ALTER COLUMN "service_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ALTER COLUMN "followup_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."followup_subservices" ALTER COLUMN "subservice_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ALTER COLUMN "sales_person_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ALTER COLUMN "approved_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ALTER COLUMN "created_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_loan_terms" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_loan_terms" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."gm_loan_terms" ALTER COLUMN "gm_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_partial_receipts" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_partial_receipts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."gm_partial_receipts" ALTER COLUMN "gm_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "member_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "order_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_pool_entries" ALTER COLUMN "sales_person_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."gm_reports" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."impersonation_audit_logs" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."impersonation_audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."impersonation_audit_logs" ALTER COLUMN "admin_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."invoices" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_voucher_lines" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_voucher_lines" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."journal_voucher_lines" ALTER COLUMN "voucher_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_voucher_lines" ALTER COLUMN "account_head_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_vouchers" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_vouchers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."journal_vouchers" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_vouchers" ALTER COLUMN "posted_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."journal_vouchers" ALTER COLUMN "cancelled_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."lead_activities" ALTER COLUMN "performed_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."lead_services" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."lead_services" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."lead_services" ALTER COLUMN "lead_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."leave_requests" ALTER COLUMN "approved_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "reference_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "account_head_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "voucher_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "voucher_line_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "reversal_of_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."ledger_entries" ALTER COLUMN "posted_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_reports" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ALTER COLUMN "manager_approved_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."loan_requests" ALTER COLUMN "hod_approved_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."office_expenses" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."office_expenses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."office_expenses" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."office_vas" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."office_vas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."office_vas" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."opportunities" ALTER COLUMN "owner_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."overtime_records" ALTER COLUMN "reviewed_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."password_reset_tokens" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."password_reset_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."permissions" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."permissions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."policies" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."policies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ALTER COLUMN "project_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_approvals" ALTER COLUMN "approver_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ALTER COLUMN "project_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_assignments" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_financials" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_financials" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."project_financials" ALTER COLUMN "project_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ALTER COLUMN "project_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."project_payments" ALTER COLUMN "paid_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."queue_sales_entries" ALTER COLUMN "sales_person_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."refund_gm_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."refund_gm_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."refund_gm_entries" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ALTER COLUMN "role_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."role_permissions" ALTER COLUMN "permission_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."roles" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."service_customers" ALTER COLUMN "package_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ALTER COLUMN "old_package_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."service_renewals" ALTER COLUMN "new_package_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ALTER COLUMN "service_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."services" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."services" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."support_channel_config" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."support_channel_config" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."support_messages" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."support_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."support_messages" ALTER COLUMN "ticket_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ALTER COLUMN "assigned_to_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."target_system_targets" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."target_system_targets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."targets" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."targets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."targets" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ALTER COLUMN "task_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_comments" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ALTER COLUMN "task_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_status_history" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_templates" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."task_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."task_templates" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."team_performance_snapshots" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."team_performance_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."team_performance_snapshots" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ALTER COLUMN "promoted_to_customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_contacts" ALTER COLUMN "promoted_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_gm_entries" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."temp_gm_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."temp_gm_entries" ALTER COLUMN "created_by_user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."training_modules" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."training_modules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."training_progress" ALTER COLUMN "module_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."url_permissions" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."url_permissions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."user_activities" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."user_activities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."user_activities" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."user_activities" ALTER COLUMN "reference_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."vas_progress_snapshots" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."vas_progress_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."vas_progress_snapshots" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."vas_reports" ALTER COLUMN "customer_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD COLUMN "is_focus" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD COLUMN "emails" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "drm"."customers" ADD COLUMN "mobiles" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD COLUMN "manager_comment" text;--> statement-breakpoint
ALTER TABLE "drm"."follow_ups" ADD COLUMN "sm_comment" text;--> statement-breakpoint
ALTER TABLE "drm"."gm_entries" ADD COLUMN "canonical_gm_type" text;--> statement-breakpoint
ALTER TABLE "drm"."invoices" ADD COLUMN "dollar_rate" numeric(12, 2) DEFAULT '280' NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_commission_slabs" ADD COLUMN "area" text DEFAULT 'posting_executive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_commission_slabs" ADD COLUMN "effective_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_commission_slabs" ADD COLUMN "effective_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_commission_slabs" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_invoices" ADD COLUMN "invoice_number" text DEFAULT nextval('drm.product_posting_invoice_number_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD COLUMN "self_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_workflows" ADD COLUMN "project_level" text;--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD COLUMN "project_number" text DEFAULT nextval('drm.project_number_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD COLUMN "price" numeric;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD COLUMN "discount" numeric;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD COLUMN "min_day" integer;--> statement-breakpoint
ALTER TABLE "drm"."service_subservices" ADD COLUMN "max_day" integer;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "price" numeric;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "discount" numeric;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "min_day" integer;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "max_day" integer;--> statement-breakpoint
ALTER TABLE "drm"."social_media_posts" ADD COLUMN "likes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."social_media_posts" ADD COLUMN "comments" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."social_media_posts" ADD COLUMN "shares" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."support_tickets" ADD COLUMN "created_by" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."ab_payments" ADD CONSTRAINT "ab_payments_gm_entry_id_gm_entries_id_fk" FOREIGN KEY ("gm_entry_id") REFERENCES "drm"."gm_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."ab_payments" ADD CONSTRAINT "ab_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."ab_payments" ADD CONSTRAINT "ab_payments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."assignment_ratio_overrides" ADD CONSTRAINT "assignment_ratio_overrides_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."assignment_ratio_overrides" ADD CONSTRAINT "assignment_ratio_overrides_disabled_by_user_id_users_id_fk" FOREIGN KEY ("disabled_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."assignment_ratio_overrides" ADD CONSTRAINT "assignment_ratio_overrides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_adjustments" ADD CONSTRAINT "gm_commission_adjustments_commission_record_id_gm_commission_records_id_fk" FOREIGN KEY ("commission_record_id") REFERENCES "drm"."gm_commission_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_adjustments" ADD CONSTRAINT "gm_commission_adjustments_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_records" ADD CONSTRAINT "gm_commission_records_source_record_id_gm_entries_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "drm"."gm_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_records" ADD CONSTRAINT "gm_commission_records_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_records" ADD CONSTRAINT "gm_commission_records_commission_slab_id_gm_commission_slabs_id_fk" FOREIGN KEY ("commission_slab_id") REFERENCES "drm"."gm_commission_slabs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."gm_commission_slabs" ADD CONSTRAINT "gm_commission_slabs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."portfolio_reservations" ADD CONSTRAINT "portfolio_reservations_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "drm"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."portfolio_reservations" ADD CONSTRAINT "portfolio_reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."portfolio_reservations" ADD CONSTRAINT "portfolio_reservations_reserved_by_user_id_users_id_fk" FOREIGN KEY ("reserved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."portfolio_reservations" ADD CONSTRAINT "portfolio_reservations_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."portfolio_reservations" ADD CONSTRAINT "portfolio_reservations_last_extended_by_user_id_users_id_fk" FOREIGN KEY ("last_extended_by_user_id") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customer_feedback" ADD CONSTRAINT "service_customer_feedback_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_customer_feedback" ADD CONSTRAINT "service_customer_feedback_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_sample_requests" ADD CONSTRAINT "service_sample_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "drm"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."service_sample_requests" ADD CONSTRAINT "service_sample_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_commission_slabs" ADD CONSTRAINT "product_posting_commission_slabs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."product_posting_invoices" ADD CONSTRAINT "product_posting_invoices_invoice_number_unique" UNIQUE("invoice_number");--> statement-breakpoint
ALTER TABLE "drm"."projects" ADD CONSTRAINT "projects_project_number_unique" UNIQUE("project_number");