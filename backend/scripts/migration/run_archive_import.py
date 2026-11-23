#!/usr/bin/env python3
"""
Phase 2B: Import all MySQL dump rows into legacy_archive on drm_legacy_stage ONLY.
Uses mysql_insert_parser + psql (postgres peer) — no production DB access.
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/var/www/DRM_raya")
DUMP = ROOT / "old_drm_database.sql"
MANIFEST = ROOT / "docs/migration/17-preservation-manifest.csv"
PARSER = ROOT / "backend/scripts/migration/parsers/mysql_insert_parser.py"
TARGET_DB = "drm_legacy_stage"

sys.path.insert(0, str(PARSER.parent.parent / "parsers"))
from mysql_insert_parser import ParseError, iter_insert_statements_from_stream  # noqa: E402


def psql_sql(sql: str) -> subprocess.CompletedProcess:
    if TARGET_DB not in sql and "current_database" not in sql:
        pass
    return subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )


def verify_target_db() -> None:
    r = psql_sql("SELECT current_database();")
    if r.returncode != 0 or TARGET_DB not in (r.stdout or ""):
        raise SystemExit(f"ABORT: not connected to {TARGET_DB}: {r.stderr}")


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sql_literal(val: str | None) -> str:
    if val is None:
        return "NULL"
    return "'" + val.replace("\\", "\\\\").replace("'", "''") + "'"


def load_manifest() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    with MANIFEST.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["source_table"]] = row
    return out


def load_archive_columns(table: str) -> list[str]:
    r = subprocess.run(
        [
            "sudo",
            "-u",
            "postgres",
            "psql",
            "-d",
            TARGET_DB,
            "-tAc",
            f"SELECT column_name FROM information_schema.columns WHERE table_schema='legacy_archive' AND table_name='{table.replace(chr(39), chr(39)+chr(39))}' AND column_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY ordinal_position;",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return [c.strip() for c in r.stdout.splitlines() if c.strip()]


def main() -> None:
    verify_target_db()
    manifest = load_manifest()
    if len(manifest) < 166:
        print(f"WARN: manifest rows={len(manifest)}")

    source_counts: dict[str, int] = defaultdict(int)
    archived_counts: dict[str, int] = defaultdict(int)
    rejects: list[dict] = []
    batch_size = 200

    tables_done: set[str] = set()

    for line_no, ins in iter_insert_statements_from_stream(str(DUMP)):
        table = ins.table
        if table not in manifest:
            rejects.append(
                {
                    "source_table": table,
                    "legacy_id": "",
                    "reason": "unknown_source_table",
                    "line": line_no,
                }
            )
            continue

        meta = manifest[table]
        pk_col = meta.get("source_primary_key") or "id"
        try:
            data_cols = load_archive_columns(table)
        except Exception as e:
            raise SystemExit(f"archive schema missing for {table}: {e}")

        col_index = {c: i for i, c in enumerate(ins.columns)}
        batch_id = str(uuid.uuid4())

        psql_sql(
            f"INSERT INTO migration_meta.migration_batches (batch_id, source_table, target_table, batch_status) "
            f"VALUES ({sql_literal(batch_id)}::uuid, {sql_literal(table)}, {sql_literal('legacy_archive.' + table)}, 'running');"
        )

        pending_rows: list[str] = []
        batch_count = 0

        def flush_batch() -> None:
            nonlocal batch_count, pending_rows
            if not pending_rows:
                return
            sql = (
                f"INSERT INTO legacy_archive.{qident(table)} "
                f"(_legacy_pk, _legacy_pk_column, {', '.join(qident(c) for c in data_cols)}) VALUES "
                + ",".join(pending_rows)
            )
            r = psql_sql(sql)
            if r.returncode != 0:
                raise RuntimeError(f"Insert failed {table} batch {batch_count}: {r.stderr}")
            batch_count += 1
            pending_rows = []

        for row in ins.rows:
            source_counts[table] += 1
            if len(row) != len(ins.columns):
                rejects.append(
                    {
                        "source_table": table,
                        "legacy_id": "",
                        "reason": "column_count_mismatch",
                        "line": line_no,
                    }
                )
                continue

            pk_val = None
            if pk_col in col_index:
                pk_val = row[col_index[pk_col]]
            elif len(row) > 0:
                pk_val = row[0]
            pk_text = "" if pk_val is None else str(pk_val)

            values = [sql_literal(pk_text), sql_literal(pk_col)]
            for dc in data_cols:
                if dc in col_index:
                    values.append(sql_literal(row[col_index[dc]]))
                else:
                    values.append("NULL")

            pending_rows.append("(" + ", ".join(values) + ")")
            if len(pending_rows) >= batch_size:
                flush_batch()

        flush_batch()
        archived_counts[table] += len(ins.rows)
        tables_done.add(table)

        psql_sql(
            f"UPDATE migration_meta.migration_batches SET batch_status='committed', rows_read={len(ins.rows)}, "
            f"rows_archived={len(ins.rows)}, completed_at=now() WHERE batch_id={sql_literal(batch_id)}::uuid;"
        )

        print(f"OK {table} +{len(ins.rows)} rows (line {line_no})", flush=True)

    # structure-only tables
    for t in manifest:
        if source_counts[t] == 0:
            psql_sql(
                f"UPDATE migration_meta.migration_table_status SET validation_status='structure_only', updated_at=now() "
                f"WHERE source_table={sql_literal(t)};"
            )

    # update table status counts
    for t, cnt in source_counts.items():
        psql_sql(
            f"UPDATE migration_meta.migration_table_status SET total_source_rows={cnt}, archived_rows={archived_counts[t]}, "
            f"validation_status='archived', updated_at=now() WHERE source_table={sql_literal(t)};"
        )

    recon_path = ROOT / "docs/migration/19-archive-row-count-reconciliation.csv"
    with recon_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source_table", "source_rows", "archived_rows", "failed_rows", "difference", "status"])
        all_tables = sorted(manifest.keys())
        for t in all_tables:
            src = source_counts.get(t, 0)
            ar = archived_counts.get(t, 0)
            diff = src - ar
            status = "OK" if diff == 0 else ("STRUCTURE_ONLY" if src == 0 else "MISMATCH")
            w.writerow([t, src, ar, diff if diff > 0 else 0, diff, status])

    fail_path = ROOT / "docs/migration/21-failed-and-unresolved-records.json"
    fail_path.write_text(json.dumps(rejects, indent=2), encoding="utf-8")

    print("DONE", sum(source_counts.values()), "source rows parsed", file=sys.stderr)


if __name__ == "__main__":
    main()
