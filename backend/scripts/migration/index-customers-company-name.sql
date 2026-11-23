-- Speeds up company-name lookups (lower(trim(company_name)) = ...) used by the
-- Target System KWA records API (GET fallback + POST company match).
-- Without it each lookup seq-scans ~231k customers (~250 ms each).
-- CONCURRENTLY: no write lock on drm.customers; must run outside a transaction.
-- Run: psql "$DATABASE_URL" -f index-customers-company-name.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_name_lower_trim
  ON drm.customers (lower(trim(company_name)));
