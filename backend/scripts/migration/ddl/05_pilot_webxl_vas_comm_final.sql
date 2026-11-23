-- Target: drm_legacy_stage.drm ONLY — pilot table for Phase 2C
-- Matches backend/src/shared/schema.ts webxlVasCommFinal (PG 16)

CREATE TABLE IF NOT EXISTS drm.webxl_vas_comm_final (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  manager_approve varchar(50) DEFAULT 'Pending',
  hod_status varchar(50) DEFAULT 'Pending',
  user_status varchar(50) DEFAULT 'Pending',
  account_pay_status varchar(50) DEFAULT 'Pending',
  account_pay_date timestamp,
  comm_year varchar(10),
  comm_month varchar(10),
  comm_type varchar(50),
  per varchar(20),
  comm numeric(10, 2),
  reward numeric(10, 2),
  team_reward numeric(10, 2),
  final_pay_amount numeric(10, 2),
  manager_approve_date timestamp,
  hod_satatus_date timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webxl_vas_comm_final_legacy
  ON drm.webxl_vas_comm_final (id);
