#!/usr/bin/env python3
"""Phase 1F generator — read-only inputs, writes migration review artifacts."""
from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path("/var/www/DRM_raya")
MYSQL_DUMP = ROOT / "old_drm_database.sql"
SCHEMA_TS = ROOT / "backend/src/shared/schema.ts"
OUT_DIR = ROOT / "docs/migration"
BACKUP = OUT_DIR / "drm-schema-mapping.automated-backup.csv"
OUT_CSV = OUT_DIR / "drm-schema-mapping.csv"
OUT_CLASS = OUT_DIR / "07-legacy-table-classification.csv"

# --- Parse MySQL DDL ---
def load_mysql_tables(path: Path) -> dict[str, str]:
    create_re = re.compile(r"^CREATE TABLE `([^`]+)` \(", re.I)
    end_re = re.compile(r"^\) ENGINE=", re.I)
    tables: dict[str, str] = {}
    cur = None
    buf: list[str] = []
    with path.open(encoding="utf-8", errors="replace") as f:
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


def mysql_columns(ddl: str) -> list[tuple[str, str]]:
    cols = []
    for line in ddl.splitlines():
        line = line.strip()
        if not line.startswith("`"):
            continue
        m = re.match(r"`([^`]+)`\s+(.+?)(?:,)?$", line)
        if not m:
            continue
        name, typ = m.group(1), m.group(2)
        if name.upper() in ("PRIMARY", "KEY", "UNIQUE", "CONSTRAINT"):
            continue
        if typ.upper().startswith(("PRIMARY KEY", "KEY ", "UNIQUE ")):
            continue
        cols.append((name, typ))
    return cols


def insert_counts(path: Path) -> dict[str, int]:
    ins = re.compile(r"^INSERT INTO `([^`]+)`", re.I)
    c: dict[str, int] = defaultdict(int)
    with path.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            m = ins.match(line.strip())
            if m:
                c[m.group(1)] += 1
    return c


# --- Parse Drizzle schema.ts ---
def load_pg_schema(path: Path) -> dict[str, list[tuple[str, str]]]:
    text = path.read_text(encoding="utf-8")
    tables: dict[str, list[tuple[str, str]]] = {}
    idx = 0
    while True:
        m = re.search(r'drmSchema\.table\("([^"]+)",\s*\{', text[idx:])
        if not m:
            break
        start = idx + m.end() - 1
        tname = m.group(1)
        depth = 0
        i = start
        while i < len(text):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    body = text[start + 1 : i]
                    break
            i += 1
        else:
            break
        idx = i + 1
        cols = []
        for cm in re.finditer(r"^\s*(\w+):\s*([^\n,]+)", body, re.M):
            cols.append((cm.group(1), cm.group(2).strip()))
        tables[tname] = cols
    return tables


USER_REF_COLS = {
    "user_id", "uid", "assignid", "assign_id", "added_by", "manager_id", "sm_id", "hod_id",
    "hod_user_id", "manager", "user_bv", "recorded_by", "create_by", "created_by", "addby", "add_by",
    "referby", "refer_by", "pro_user", "att_id",
}
CUSTOMER_REF_COLS = {"com_id", "company_id", "customerid", "customer_id", "parentid"}


def snake(s: str) -> str:
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), s)


