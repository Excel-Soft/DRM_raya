#!/usr/bin/env python3
"""Generate legacy_archive DDL from MySQL dump CREATE TABLE blocks (read-only source)."""
from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path("/var/www/DRM_raya")
MYSQL_DUMP = ROOT / "old_drm_database.sql"
CLASS_CSV = ROOT / "docs/migration/07-legacy-table-classification.csv"
OUT_SQL = ROOT / "backend/scripts/migration/ddl/02_legacy_archive_tables.sql"
OUT_MANIFEST = ROOT / "docs/migration/17-preservation-manifest.csv"

create_re = re.compile(r"^CREATE TABLE `([^`]+)` \(", re.I)
end_re = re.compile(r"^\) ENGINE=", re.I)
alter_re = re.compile(r"^ALTER TABLE `([^`]+)`", re.I)
pk_re = re.compile(r"ADD PRIMARY KEY \(`([^`]+)`\)", re.I)
col_re = re.compile(r"^\s*`([^`]+)`\s+", re.M)

# Manual PK overrides
PK_OVERRIDE = {"tbl_receipts": "receiptid"}


def load_mysql_ddls() -> dict[str, str]:
    tables: dict[str, str] = {}
    cur: str | None = None
    buf: list[str] = []
    with MYSQL_DUMP.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            m = create_re.match(line.strip())
            if m:
                cur = m.group(1)
                buf = [line]
                continue
            if cur:
                buf.append(line)
                if end_re.search(line):
                    tables[cur] = "".join(buf)
                    cur = None
    return tables


def load_pks() -> dict[str, str]:
    pks: dict[str, str] = {}
    cur_table: str | None = None
    block: list[str] = []
    with MYSQL_DUMP.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            s = line.strip()
            am = alter_re.match(s)
            if am:
                cur_table = am.group(1)
                block = [s]
                continue
            if cur_table:
                block.append(s)
                if s.endswith(";"):
                    text = " ".join(block)
                    m = pk_re.search(text)
                    if m:
                        pks[cur_table] = m.group(1)
                    cur_table = None
    pks.update(PK_OVERRIDE)
    return pks


def parse_columns(ddl: str) -> list[str]:
    cols: list[str] = []
    for m in col_re.finditer(ddl):
        name = m.group(1)
        if name.upper() in ("PRIMARY", "KEY", "UNIQUE", "CONSTRAINT"):
            continue
        cols.append(name)
    return cols


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main() -> None:
    ddls = load_mysql_ddls()
    pks = load_pks()
    class_map: dict[str, dict[str, str]] = {}
    if CLASS_CSV.exists():
        with CLASS_CSV.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                class_map[row["mysql_table"]] = row

    lines: list[str] = [
        "-- Target database: drm_legacy_stage ONLY",
        "-- Loss-conscious archive: original names, TEXT scalars (NULL != '')",
        "",
        "CREATE SCHEMA IF NOT EXISTS legacy_archive AUTHORIZATION drm_app;",
        "",
    ]

    manifest_rows: list[dict[str, str]] = []

    for table in sorted(ddls):
        cols = parse_columns(ddls[table])
        pk = pks.get(table, cols[0] if cols else "id")
        archive_fqn = f'legacy_archive.{qident(table)}'

        col_defs = [
            '  "_archive_row_id" bigserial PRIMARY KEY',
            '  "_legacy_pk" text NOT NULL',
            '  "_legacy_pk_column" text NOT NULL',
            '  "_source_database" text NOT NULL DEFAULT \'ndrm\'',
            '  "_source_table" text NOT NULL DEFAULT \'' + table.replace("'", "''") + "'",
            '  "_ingested_at" timestamptz',
            '  "_mig_batch_id" uuid',
        ]
        for c in cols:
            col_defs.append(f"  {qident(c)} text")

        lines.append(f"CREATE TABLE IF NOT EXISTS legacy_archive.{qident(table)} (")
        lines.append(",\n".join(col_defs))
        lines.append(",")
        lines.append(f"  CONSTRAINT {qident(f'uq_{table}_legacy_pk')} UNIQUE (_source_table, _legacy_pk)")
        lines.append(");")
        lines.append("")

        meta = class_map.get(table, {})
        manifest_rows.append(
            {
                "source_table": table,
                "source_primary_key": pk,
                "archive_destination": f"legacy_archive.{table}",
                "modern_target_table": meta.get("target_postgres_table", ""),
                "classification": meta.get("classification", ""),
                "transformation_requirements": meta.get("id_strategy_table_level", "TEXT archive + optional modern transform"),
                "id_mapping_requirements": "migration_meta.migration_legacy_ids when modern_target set",
                "relationship_dependencies": "See docs/migration/08-id-mapping-strategy.md",
                "migration_status": "PENDING_PHASE_2B",
                "preservation_policy": "ARCHIVE_FIRST_ALWAYS",
            }
        )

    lines.extend(
        [
            "GRANT USAGE ON SCHEMA legacy_archive TO drm_app;",
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA legacy_archive TO drm_app;",
            "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA legacy_archive TO drm_app;",
            "",
        ]
    )

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")

    fieldnames = list(manifest_rows[0].keys())
    with OUT_MANIFEST.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(manifest_rows)

    print(f"tables={len(ddls)} sql={OUT_SQL} manifest={OUT_MANIFEST}")


if __name__ == "__main__":
    main()
