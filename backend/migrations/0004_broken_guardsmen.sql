CREATE TABLE "drm"."service_sub_subservices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subservice_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric,
	"discount" numeric,
	"min_day" integer,
	"max_day" integer,
	"dep_id" integer,
	"route_departments" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_sub_subservices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
-- "dep_id" already exists live on service_subservices (added by a prior
-- raw ALTER in full-spreadsheet-migration.ts) — only formalizing it in
-- Drizzle here, not re-adding the column.
ALTER TABLE "drm"."service_subservices" ADD COLUMN "route_departments" text[];--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "dep_id" integer;--> statement-breakpoint
ALTER TABLE "drm"."services" ADD COLUMN "route_departments" text[];--> statement-breakpoint
ALTER TABLE "drm"."service_sub_subservices" ADD CONSTRAINT "service_sub_subservices_subservice_id_service_subservices_id_fk" FOREIGN KEY ("subservice_id") REFERENCES "drm"."service_subservices"("id") ON DELETE cascade ON UPDATE no action;