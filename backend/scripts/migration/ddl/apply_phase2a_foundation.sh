#!/usr/bin/env bash
# Apply Phase 2A foundation DDL to drm_legacy_stage ONLY.
set -euo pipefail

TARGET_DB="drm_legacy_stage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

echo "=== TARGET DATABASE: ${TARGET_DB} ==="
current="$(sudo -u postgres psql -tAc "SELECT current_database()" -d "$TARGET_DB")"
if [[ "$current" != "$TARGET_DB" ]]; then
  echo "ABORT: connected to wrong database: $current"
  exit 1
fi

apply_sql() {
  local file="$1"
  echo "Applying: $file"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TARGET_DB" -f "$file"
}

apply_sql "$SCRIPT_DIR/00_extensions.sql"
apply_sql "$SCRIPT_DIR/01_migration_meta.sql"
apply_sql "$SCRIPT_DIR/02_legacy_archive_tables.sql"

echo "Applying Drizzle journal migrations (PG16 sanitized)..."
for tag in 0000_nice_matthew_murdock 0001_wide_titania 0002_gigantic_brood 0003_parched_doorman \
  0004_broken_guardsmen 0005_funny_alice 0006_nice_leopardon 0007_red_ben_grimm 0008_loud_magma \
  0009_simple_living_tribunal; do
  f="$MIGRATIONS_DIR/${tag}.sql"
  if [[ ! -f "$f" ]]; then
    echo "Missing migration: $f"
    exit 1
  fi
  {
    echo "SET session_replication_role = replica;"
    sed -e 's/^CREATE SCHEMA "drm";/CREATE SCHEMA IF NOT EXISTS "drm";/' \
        -e 's/--> statement-breakpoint//g' \
        "$f"
    echo "SET session_replication_role = DEFAULT;"
  } | sudo -u postgres psql -v ON_ERROR_STOP=0 -d "$TARGET_DB"
done

# Additive SQL not always in drizzle journal
for extra in 20260603_increment_management.sql 20261022_copilot_core.sql; do
  f="$MIGRATIONS_DIR/$extra"
  if [[ -f "$f" ]]; then
    echo "Applying extra migration: $extra"
    sed -e 's/--> statement-breakpoint//g' "$f" | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TARGET_DB" || {
      echo "WARN: $extra may partially apply (idempotent expected)"
    }
  fi
done

echo "Seeding migration_table_status rows..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TARGET_DB" <<'SQL'
INSERT INTO migration_meta.migration_table_status (source_table)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'legacy_archive'
  AND table_name NOT LIKE '\_%' ESCAPE '\'
ON CONFLICT (source_table) DO NOTHING;
SQL

echo "Phase 2A foundation apply complete on ${TARGET_DB}"
