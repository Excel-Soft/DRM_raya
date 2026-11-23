#!/usr/bin/env python3
"""
Incremental old-DRM import (Admin -> Old Data Import).

Old DRM keeps running after the 2026-11-04 snapshot. An admin uploads a newer MySQL
dump of the old system; this script merges it into legacy_archive.* the same way the
first import stored rows (all TEXT, one row per old primary key):

  new      legacy pk not in the archive yet          -> INSERT
  changed  same legacy pk, at least one value differs -> UPDATE (old row saved first)
  same     identical                                  -> skipped, never duplicated

Rows that exist in the archive but not in the dump (deleted in old DRM) are only
counted, never deleted. Duplicate primary keys inside the dump are skipped and reported.

Modes (one run = one migration_meta.import_runs row):
  check     parse + compare, write the per-table report; no data change
  apply     check, then insert/update table by table (each table in its own transaction)
  rollback  undo an applied run from migration_meta.import_row_history

Usage:
  DATABASE_URL=... python3 import_old_dump.py --run-id <uuid> --mode check|apply|rollback [--file dump.sql]
          [--schema legacy_archive] [--tables t1,t2] [--work-dir DIR]

Needs only python3 + the psql client (no extra packages). Values are parsed with the
same parser and cleaned with the same rules as run-archive-import.mjs, so a row that
did not change in old DRM compares as identical.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "parsers"))
from mysql_insert_parser import ParseError, parse_insert_statement  # noqa: E402

sys.path.insert(0, str(HERE))
import sync_modern  # noqa: E402

DB_URL = os.environ.get("DATABASE_URL", "")
SAMPLE = 5
IDENT_RE = re.compile(r"^[A-Za-z0-9_]+$")


# ─── psql helpers ───────────────────────────────────────────────────────────
def psql(sql: str, *, variables: dict[str, str] | None = None, file: Path | None = None) -> str:
    cmd = ["psql", DB_URL, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    for k, v in (variables or {}).items():
        cmd += ["-v", f"{k}={v}"]
    if file is not None:
        cmd += ["-f", str(file)]
    else:
        cmd += ["-c", sql]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[:4000])
    return r.stdout


def qi(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def ql(val: str) -> str:
    return "'" + val.replace("'", "''") + "'"


def set_run(run_id: str, **fields: object) -> None:
    sets, variables = [], {}
    for i, (k, v) in enumerate(fields.items()):
        if v is None:
            sets.append(f"{k} = NULL")
        elif k == "report":
            variables[f"v{i}"] = json.dumps(v)
            sets.append(f"{k} = :'v{i}'::jsonb")
        elif v == "now()":
            sets.append(f"{k} = now()")
        else:
            variables[f"v{i}"] = str(v)
            sets.append(f"{k} = :'v{i}'")
    sql_file = Path(tempfile.mkstemp(suffix=".sql")[1])
    sql_file.write_text(f"UPDATE migration_meta.import_runs SET {', '.join(sets)} WHERE id = {ql(run_id)}::uuid;\n")
    try:
        psql("", variables=variables, file=sql_file)
    finally:
        sql_file.unlink(missing_ok=True)


def progress(run_id: str, text: str) -> None:
    print(text, flush=True)
    try:
        set_run(run_id, progress=text)
    except Exception as e:  # progress is best effort
        print(f"progress update failed: {e}", flush=True)


# ─── value cleaning (same as run-archive-import.mjs sanitizeArchiveText) ─────
SURROGATES = re.compile("[\ud800-\udfff]")


def clean(v: str | None) -> str | None:
    if v is None:
        return None
    s = str(v)
    if "\0" in s:
        s = s.replace("\0", "\\0")
    return SURROGATES.sub("�", s)


def csv_field(v: str | None) -> str:
    # Non-NULL values are always quoted so the unquoted \N marker means NULL only.
    if v is None:
        return "\\N"
    return '"' + v.replace('"', '""') + '"'


# ─── archive metadata ───────────────────────────────────────────────────────
def archive_tables(schema: str) -> set[str]:
    out = psql(f"SELECT table_name FROM information_schema.tables WHERE table_schema = {ql(schema)} AND table_type = 'BASE TABLE'")
    return {t.strip() for t in out.splitlines() if t.strip()}


def archive_columns(schema: str, table: str) -> list[str]:
    out = psql(
        f"SELECT column_name FROM information_schema.columns WHERE table_schema = {ql(schema)} "
        f"AND table_name = {ql(table)} AND column_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY ordinal_position"
    )
    return [c.strip() for c in out.splitlines() if c.strip()]


META_COLUMNS = {"_archive_row_id", "_legacy_pk", "_legacy_pk_column", "_source_database",
                "_source_table", "_ingested_at", "_mig_batch_id"}


def archive_underscore_columns(schema: str, table: str) -> list[str]:
    out = psql(
        f"SELECT column_name FROM information_schema.columns WHERE table_schema = {ql(schema)} "
        f"AND table_name = {ql(table)} AND column_name LIKE '\\_%' ESCAPE '\\'"
    )
    return [c.strip() for c in out.splitlines() if c.strip() and c.strip() not in META_COLUMNS]


def archive_pk_column(schema: str, table: str) -> str | None:
    out = psql(f"SELECT _legacy_pk_column FROM {qi(schema)}.{qi(table)} LIMIT 1").strip()
    return out or None


# ─── phase 1: stream the dump into one CSV per table ────────────────────────
class TableBuf:
    def __init__(self, table: str, cols: list[str], pk_col: str, dump_cols: list[str], path: Path):
        self.table, self.cols, self.pk_col, self.path = table, cols, pk_col, path
        self.dump_cols = dump_cols
        self.fh = path.open("w", encoding="utf-8", newline="")
        self.rows = 0
        self.bad_rows = 0


def split_dump(run_id: str, dump: Path, schema: str, work: Path, only: set[str] | None):
    known = archive_tables(schema)
    bufs: dict[str, TableBuf] = {}
    unknown: dict[str, int] = {}
    warnings: list[str] = []
    total = dump.stat().st_size
    done = 0
    last = 0.0
    stmt: list[str] = []
    in_insert = False
    start_line = 0
    line_no = 0
    with dump.open("r", encoding="utf-8", errors="strict") as f:
        for line in f:
            line_no += 1
            done += len(line.encode("utf-8"))
            if time.time() - last > 5:
                last = time.time()
                progress(run_id, f"Reading file: {done / 1048576:.0f} MB of {total / 1048576:.0f} MB")
            stripped = line.lstrip()
            if not in_insert:
                if not stripped.upper().startswith("INSERT INTO"):
                    continue
                in_insert, start_line, stmt = True, line_no, []
            stmt.append(line)
            if not stripped.rstrip().endswith(";"):
                continue
            in_insert = False
            chunk = "".join(stmt)
            stmt = []
            try:
                ins = parse_insert_statement(chunk)
            except ParseError as e:
                warnings.append(f"Line {start_line}: could not parse INSERT ({e})")
                continue
            t = ins.table
            if only and t not in only:
                continue
            if t not in known:
                unknown[t] = unknown.get(t, 0) + len(ins.rows)
                continue
            buf = bufs.get(t)
            if buf is None:
                cols = archive_columns(schema, t)
                pk_col = archive_pk_column(schema, t) or "id"
                # Columns starting with "_" (e.g. webxl_complaints._token) were never filled by
                # the first import either; only warn about columns the archive doesn't have.
                all_cols = set(cols) | set(archive_underscore_columns(schema, t))
                missing = [c for c in ins.columns if c not in all_cols]
                if missing:
                    warnings.append(f"{t}: new column(s) in old DRM not stored in the archive: {', '.join(missing)}")
                common = [c for c in cols if c in ins.columns]
                buf = TableBuf(t, common, pk_col, ins.columns, work / f"{t}.csv")
                bufs[t] = buf
            idx = {c: i for i, c in enumerate(ins.columns)}
            if any(c not in idx for c in buf.cols):
                warnings.append(f"{t}: INSERT at line {start_line} has a different column list; skipped")
                buf.bad_rows += len(ins.rows)
                continue
            pk_i = idx.get(buf.pk_col, 0)
            for row in ins.rows:
                if len(row) != len(ins.columns):
                    buf.bad_rows += 1
                    continue
                pk = clean("" if row[pk_i] is None else str(row[pk_i]))
                vals = [csv_field(pk)] + [csv_field(clean(row[idx[c]])) for c in buf.cols]
                buf.fh.write(",".join(vals) + "\n")
                buf.rows += 1
    if in_insert:
        warnings.append(f"Line {start_line}: file ends inside an INSERT (incomplete dump?)")
    for b in bufs.values():
        b.fh.close()
    return bufs, unknown, warnings


# ─── phase 2: compare (and apply) one table ─────────────────────────────────
def table_sql(schema: str, b: TableBuf, run_id: str, apply: bool) -> str:
    t = f"{qi(schema)}.{qi(b.table)}"
    src = ql(b.table)
    cols = b.cols
    stg_cols = ", ".join(f"{qi(c)} text" for c in cols)
    a_tuple = ", ".join(f"a.{qi(c)}" for c in cols) or "NULL"
    s_tuple = ", ".join(f"s.{qi(c)}" for c in cols) or "NULL"
    diff_counts = ", ".join(
        f"{ql(c)}, count(*) FILTER (WHERE a.{qi(c)} IS DISTINCT FROM s.{qi(c)})" for c in cols
    ) or "'_', 0"
    csv_path = str(b.path).replace("'", "''")
    sql = f"""
