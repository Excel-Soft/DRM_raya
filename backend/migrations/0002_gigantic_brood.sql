-- drm.branches already exists live (pre-existing, unused, 0 rows, only id+name
-- columns) — ALTER it to the full shape instead of CREATE TABLE.
ALTER TABLE "drm"."branches" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD CONSTRAINT "branches_code_unique" UNIQUE("code");--> statement-breakpoint
CREATE TABLE "drm"."physical_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" text NOT NULL,
	"make_model" text,
	"colour" text,
	"purchase_date" date,
	"warranty" text,
	"warranty_period" text,
	"purchased_condition" text,
	"current_condition" text DEFAULT 'In Custody' NOT NULL,
	"emp_code" text,
	"issued_status" text,
	"employee_name" text,
	"branch_id" uuid,
	"specification" text,
	"asset_owned_by" text,
	"mobile_phone" text,
	"it_manager_remarks" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD CONSTRAINT "branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."branches" ADD CONSTRAINT "branches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."physical_assets" ADD CONSTRAINT "physical_assets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "drm"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."physical_assets" ADD CONSTRAINT "physical_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drm"."physical_assets" ADD CONSTRAINT "physical_assets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "drm"."users"("id") ON DELETE no action ON UPDATE no action;