# Verified table-level mapping with evidence (Phase 1F manual review)
TABLE_EVIDENCE: dict[str, dict] = {
    "activity_logs": {
        "postgres_table": "activity_logs",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "System audit trail (admin/financial/HR mutations)",
        "evidence": "backend/src/server/services/activity-service.ts; backend/src/shared/schema.ts activityLogs",
        "id_strategy": "NEW_UUID; optional legacy_int in migration_legacy_ids",
        "pk_mysql": "id",
    },
    "webxl_activity_logs": {
        "postgres_table": "activity_logs",
        "classification": "DUPLICATE_SOURCE",
        "business_entity": "Duplicate audit log shape vs activity_logs",
        "evidence": "DDL identical to activity_logs; 0 INSERTs in dump",
        "id_strategy": "MERGE_WITH_DEDUP vs activity_logs",
        "pk_mysql": "id",
    },
    "webxl_user": {
        "postgres_table": "users",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Staff accounts",
        "evidence": "backend/src/server/routes/account-routes.ts (legacy webxl_user); users schema",
        "id_strategy": "NEW_UUID + migration_legacy_ids(legacy_user_id)",
        "pk_mysql": "user_id",
    },
    "webxl_company": {
        "postgres_table": "customers",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Customer / company master",
        "evidence": "gm-pool-routes, account-routes (com_id, drm.customers)",
        "id_strategy": "NEW_UUID; preserve webxl_company.id and com_id in map; drm_id from com_id",
        "pk_mysql": "id",
    },
    "tbl_customers": {
        "postgres_table": "customers",
        "classification": "DUPLICATE_SOURCE",
        "business_entity": "Obsolete CRM customer shape (tbl_* era)",
        "evidence": "DDL unlike webxl_company; parallel customer domain",
        "id_strategy": "MANUAL_RECONCILE before load",
        "pk_mysql": "customerid",
    },
    "webxl_invoice": {
        "postgres_table": "invoices",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Sales invoice header",
        "evidence": "account-routes joins drm.invoices; schema invoices",
        "id_strategy": "NEW_UUID + legacy invoice_id map",
        "pk_mysql": "invoice_id",
    },
    "tbl_invoices": {
        "postgres_table": "invoices",
        "classification": "DUPLICATE_SOURCE",
        "business_entity": "Legacy tbl invoice module",
        "evidence": "Different PK/customer linkage vs webxl_invoice",
        "id_strategy": "MANUAL_RECONCILE",
        "pk_mysql": "invoiceid",
    },
    "tbl_invitems": {"postgres_table": "", "classification": "DUPLICATE_SOURCE", "business_entity": "tbl invoice lines", "evidence": "Pairs with tbl_invoices", "id_strategy": "MANUAL", "pk_mysql": ""},
    "tbl_receipts": {"postgres_table": "", "classification": "DUPLICATE_SOURCE", "business_entity": "tbl receipts", "evidence": "tbl era", "id_strategy": "MANUAL", "pk_mysql": ""},
    "password_resets": {
        "postgres_table": "password_reset_tokens",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Password reset token",
        "evidence": "auth.routes.ts password_reset_tokens; schema passwordResetTokens",
        "id_strategy": "NEW_UUID; map user_id via legacy user map",
        "pk_mysql": "id",
    },
    "webxl_password_reset_emails": {
        "postgres_table": "",
        "classification": "LEGACY_ARCHIVE",
        "business_entity": "Email delivery log for resets (not token store)",
        "evidence": "Columns email/status/error — not in passwordResetTokens",
        "id_strategy": "ARCHIVE_ONLY",
        "pk_mysql": "id",
    },
    "webxl_followup": {
        "postgres_table": "follow_ups",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Sales follow-up call/task",
        "evidence": "CRM follow_ups schema; high INSERT volume",
        "id_strategy": "NEW_UUID (varchar in Drizzle); map legacy id",
        "pk_mysql": "id",
    },
    "webxl_followup_service": {
        "postgres_table": "diagnose_followups",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Diagnose Report / account-health survey",
        "evidence": "schema.ts diagnoseFollowups comment; ensure.ts; diagnose-followup-routes.ts",
        "id_strategy": "NEW_UUID",
        "pk_mysql": "id",
    },
    "webxl_follow_up_services": {
        "postgres_table": "follow_ups",
        "classification": "MANUAL_DECISION",
        "business_entity": "Per-follow-up service line + manager/SM/HOD comments",
        "evidence": "FK to webxl_followup; overlaps follow_ups managerComment + followup_services junction",
        "id_strategy": "Split transform or LEGACY_ARCHIVE extension table",
        "pk_mysql": "id",
    },
    "webxl_gmaccount": {
        "postgres_table": "gm_entries",
        "classification": "MANUAL_DECISION",
        "business_entity": "GM/BV period tracking (legacy gmaccount)",
        "evidence": "reports-routes.ts webxl_gmaccount.bvDate; not 1:1 with gm_entries shape",
        "id_strategy": "Map to gm_entries and/or bv_entries after business sign-off",
        "pk_mysql": "id",
    },
    "webxl_gmaccount_history": {
        "postgres_table": "",
        "classification": "LEGACY_ARCHIVE",
        "business_entity": "GM account BV history snapshot",
        "evidence": "No direct modern table; related gm_entries history fields",
        "id_strategy": "ARCHIVE",
        "pk_mysql": "id",
    },
    "webxl_gm_account_history": {
        "postgres_table": "",
        "classification": "LEGACY_ARCHIVE",
        "business_entity": "Audited history of webxl_gmaccount rows",
        "evidence": "operation enum INSERT/UPDATE/DELETE",
        "id_strategy": "ARCHIVE",
        "pk_mysql": "history_id",
    },
    "webxl_projects": {
        "postgres_table": "projects",
        "classification": "MANUAL_DECISION",
        "business_entity": "Minimal project name list only",
        "evidence": "Only id+project_name; modern projects rich schema",
        "id_strategy": "Likely not authoritative vs webxl_create_project",
        "pk_mysql": "id",
    },
    "webxl_create_project": {
        "postgres_table": "projects",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Legacy project creation records",
        "evidence": "com_id,user_id,project detail — closer to projects domain",
        "id_strategy": "NEW_UUID project id",
        "pk_mysql": "pro_id",
    },
    "webxl_task_links": {
        "postgres_table": "link_reports",
        "classification": "TRANSFORM_AND_MIGRATE",
        "business_entity": "Posted product/task links (link report source)",
        "evidence": "link-report.service.ts webxl_task_links",
        "id_strategy": "NEW_UUID; also product_posting_evidence_links for posting module",
        "pk_mysql": "id",
    },
    "webxl_vas_comm_final": {
        "postgres_table": "webxl_vas_comm_final",
        "classification": "DIRECT_MIGRATION",
        "business_entity": "Department VAS commission ledger",
        "evidence": "schema.ts webxlVasCommFinal; ensure.ts",
        "id_strategy": "PRESERVE_INT where PG serial/int PK",
        "pk_mysql": "id",
    },
    "webxl_terget": {"postgres_table": "target_system_targets", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Target definitions", "evidence": "schema.ts targetSystemTargets comments", "id_strategy": "legacy terget_id map", "pk_mysql": "terget_id"},
    "webxl_setterget": {"postgres_table": "target_system_user_targets", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "User-target assignments", "evidence": "reports-routes.ts webxl_setterget", "id_strategy": "legacy id map", "pk_mysql": "id"},
    "webxl_kwa": {"postgres_table": "target_system_kwa_records", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "KWA balance record", "evidence": "schema.ts targetSystemKwaRecords", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_kwa_history": {"postgres_table": "target_system_kwa_history", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "KWA transaction log", "evidence": "ensure.ts webxl_kwa_history", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_attendance": {"postgres_table": "attendance", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Daily attendance", "evidence": "attendance schema; attendance-excel-import service", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_role": {"postgres_table": "roles", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "RBAC roles", "evidence": "roles schema", "id_strategy": "role id map", "pk_mysql": "role_id"},
    "webxl_department": {"postgres_table": "departments", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Departments", "evidence": "departments schema", "id_strategy": "legacy dep id map", "pk_mysql": "dep_id"},
    "webxl_cheque_system": {"postgres_table": "cheques", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Cheque inventory", "evidence": "schema.ts comment webxl_cheque_system", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_ab_closing_history": {"postgres_table": "ab_closing_history", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "AB closing workflow", "evidence": "schema.ts comment; account-routes", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_dollar_buyer": {"postgres_table": "dollar_buyers", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Dollar buyers", "evidence": "dollar_buyers schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_dollar_pay": {"postgres_table": "dollar_buying", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Dollar buying ledger", "evidence": "dollar_buying schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_donation": {"postgres_table": "donations", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Donations", "evidence": "donations schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_refund_gm": {"postgres_table": "refund_gm_entries", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Refund GM", "evidence": "refund_gm_entries schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_tem_gm": {"postgres_table": "temp_gm_entries", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Temporary GM", "evidence": "temp_gm_entries schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_penalty": {"postgres_table": "penalties", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "HR penalties", "evidence": "penalties schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_policies": {"postgres_table": "policies", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Policy rules", "evidence": "policies schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_notice_board": {"postgres_table": "notices", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Notice board", "evidence": "notices schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_assign_notice": {"postgres_table": "notice_assignments", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Notice assignments", "evidence": "notice_assignments schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_leads": {"postgres_table": "opportunities", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Sales leads/opportunities", "evidence": "opportunities schema (CRM)", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_visit_meeting": {"postgres_table": "meetings", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Customer meetings", "evidence": "meetings schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_hod_meeting": {"postgres_table": "meetings", "classification": "MANUAL_DECISION", "business_entity": "HOD meetings (may overlap meetings)", "evidence": "hod-meeting-report-routes.ts", "id_strategy": "Subtype or archive", "pk_mysql": "id"},
    "webxl_complaints": {"postgres_table": "support_tickets", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Support tickets", "evidence": "support_tickets schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_expense": {"postgres_table": "office_expenses", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Office expenses", "evidence": "office_expenses schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_coa_parent_heads": {"postgres_table": "account_heads", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Chart of accounts parent", "evidence": "account_heads schema; account_head_category enum", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_attribute": {"postgres_table": "attributes", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Service attributes", "evidence": "attributes schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_servers": {"postgres_table": "it_servers", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "IT servers", "evidence": "it_servers schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_registry": {"postgres_table": "it_registries", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Domain registry", "evidence": "it_registries schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_package": {"postgres_table": "it_hosting_packages", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Hosting packages", "evidence": "it_hosting_packages schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_domain_backup": {"postgres_table": "it_backups", "classification": "STRUCTURE_ONLY", "business_entity": "Domain backup records", "evidence": "it_backups schema; 0 INSERTs", "id_strategy": "optional seed", "pk_mysql": "id"},
    "webxl_leave": {"postgres_table": "leave_requests", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Leave requests", "evidence": "leave_requests schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_overtime": {"postgres_table": "overtime_records", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Overtime", "evidence": "overtime_records schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_drm_allowed_ip": {"postgres_table": "allowed_ips", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "IP allowlist", "evidence": "allowed_ips schema", "id_strategy": "map", "pk_mysql": "id"},
    "webxl_training_video": {"postgres_table": "training_modules", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Training content", "evidence": "training_modules schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_posting_data": {"postgres_table": "product_posting_data", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Product posting payload", "evidence": "product_posting_data schema", "id_strategy": "NEW_UUID", "pk_mysql": "id"},
    "webxl_quotations": {"postgres_table": "quotations", "classification": "TRANSFORM_AND_MIGRATE", "business_entity": "Quotations (raw SQL table)", "evidence": "quotation-routes.ts drm.quotations", "id_strategy": "UUID quotations.id in prod", "pk_mysql": "id"},
    "webxl_invoice_item": {"postgres_table": "", "classification": "MANUAL_DECISION", "business_entity": "Invoice line items", "evidence": "May map to invoice line storage / quotation_items — not in Drizzle", "id_strategy": "MANUAL", "pk_mysql": "id"},
    "webxl_verify_gm": {"postgres_table": "gm_entries", "classification": "MANUAL_DECISION", "business_entity": "GM verification/payment status", "evidence": "reports-routes verify_gm.status", "id_strategy": "Extend gm_entries or archive", "pk_mysql": "id"},
    "webxl_task_assign": {"postgres_table": "tasks", "classification": "MANUAL_DECISION", "business_entity": "Task assignment rows", "evidence": "project-report.service.ts; tasks schema partial fit", "id_strategy": "Split tasks vs project_assignments", "pk_mysql": "id"},
    "user_activities_wrong": {},  # placeholder
}

# Default classification for remaining tables
PREFIX_RULES = [
    (re.compile(r"^webxl_com_"), "MANUAL_DECISION", "", "Legacy communication/commercial module", "No direct 1:1; consider communication_logs or archive"),
    (re.compile(r"^webxl_event"), "LEGACY_ARCHIVE", "", "Event management module", "No modern equivalent located"),
    (re.compile(r"^webxl_portfolio"), "TRANSFORM_AND_MIGRATE", "portfolios", "Portfolio marketing", "portfolios / portfolio_reservations schema"),
    (re.compile(r"^webxl_social"), "TRANSFORM_AND_MIGRATE", "social_accounts", "Social media module", "social_accounts / social_media_posts"),
    (re.compile(r"^webxl_posting"), "TRANSFORM_AND_MIGRATE", "product_posting_data", "Product posting", "product_posting_* tables"),
    (re.compile(r"^webxl_project"), "MANUAL_DECISION", "projects", "Project artifacts", "Multiple project_* tables in modern schema"),
    (re.compile(r"^webxl_quotation"), "TRANSFORM_AND_MIGRATE", "quotations", "Quotation lines/services", "quotation-routes raw table"),
    (re.compile(r"^webxl_service"), "MANUAL_DECISION", "service_customers", "Service department module", "service_* family in schema"),
    (re.compile(r"^webxl_training"), "TRANSFORM_AND_MIGRATE", "training_modules", "Training videos", "training_modules / training_progress"),
    (re.compile(r"^webxl_verify_gm"), "MANUAL_DECISION", "gm_entries", "GM verification workflow", "Financial GM module"),
    (re.compile(r"^webxl_gm"), "MANUAL_DECISION", "", "GM auxiliary tables", "gm_entries ecosystem"),
    (re.compile(r"^webxl_dollar"), "TRANSFORM_AND_MIGRATE", "dollar_buying", "Dollar system", "dollar_* tables"),
    (re.compile(r"^webxl_raw_attendence"), "LEGACY_ARCHIVE", "", "Raw attendance import staging", "Superseded by attendance import pipeline"),
    (re.compile(r"^webxl_attendance_month"), "LEGACY_ARCHIVE", "", "Monthly attendance aggregates", "No direct Drizzle table"),
]


def classify_table(name: str, inserts: int) -> dict:
    if name in TABLE_EVIDENCE:
        meta = TABLE_EVIDENCE[name].copy()
        if inserts == 0 and meta["classification"] not in ("STRUCTURE_ONLY", "DUPLICATE_SOURCE"):
            meta.setdefault("notes", "")
            meta["notes"] = (meta.get("notes", "") + " STRUCTURE_ONLY in dump").strip()
        return meta
    for pat, cls, pg, ent, ev in PREFIX_RULES:
        if pat.search(name):
            return {
                "postgres_table": pg,
                "classification": "STRUCTURE_ONLY" if inserts == 0 else cls,
                "business_entity": ent,
                "evidence": ev,
                "id_strategy": "TBD",
                "pk_mysql": "",
            }
    if name.startswith("webxl_"):
        return {
            "postgres_table": "",
            "classification": "LEGACY_ARCHIVE" if inserts > 0 else "STRUCTURE_ONLY",
            "business_entity": "Unmapped legacy module table",
            "evidence": "No verified reference in schema.ts/routes",
            "id_strategy": "ARCHIVE",
            "pk_mysql": "",
        }
    return {
        "postgres_table": "",
        "classification": "STRUCTURE_ONLY" if inserts == 0 else "MANUAL_DECISION",
        "business_entity": "Non-webxl legacy table",
        "evidence": "Requires business owner input",
        "id_strategy": "TBD",
        "pk_mysql": "",
    }


# Explicit column maps for verified pairs (mysql_col -> pg_col)
COLUMN_MAP: dict[tuple[str, str], tuple[str, str, str]] = {
    # activity_logs -> activity_logs (activity-service mapping)
    ("activity_logs", "user_id"): ("activity_logs", "userId", "VERIFIED", "Maps to actor UUID via legacy user map — NOT user_activities.id"),
    ("activity_logs", "action_type"): ("activity_logs", "action", "VERIFIED", "recordAuditLog: action -> action"),
    ("activity_logs", "action_description"): ("activity_logs", "details", "VERIFIED", "Rich text/json in details"),
    ("activity_logs", "table_name"): ("activity_logs", "resourceType", "VERIFIED", "entityType -> resource_type"),
    ("activity_logs", "record_id"): ("activity_logs", "resourceId", "VERIFIED", "entityId -> resource_id"),
    ("activity_logs", "created_at"): ("activity_logs", "createdAt", "VERIFIED", ""),
    ("activity_logs", "module"): ("activity_logs", "details", "VERIFIED", "Serialize into details JSON"),
    ("activity_logs", "old_values"): ("activity_logs", "details", "VERIFIED", "before/after in details JSON"),
    ("activity_logs", "new_values"): ("activity_logs", "details", "VERIFIED", ""),
    ("activity_logs", "ip_address"): ("activity_logs", "details", "VERIFIED", ""),
    ("activity_logs", "user_agent"): ("activity_logs", "details", "VERIFIED", ""),
    ("activity_logs", "status"): ("activity_logs", "details", "VERIFIED", "Enum -> text in details"),
    ("activity_logs", "username"): ("activity_logs", "details", "VERIFIED", "Denormalized; resolve from users"),
    ("activity_logs", "id"): ("activity_logs", "id", "VERIFIED", "NEW_UUID"),
    ("webxl_user", "user_id"): ("users", "id", "VERIFIED", "Legacy PK -> NEW_UUID + migration_legacy_ids"),
    ("webxl_company", "id"): ("customers", "id", "VERIFIED", "Legacy int -> NEW_UUID + map"),
    ("webxl_company", "com_id"): ("customers", "drmId", "VERIFIED", "Business DRM string id"),
    ("webxl_company", "cname"): ("customers", "companyName", "VERIFIED", ""),
    ("webxl_company", "assignId"): ("customers", "ownerUserId", "VERIFIED", "Legacy user int -> user UUID map"),
    ("webxl_followup_service", "com_id"): ("diagnose_followups", "companyId", "VERIFIED", "Customer UUID map"),
    ("webxl_followup_service", "uid"): ("diagnose_followups", "userId", "VERIFIED", "User UUID map"),
    ("password_resets", "user_id"): ("password_reset_tokens", "email", "REJECTED", "Must join webxl_user.email — do NOT map user_id to tokens.id"),
}


def pg_col_names(pg_tables: dict, pg_table: str) -> dict[str, str]:
    if pg_table not in pg_tables:
        return {}
    return {c: t for c, t in pg_tables[pg_table]}


def infer_pg_column(mysql_table: str, mysql_col: str, pg_table: str, pg_tables: dict) -> tuple[str, str, str, str]:
    """Returns pg_col, mapping_status, transform, notes"""
    key = (mysql_table, mysql_col)
    if key in COLUMN_MAP:
        pt, pc, status, note = COLUMN_MAP[key]
        if pt:
            pg_table = pt
        return pc, "MATCH" if status == "VERIFIED" else "NEEDS_MANUAL_REVIEW", "yes" if status == "VERIFIED" else "", note

    pg_cols = pg_col_names(pg_tables, pg_table)
    if not pg_table or not pg_cols:
        return "", "NO_TARGET_TABLE", "yes", "No verified postgres table"

    col_l = mysql_col.lower()
    # Reject mapping user refs to target PK `id` unless mysql_col is the source PK
    meta = TABLE_EVIDENCE.get(mysql_table, {})
    pk = (meta.get("pk_mysql") or "id").lower()
    if col_l in USER_REF_COLS or col_l.endswith("_id") and "user" in col_l:
        if "userId" in pg_cols:
            return "userId", "TRANSFORMATION_REQUIRED", "yes", "Legacy user int -> UUID via migration_legacy_ids"
        if col_l in USER_REF_COLS and mysql_table != "webxl_user":
            return "userId", "TRANSFORMATION_REQUIRED", "yes", "User FK translation"
    if col_l in CUSTOMER_REF_COLS or col_l == "com_id":
        for cand in ("customerId", "companyId"):
            if cand in pg_cols:
                return cand, "TRANSFORMATION_REQUIRED", "yes", "Legacy com_id/customerid -> customers UUID map"
        if "drmId" in pg_cols and col_l == "com_id":
            return "drmId", "TRANSFORMATION_REQUIRED", "yes", "String drm id"

    if mysql_col in pg_cols:
        return mysql_col, "MATCH", "no", ""
    camel = snake(mysql_col)
    if camel in pg_cols:
        return camel, "TRANSFORMATION_REQUIRED", "snake_to_camel", ""

    if col_l == pk and "id" in pg_cols:
        return "id", "TRANSFORMATION_REQUIRED", "yes", "PK -> NEW_UUID unless serial table"

    return "", "NEEDS_MANUAL_REVIEW", "no", "No semantic column match"


def main() -> None:
    mysql_tables = load_mysql_tables(MYSQL_DUMP)
    inserts = insert_counts(MYSQL_DUMP)
    pg_tables = load_pg_schema(SCHEMA_TS)

    # Classification CSV
    class_rows = []
    for t in sorted(mysql_tables):
        meta = classify_table(t, inserts.get(t, 0))
        class_rows.append({
            "mysql_table": t,
            "classification": meta["classification"],
            "target_postgres_table": meta.get("postgres_table", ""),
            "business_entity": meta.get("business_entity", ""),
            "evidence_source": meta.get("evidence", ""),
            "insert_statements_in_dump": inserts.get(t, 0),
            "id_strategy_table_level": meta.get("id_strategy", ""),
            "pk_mysql_column": meta.get("pk_mysql", ""),
            "scope_notes": meta.get("notes", ""),
        })

    with OUT_CLASS.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(class_rows[0].keys()))
        w.writeheader()
        w.writerows(class_rows)

    # Updated mapping CSV
    out_fields = [
        "mysql_table", "postgres_table", "mysql_column", "postgres_column",
        "mysql_type", "postgres_type", "mapping_status", "transformation_required",
        "notes", "verified_status", "business_entity", "evidence_source",
        "id_strategy", "relationship_strategy", "review_notes",
    ]
    rows_out = []
    for mt in sorted(mysql_tables):
        meta = classify_table(mt, inserts.get(mt, 0))
        pg_t = meta.get("postgres_table") or ""
        business = meta.get("business_entity", "")
        evidence = meta.get("evidence", "")
        id_strat = meta.get("id_strategy", "")
        for mc, mtyp in mysql_columns(mysql_tables[mt]):
            pg_c, status, transform, note = infer_pg_column(mt, mc, pg_t, pg_tables)
            pg_type = ""
            if pg_t and pg_c:
                pcm = pg_col_names(pg_tables, pg_t)
                pg_type = pcm.get(pg_c, "")[:120]
            verified = "UNVERIFIED"
            rel = ""
            review = ""
            if (mt, mc) in COLUMN_MAP:
                verified = COLUMN_MAP[(mt, mc)][2]
                review = COLUMN_MAP[(mt, mc)][3]
            elif status == "NO_TARGET_TABLE":
                verified = "NO_TARGET"
            elif pg_c and status in ("MATCH", "TRANSFORMATION_REQUIRED"):
                verified = "INFERRED"
            if mc.lower() in USER_REF_COLS or mc.lower() in CUSTOMER_REF_COLS:
                rel = "FK via migration_legacy_ids"
            if mt == "activity_logs" and pg_t == "user_activities":
                verified = "REJECTED"
                review = "Wrong target table; use activity_logs"
                pg_t = "activity_logs"
                pg_c, status, transform, note = infer_pg_column(mt, mc, pg_t, pg_tables)

            rows_out.append({
                "mysql_table": mt,
                "postgres_table": pg_t,
                "mysql_column": mc,
                "postgres_column": pg_c,
                "mysql_type": mtyp[:100],
                "postgres_type": pg_type,
                "mapping_status": status,
                "transformation_required": transform or ("yes" if status.startswith("TYPE") else "no"),
                "notes": note,
                "verified_status": verified,
                "business_entity": business,
                "evidence_source": evidence,
                "id_strategy": id_strat,
                "relationship_strategy": rel,
                "review_notes": review,
            })

    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader()
        w.writerows(rows_out)

    from collections import Counter
    c = Counter(r["classification"] for r in class_rows)
    vc = Counter(r["verified_status"] for r in rows_out)
    print("classification", dict(c))
    print("verified_status", dict(vc))
    print("rows", len(rows_out))


if __name__ == "__main__":
    main()
