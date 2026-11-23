-- View Products: Move To Restricted / Move To Trash for legacy catalogue products.
-- legacy_archive stays read-only; a move is recorded here and applied on read as
-- COALESCE(moves.to_cat, mimg.cat). 987 = Restricted Products, 988 = Trash Products.
-- Additive and idempotent. Rollback: rollback-posting-product-moves.sql
CREATE TABLE IF NOT EXISTS drm.posting_product_moves (
  mimg_id   text PRIMARY KEY,          -- legacy_archive.webxl_posting_mimg.id
  from_cat  text,                      -- category before the (first) move
  to_cat    text NOT NULL,
  moved_by  text,                      -- drm.users.id
  moved_at  timestamptz NOT NULL DEFAULT now()
);