SET lock_timeout = '15s';
SET statement_timeout = '30min';
BEGIN;
CREATE TEMP TABLE stg (_legacy_pk text {(',' + stg_cols) if cols else ''}) ON COMMIT DROP;
\\copy stg FROM '{csv_path}' WITH (FORMAT csv, NULL '\\N')
CREATE INDEX ON stg (_legacy_pk);
CREATE TEMP TABLE stg_dup ON COMMIT DROP AS
  SELECT _legacy_pk FROM stg GROUP BY 1 HAVING count(*) > 1;
CREATE TEMP TABLE cls ON COMMIT DROP AS
  SELECT s.*, a._archive_row_id AS arid,
         CASE WHEN a._archive_row_id IS NULL THEN 'new'
              WHEN ({a_tuple}) IS DISTINCT FROM ({s_tuple}) THEN 'changed'
              ELSE 'same' END AS kind
    FROM stg s
    LEFT JOIN {t} a ON a._source_table = {src} AND a._legacy_pk = s._legacy_pk
   WHERE s._legacy_pk NOT IN (SELECT _legacy_pk FROM stg_dup);
SELECT json_build_object(
  'table', {src},
  'dumpRows', (SELECT count(*) FROM stg),
  'archiveRowsBefore', (SELECT count(*) FROM {t} WHERE _source_table = {src}),
  'new', (SELECT count(*) FROM cls WHERE kind = 'new'),
  'changed', (SELECT count(*) FROM cls WHERE kind = 'changed'),
  'same', (SELECT count(*) FROM cls WHERE kind = 'same'),
  'duplicateInFile', (SELECT count(*) FROM stg WHERE _legacy_pk IN (SELECT _legacy_pk FROM stg_dup)),
  'onlyInArchive', (SELECT count(*) FROM {t} a WHERE a._source_table = {src}
                      AND NOT EXISTS (SELECT 1 FROM stg s WHERE s._legacy_pk = a._legacy_pk)),
  'newSample', (SELECT coalesce(json_agg(_legacy_pk), '[]') FROM (SELECT _legacy_pk FROM cls WHERE kind = 'new' ORDER BY length(_legacy_pk) DESC, _legacy_pk DESC LIMIT {SAMPLE}) x),
  'changedSample', (SELECT coalesce(json_agg(_legacy_pk), '[]') FROM (SELECT _legacy_pk FROM cls WHERE kind = 'changed' ORDER BY length(_legacy_pk) DESC, _legacy_pk DESC LIMIT {SAMPLE}) x),
  'changedColumns', (SELECT coalesce(json_object_agg(k, n) FILTER (WHERE n > 0), '{{}}')
                       FROM (SELECT (json_each_text(json_build_object({diff_counts}))).*
                               FROM cls s JOIN {t} a ON a._archive_row_id = s.arid
                              WHERE s.kind = 'changed') d(k, n0)
                       CROSS JOIN LATERAL (SELECT n0::bigint AS n) z)
);
"""
    if apply:
        set_cols = ", ".join(f"{qi(c)} = c.{qi(c)}" for c in cols)
        ins_cols = ", ".join(qi(c) for c in cols)
        sel_cols = ", ".join(f"c.{qi(c)}" for c in cols)
        sql += f"""
