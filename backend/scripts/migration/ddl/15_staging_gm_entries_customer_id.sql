-- Staging: gm_entries.customer_id (required by GET /api/gm-pool and GMBV sync)

ALTER TABLE drm.gm_entries
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES drm.customers(id);

CREATE INDEX IF NOT EXISTS idx_gm_entries_customer_id ON drm.gm_entries (customer_id);

UPDATE drm.gm_entries g
   SET customer_id = c.id
  FROM drm.customers c
 WHERE g.customer_id IS NULL
   AND c.drm_id IS NOT NULL
   AND c.drm_id = g.drm_id;
