CREATE TABLE "bv_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"assigned_to" uuid,
	"company_name" text,
	"report_date" timestamp with time zone DEFAULT now() NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gm_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"report_date" timestamp with time zone DEFAULT now() NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"report_date" timestamp with time zone DEFAULT now() NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vas_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"report_date" timestamp with time zone DEFAULT now() NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "office_expenses" DROP CONSTRAINT "office_expenses_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "project_approvals" DROP CONSTRAINT "project_approvals_requested_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bv_reports" ADD CONSTRAINT "bv_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bv_reports" ADD CONSTRAINT "bv_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bv_reports" ADD CONSTRAINT "bv_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_reports" ADD CONSTRAINT "gm_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_reports" ADD CONSTRAINT "gm_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_reports" ADD CONSTRAINT "loan_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_reports" ADD CONSTRAINT "loan_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vas_reports" ADD CONSTRAINT "vas_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vas_reports" ADD CONSTRAINT "vas_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_expenses" ADD CONSTRAINT "office_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_approvals" ADD CONSTRAINT "project_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;