INSERT INTO migration_meta.import_row_history (run_id, table_name, archive_row_id, legacy_pk, action, old_row)
  SELECT {ql(run_id)}::uuid, {src}, a._archive_row_id, a._legacy_pk, 'update', to_jsonb(a)
    FROM {t} a JOIN cls c ON c.arid = a._archive_row_id WHERE c.kind = 'changed';
UPDATE {t} a SET {set_cols + ',' if cols else ''} _mig_batch_id = {ql(run_id)}::uuid, _ingested_at = now()
  FROM cls c WHERE c.arid = a._archive_row_id AND c.kind = 'changed';
WITH ins AS (
  INSERT INTO {t} (_legacy_pk, _legacy_pk_column, _source_table{', ' + ins_cols if cols else ''}, _mig_batch_id, _ingested_at)
  SELECT c._legacy_pk, {ql(b.pk_col)}, {src}{', ' + sel_cols if cols else ''}, {ql(run_id)}::uuid, now()
    FROM cls c WHERE c.kind = 'new'
  RETURNING _archive_row_id, _legacy_pk
)
INSERT INTO migration_meta.import_row_history (run_id, table_name, archive_row_id, legacy_pk, action)
  SELECT {ql(run_id)}::uuid, {src}, _archive_row_id, _legacy_pk, 'insert' FROM ins;
