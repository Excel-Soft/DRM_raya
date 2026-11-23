-- Speeds up the Public-pool sweep (sales-routes.ts syncPublicPool), which runs on every
-- Lead Pool list load and now checks each Private customer's latest follow-up.
-- Rollback: add-follow-ups-customer-created-index.rollback.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_customer_created
  ON drm.follow_ups (customer_id, created_at)
  WHERE coalesce(is_deleted, false) = false;
