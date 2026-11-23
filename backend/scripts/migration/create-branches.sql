-- drm.branches is referenced by /api/drm/branches (branches.repository.ts) and the
-- physical asset inventory (/api/it/asset-inventory, physical-assets.repository.ts),
-- but the table was never created on this database (migrations/0002_gigantic_brood.sql
-- assumed it already existed and only ALTERed it), so those endpoints returned 500
-- "relation drm.branches does not exist". Shape copied from src/shared/schema.ts
-- (branches) + migrations/0002_gigantic_brood.sql. Additive only.
-- Rollback: create-branches.rollback.sql
CREATE TABLE IF NOT EXISTS drm.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  code text,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_by uuid REFERENCES drm.users(id),
  updated_by uuid REFERENCES drm.users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp,
  CONSTRAINT branches_name_unique UNIQUE (name),
  CONSTRAINT branches_code_unique UNIQUE (code)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'physical_assets_branch_id_branches_id_fk') THEN
    ALTER TABLE drm.physical_assets
      ADD CONSTRAINT physical_assets_branch_id_branches_id_fk
      FOREIGN KEY (branch_id) REFERENCES drm.branches(id) ON DELETE SET NULL;
  END IF;
END $$;