INSERT INTO migration_meta.migration_batches (batch_id, source_table, target_table, batch_status, rows_read, rows_archived, completed_at)
  VALUES (gen_random_uuid(), {src}, {ql(schema + '.' + b.table)}, 'incremental:{run_id}',
          (SELECT count(*) FROM stg), (SELECT count(*) FROM cls WHERE kind IN ('new', 'changed')), now());
"""
    sql += "COMMIT;\n"
    return sql


def run_compare(run_id: str, dump: Path, schema: str, work: Path, only: set[str] | None, apply: bool) -> dict:
    bufs, unknown, warnings = split_dump(run_id, dump, schema, work, only)
    if not bufs:
        raise RuntimeError("No INSERT data for known old-DRM tables was found in this file. Is it an old DRM MySQL dump?")
    tables = []
    for n, b in enumerate(sorted(bufs.values(), key=lambda x: x.rows), 1):
        verb = "Importing" if apply else "Comparing"
        progress(run_id, f"{verb} {b.table} ({n}/{len(bufs)}, {b.rows:,} rows)")
        f = work / f"{b.table}.sql"
        f.write_text(table_sql(schema, b, run_id, apply), encoding="utf-8")
        out = psql("", file=f).strip().splitlines()
        rep = json.loads([l for l in out if l.startswith("{")][-1])
        rep["skippedRows"] = b.bad_rows
        tables.append(rep)
        b.path.unlink(missing_ok=True)
        f.unlink(missing_ok=True)
    totals = {k: sum(int(t.get(k) or 0) for t in tables)
              for k in ("dumpRows", "new", "changed", "same", "duplicateInFile", "onlyInArchive", "skippedRows")}
    tables.sort(key=lambda t: (-(int(t["new"]) + int(t["changed"])), t["table"]))
    return {"mode": "apply" if apply else "check", "tables": tables, "totals": totals,
            "unknownTables": unknown, "warnings": warnings[:200]}


# ─── rollback ───────────────────────────────────────────────────────────────
def run_rollback(run_id: str, schema: str) -> dict:
    later = psql(
        f"SELECT count(*) FROM migration_meta.import_runs WHERE status IN ('applied', 'applying', 'rolling_back') "
        f"AND id <> {ql(run_id)}::uuid AND applied_at > (SELECT applied_at FROM migration_meta.import_runs WHERE id = {ql(run_id)}::uuid)"
    ).strip()
    if later and int(later) > 0:
        raise RuntimeError("A later import was applied after this one. Roll back the later import first.")
    names = [t for t in psql(
        f"SELECT DISTINCT table_name FROM migration_meta.import_row_history WHERE run_id = {ql(run_id)}::uuid ORDER BY 1"
    ).splitlines() if t.strip()]
    done = []
    for n, table in enumerate(names, 1):
        if not IDENT_RE.match(table):
            raise RuntimeError(f"unexpected table name {table!r}")
        progress(run_id, f"Rolling back {table} ({n}/{len(names)})")
        t = f"{qi(schema)}.{qi(table)}"
        cols = archive_columns(schema, table) + ["_mig_batch_id", "_ingested_at"]
        set_cols = ", ".join(f"{qi(c)} = r.{qi(c)}" for c in cols)
        sql_file = Path(tempfile.mkstemp(suffix=".sql")[1])
        sql_file.write_text(f"""
SET lock_timeout = '15s';
BEGIN;
WITH u AS (
  UPDATE {t} a SET {set_cols}
    FROM migration_meta.import_row_history h
    CROSS JOIN LATERAL jsonb_populate_record(NULL::{t}, h.old_row) r
   WHERE h.run_id = {ql(run_id)}::uuid AND h.table_name = {ql(table)} AND h.action = 'update'
     AND a._archive_row_id = h.archive_row_id
  RETURNING 1)
SELECT json_build_object('table', {ql(table)}, 'restored', (SELECT count(*) FROM u));
WITH d AS (
  DELETE FROM {t} a
   USING migration_meta.import_row_history h
   WHERE h.run_id = {ql(run_id)}::uuid AND h.table_name = {ql(table)} AND h.action = 'insert'
     AND a._archive_row_id = h.archive_row_id
  RETURNING 1)
SELECT json_build_object('table', {ql(table)}, 'removed', (SELECT count(*) FROM d));
COMMIT;
""", encoding="utf-8")
        try:
            lines = [json.loads(l) for l in psql("", file=sql_file).splitlines() if l.startswith("{")]
        finally:
            sql_file.unlink(missing_ok=True)
        done.append({"table": table, "restored": lines[0]["restored"], "removed": lines[1]["removed"]})
    return {"mode": "rollback", "tables": done,
            "totals": {"restored": sum(d["restored"] for d in done), "removed": sum(d["removed"] for d in done)}}


# ─── main ───────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--mode", required=True, choices=["check", "apply", "rollback"])
    ap.add_argument("--file")
    ap.add_argument("--schema", default="legacy_archive")
    ap.add_argument("--tables", help="comma-separated table filter (testing)")
    ap.add_argument("--work-dir")
    ap.add_argument("--no-sync", action="store_true", help="archive only; do not update drm.* copies")
    args = ap.parse_args()
    if not DB_URL:
        raise SystemExit("DATABASE_URL is not set")
    if not IDENT_RE.match(args.schema):
        raise SystemExit("bad schema name")
    run_id = args.run_id
    busy = {"check": "checking", "apply": "applying", "rollback": "rolling_back"}[args.mode]
    final = {"check": "checked", "apply": "applied", "rollback": "rolled_back"}[args.mode]
    stamp = {"check": "checked_at", "apply": "applied_at", "rollback": "rolled_back_at"}[args.mode]
    set_run(run_id, status=busy, error=None)
    work = Path(args.work_dir or tempfile.mkdtemp(prefix=f"drm-import-{run_id[:8]}-"))
    work.mkdir(parents=True, exist_ok=True)
    try:
        sync = args.schema == "legacy_archive" and not args.no_sync
        run_file = lambda path: psql("", file=Path(path))  # noqa: E731
        if args.mode == "rollback":
            # new-system copies first (they point at the archive rows), then the archive
            modern = sync_modern.run_rollback(run_id, run_file, lambda t: progress(run_id, t), work) if sync else []
            report = run_rollback(run_id, args.schema)
            report["modernRollback"] = modern
        else:
            if not args.file or not Path(args.file).is_file():
                raise RuntimeError("Dump file not found on the server")
            only = {t.strip() for t in args.tables.split(",")} if args.tables else None
            report = run_compare(run_id, Path(args.file), args.schema, work, only, args.mode == "apply")
            if args.mode == "apply" and sync:
                # partial report first, so a failure in this step still shows what was imported
                set_run(run_id, report=report)
                report["modernSync"] = sync_modern.run_sync(run_id, run_file, lambda t: progress(run_id, t), work)
        set_run(run_id, status=final, report=report, progress="Done", **{stamp: "now()"})
        print(json.dumps(report["totals"]), flush=True)
    except Exception as e:  # noqa: BLE001
        set_run(run_id, status="failed", error=str(e)[:4000], progress="Failed")
        print(f"FAILED: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
    finally:
        if not args.work_dir:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
