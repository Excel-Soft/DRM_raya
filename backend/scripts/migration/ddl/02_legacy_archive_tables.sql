-- Target database: drm_legacy_stage ONLY
-- Loss-conscious archive: original names, TEXT scalars (NULL != '')

CREATE SCHEMA IF NOT EXISTS legacy_archive AUTHORIZATION drm_app;

CREATE TABLE IF NOT EXISTS legacy_archive."activity_logs" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'activity_logs',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "username" text,
  "action_type" text,
  "action_description" text,
  "table_name" text,
  "record_id" text,
  "old_values" text,
  "new_values" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" text,
  "module" text,
  "status" text
,
  CONSTRAINT "uq_activity_logs_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."attendance_auto_settings" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'attendance_auto_settings',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "is_enabled" text,
  "enabled_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_attendance_auto_settings_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."gm_history_set" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'gm_history_set',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "gm_original_id" text,
  "created_at" text,
  "created_by" text,
  "note" text
,
  CONSTRAINT "uq_gm_history_set_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."gm_history_set_items" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'gm_history_set_items',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "history_set_id" text,
  "verify_gm_history_id" text,
  "delay_amount_history_id" text,
  "gmaccount_history_id" text,
  "created_at" text
,
  CONSTRAINT "uq_gm_history_set_items_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."password_resets" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'password_resets',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "token" text,
  "created_at" text,
  "expires_at" text,
  "used" text
,
  CONSTRAINT "uq_password_resets_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."tbl_customers" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'tbl_customers',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "customerid" text,
  "parentid" text,
  "title" text,
  "type" text,
  "firstname" text,
  "lastname" text,
  "religion" text,
  "designation" text,
  "dob" text,
  "pnic" text,
  "email" text,
  "phone" text,
  "fax" text,
  "mobile" text,
  "nationality" text,
  "language" text,
  "yahoo" text,
  "msn" text,
  "gtalk" text,
  "skype" text,
  "company" text,
  "url" text,
  "country" text,
  "state" text,
  "city" text,
  "zipcode" text,
  "address1" text,
  "address2" text,
  "remarks" text,
  "keywords" text,
  "email2" text,
  "phone2" text,
  "phone3" text,
  "fax2" text,
  "newsletter" text,
  "sms" text,
  "donotcall" text,
  "addtime" text,
  "addby" text,
  "referby" text,
  "token" text,
  "domain" text,
  "duser" text,
  "dpass" text,
  "verify" text
,
  CONSTRAINT "uq_tbl_customers_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."tbl_invitems" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'tbl_invitems',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "invoiceid" text,
  "title" text,
  "description" text,
  "quantity" text,
  "price" text
,
  CONSTRAINT "uq_tbl_invitems_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."tbl_invoices" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'tbl_invoices',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "invoiceid" text,
  "subject" text,
  "invdate" text,
  "duedate" text,
  "addby" text,
  "customerid" text,
  "nettotal" text,
  "discounttype" text,
  "discount" text,
  "adjustmenttype" text,
  "adjustment" text,
  "grandtotal" text,
  "paidtotal" text,
  "currencyid" text,
  "terms" text,
  "description" text,
  "remarks" text,
  "addtime" text,
  "referby" text,
  "token" text
,
  CONSTRAINT "uq_tbl_invoices_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."tbl_receipts" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'tbl_receipts',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "receiptid" text,
  "recnum" text,
  "recdate" text,
  "addby" text,
  "addtime" text,
  "updatetime" text,
  "updateby" text,
  "invoiceid" text,
  "customerid" text,
  "mtitle" text,
  "mdate" text,
  "amount" text,
  "methodid" text,
  "remarks" text,
  "referby" text,
  "token" text,
  "date" text
,
  CONSTRAINT "uq_tbl_receipts_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_ab_closing_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_ab_closing_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "client_payment" text,
  "cheque" text,
  "loan_recovery" text,
  "last_closing" text,
  "dollar_balance" text,
  "dollar_buy" text,
  "dollar_required" text,
  "get_funds" text,
  "temp_gm_acc" text,
  "temp_gm_amount" text,
  "martini_pending_count" text,
  "martini_pending_amount" text,
  "pending_cheque" text,
  "advance_pay" text,
  "sum_payment" text,
  "total_dollar_pkr" text,
  "dollar_gap_to_pay" text,
  "extra_disc_received" text,
  "extra_disc_paid" text,
  "refund_amount" text,
  "cash_in_hand" text,
  "acount_dep" text,
  "acc_date" text,
  "ab_pay_dep" text,
  "ab_date" text,
  "hod_dep" text,
  "hod_date" text,
  "closing_date" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_ab_closing_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_ab_packages" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_ab_packages',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "price" text,
  "ref_id" text,
  "packag_service" text
,
  CONSTRAINT "uq_webxl_ab_packages_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_ab_target" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_ab_target',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "target_name" text,
  "base_target_num" text,
  "jumb_target_num" text,
  "dream_target_num" text,
  "target_revenue" text,
  "target_type" text,
  "package" text,
  "start_date" text,
  "end_date" text,
  "detail" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_ab_target_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_acc_month_task" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_acc_month_task',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "task_id" text,
  "name" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_acc_month_task_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_activity_logs" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_activity_logs',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "username" text,
  "action_type" text,
  "action_description" text,
  "table_name" text,
  "record_id" text,
  "old_values" text,
  "new_values" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" text,
  "module" text,
  "status" text
,
  CONSTRAINT "uq_webxl_activity_logs_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_addvance_salary" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_addvance_salary',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "salary" text,
  "instalment" text,
  "detail" text,
  "remaning" text,
  "status" text,
  "create_date" text,
  "manager" text,
  "mng_comm" text,
  "mng_update" text,
  "hod" text,
  "hod_comm" text,
  "hod_update" text
,
  CONSTRAINT "uq_webxl_addvance_salary_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_assign_notice" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_assign_notice',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "notice_id" text,
  "user_id" text,
  "notice_detail" text,
  "assign_date" text
,
  CONSTRAINT "uq_webxl_assign_notice_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_attendance" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_attendance',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "timeIn" text,
  "timeOut" text,
  "late_absent" text,
  "meeting" text,
  "branch" text,
  "date" text
,
  CONSTRAINT "uq_webxl_attendance_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_attendance_month" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_attendance_month',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "lateHour" text,
  "lateMin" text,
  "halfLeave" text,
  "leaves" text,
  "branch" text,
  "month" text,
  "year" text
,
  CONSTRAINT "uq_webxl_attendance_month_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_attendance_month_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_attendance_month_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "lateHour" text,
  "lateMin" text,
  "halfLeave" text,
  "leaves" text,
  "branch" text,
  "month" text,
  "year" text,
  "updated_by" text,
  "last_update" text
,
  CONSTRAINT "uq_webxl_attendance_month_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_attribute" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_attribute',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "refId" text,
  "name" text,
  "time" text,
  "branch" text
,
  CONSTRAINT "uq_webxl_attribute_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_bank_balance" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_bank_balance',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "head" text,
  "detail" text,
  "amount" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_bank_balance_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_bot_hints" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_bot_hints',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "questions" text,
  "answers" text,
  "detail" text
,
  CONSTRAINT "uq_webxl_bot_hints_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_buyer_reference_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_buyer_reference_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "buyer_main" text,
  "buyer_reference" text,
  "buyer_reference_paypal_email" text,
  "total_dollars" text,
  "dollars" text,
  "dollar_rate" text,
  "dollar_balance" text,
  "buy_date" text,
  "pay_buy" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_buyer_reference_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_callbook" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_callbook',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id_call" text,
  "call_number" text,
  "call_type" text,
  "call_time" text,
  "duration" text,
  "cname" text,
  "com_id" text,
  "assignId" text
,
  CONSTRAINT "uq_webxl_callbook_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_category" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_category',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "root_id" text,
  "name" text,
  "uae" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_category_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_cheque_system" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_cheque_system',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pay_name" text,
  "amount" text,
  "eng_amount" text,
  "check_number" text,
  "cheque_date" text,
  "cheque_type" text,
  "closing_status" text,
  "remain_amount" text,
  "comments" text,
  "cheque_status" text,
  "user_id" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_cheque_system_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_coa_child_heads" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_coa_child_heads',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "parent_id" text,
  "account_code" text,
  "head_name" text,
  "description" text,
  "is_active" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_coa_child_heads_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_coa_parent_heads" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_coa_parent_heads',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "account_code" text,
  "head_name" text,
  "account_type" text,
  "description" text,
  "is_active" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_coa_parent_heads_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_coa_sub_transactional_heads" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_coa_sub_transactional_heads',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "parent_id" text,
  "child_id" text,
  "transactional_id" text,
  "account_code" text,
  "head_name" text,
  "description" text,
  "is_active" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_coa_sub_transactional_heads_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_coa_transactional_heads" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_coa_transactional_heads',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "parent_id" text,
  "child_id" text,
  "account_code" text,
  "head_name" text,
  "description" text,
  "is_active" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_coa_transactional_heads_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_com_category" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_com_category',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "catName" text
,
  CONSTRAINT "uq_webxl_com_category_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_com_detail" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_com_detail',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "title" text,
  "com_id" text,
  "name" text,
  "cinc" text,
  "email" text,
  "email2" text,
  "email3" text,
  "phone" text,
  "designation" text,
  "phone2" text,
  "phone3" text,
  "phone4" text,
  "phone5" text
,
  CONSTRAINT "uq_webxl_com_detail_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_com_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_com_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "tilte" text,
  "detail" text,
  "addBy" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_com_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_com_service" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_com_service',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "neme" text
,
  CONSTRAINT "uq_webxl_com_service_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_com_task" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_com_task',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "user_id" text,
  "task_id" text,
  "design" text,
  "develop" text,
  "data_feeding" text,
  "finish_date" text
,
  CONSTRAINT "uq_webxl_com_task_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_company" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_company',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "cname" text,
  "contact" text,
  "abAccount" text,
  "country" text,
  "city" text,
  "address" text,
  "comType" text,
  "website" text,
  "ntn" text,
  "rcLink" text,
  "source" text,
  "invoice_send" text,
  "status" text,
  "grade" text,
  "comment" text,
  "assignId" text,
  "crm_id" text,
  "crm_date" text,
  "disable" text,
  "tags" text,
  "created_by" text,
  "create_date" text,
  "update_at" text
,
  CONSTRAINT "uq_webxl_company_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_complaints" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_complaints',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "ticket_no" text,
  "com_id" text,
  "service" text,
  "user_id" text,
  "dep" text,
  "priority" text,
  "detail" text,
  "status" text,
  "chat_system" text,
  "_token" text,
  "form" text,
  "person_status" text,
  "dep_status" text,
  "dep_resolved" text,
  "create_date" text,
  "is_deleted" text,
  "deleted_at" text,
  "manager_comment" text,
  "user_comment" text
,
  CONSTRAINT "uq_webxl_complaints_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_create_project" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_create_project',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "pro_id" text,
  "com_id" text,
  "user_id" text,
  "manager" text,
  "project" text,
  "detail" text,
  "create_data" text
,
  CONSTRAINT "uq_webxl_create_project_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_currency" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_currency',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "doller" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_currency_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_customer_support_api" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_customer_support_api',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "data_send" text,
  "api_response" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_customer_support_api_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_day_book" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_day_book',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "method" text,
  "followup" text,
  "date" text,
  "last_update" text
,
  CONSTRAINT "uq_webxl_day_book_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_day_target" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_day_target',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "role" text,
  "method" text,
  "target" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_day_target_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dep_project_comm" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dep_project_comm',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "token" text,
  "inv_id" text,
  "rep_id" text,
  "cname" text,
  "acc_holder" text,
  "acc_holder_city" text,
  "items" text,
  "price" text,
  "deps" text,
  "method" text,
  "deps_status" text,
  "project_min_time" text,
  "project_max_time" text,
  "project_total_time" text,
  "items_status" text,
  "deps_late_project" text,
  "ab_type" text,
  "ab_package" text,
  "ab_dollars" text,
  "ab_cash_status" text,
  "drm_dollar_rate" text,
  "total_links" text,
  "upload_links" text,
  "total_task" text,
  "dep_finish" text,
  "qa" text,
  "verification" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_dep_project_comm_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_department" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_department',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "email" text,
  "pms_managers" text,
  "pms_ratio" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_department_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dhm_followup" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dhm_followup',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "sell_id" text,
  "purpose" text,
  "server" text,
  "next_follow" text,
  "grade" text,
  "answer" text,
  "note" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_dhm_followup_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollar_advance_pay" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollar_advance_pay',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "buyer_main" text,
  "buyer_reference" text,
  "com_id" text,
  "amount" text,
  "remain_amount" text,
  "pay_date" text,
  "status" text,
  "user_id" text,
  "comm" text,
  "create_at" text,
  "delete_date" text
,
  CONSTRAINT "uq_webxl_dollar_advance_pay_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollar_buyer" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollar_buyer',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "buyer_from" text,
  "paypal_email" text,
  "mobile" text,
  "account_number" text,
  "ref_id" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_dollar_buyer_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollar_buyer_dollars" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollar_buyer_dollars',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "buyer_main" text,
  "buyer_reference" text,
  "buyer_reference_paypal_email" text,
  "buyer_account_no" text,
  "payment_method" text,
  "type" text,
  "dollars" text,
  "dollar_rate" text,
  "pkr_amount" text,
  "buy_date" text,
  "detail" text,
  "cheque_id" text,
  "user_id" text,
  "show_ab" text,
  "use_for_tem" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_dollar_buyer_dollars_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollar_pay" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollar_pay',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "com_id" text,
  "gmid" text,
  "member_id" text,
  "order_id" text,
  "buyer_detail" text,
  "dollars" text,
  "dollar_rate" text,
  "pkr_amount" text,
  "cus_dollar_rate" text,
  "cus_profit" text,
  "pay_date" text,
  "type" text,
  "pay_status" text,
  "partial_payment" text,
  "detail" text,
  "update_by" text,
  "pay_detail" text,
  "update_at" text,
  "pay_by" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_dollar_pay_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollar_pay_temp" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollar_pay_temp',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "com_id" text,
  "gmid" text,
  "member_id" text,
  "order_id" text,
  "buyer_detail" text,
  "dollars" text,
  "dollar_rate" text,
  "pkr_amount" text,
  "cus_dollar_rate" text,
  "cus_profit" text,
  "pay_date" text,
  "type" text,
  "pay_status" text,
  "partial_payment" text,
  "detail" text,
  "update_by" text,
  "pay_detail" text,
  "update_at" text,
  "pay_by" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_dollar_pay_temp_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollars_received_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollars_received_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "buyer_main" text,
  "buyer_reference" text,
  "dollar_slot_id" text,
  "buyer_reference_paypal_email" text,
  "buyer_account_no" text,
  "payment_method" text,
  "dollars" text,
  "dollar_rate" text,
  "pkr_amount" text,
  "buy_date" text,
  "detail" text,
  "cheque_id" text,
  "create_at" text,
  "show_ab" text,
  "updated" text,
  "update_by" text,
  "tran_id" text,
  "acc_pay_pkr" text,
  "acc_pay_status" text,
  "acc_user_pay_by" text,
  "acc_pay_date" text,
  "screen_shot" text
,
  CONSTRAINT "uq_webxl_dollars_received_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_dollars_received_history_installment" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_dollars_received_history_installment',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "history_id" text,
  "buyer_reference_paypal_email" text,
  "installment_amount_pkr" text,
  "installment_status" text,
  "installment_date" text,
  "created_at" text,
  "note" text,
  "image" text,
  "created_by" text
,
  CONSTRAINT "uq_webxl_dollars_received_history_installment_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_domain_backup" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_domain_backup',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "domain_name" text,
  "web_type" text,
  "server_link" text,
  "domain_detail" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_domain_backup_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_domain_renewal_reminder_log" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_domain_renewal_reminder_log',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "sell_id" text,
  "product_key_id" text,
  "domain_name" text,
  "pro_type" text,
  "end_date" text,
  "days_before" text,
  "email_to" text,
  "invoice_id" text,
  "sent_at" text,
  "status" text,
  "error_message" text
,
  CONSTRAINT "uq_webxl_domain_renewal_reminder_log_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_donation" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_donation',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "detail" text,
  "amount" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_donation_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_drm_allowed_ip" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_drm_allowed_ip',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "created_by" text,
  "allowed_ip" text,
  "location" text,
  "browser" text,
  "ip_user" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_drm_allowed_ip_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_drm_setting" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_drm_setting',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "menu_title" text,
  "icon" text,
  "url_title" text,
  "url" text,
  "status" text,
  "dep" text,
  "allowed_role" text
,
  CONSTRAINT "uq_webxl_drm_setting_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_email_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_email_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "temp" text,
  "cat_id" text,
  "sender" text,
  "receiver" text,
  "type" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_email_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_event" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_event',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "event_type" text,
  "amount" text,
  "detail" text,
  "user_id" text,
  "start_time" text,
  "end_time" text,
  "attending" text,
  "event_date" text,
  "venu" text,
  "map" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_event_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_event_duty" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_event_duty',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "event_name" text,
  "duty" text,
  "duty_person" text,
  "detail" text,
  "duty_create_person" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_event_duty_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_event_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_event_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "event_name" text,
  "atten" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_event_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_event_menu" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_event_menu',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "event_name" text,
  "item" text,
  "amount" text,
  "detail" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_event_menu_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_event_speaker" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_event_speaker',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "event_name" text,
  "speaker" text,
  "topic" text,
  "detail" text,
  "start_time" text,
  "end_time" text,
  "total_time" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_event_speaker_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_expense" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_expense',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "phead_id" text,
  "office" text,
  "head_id" text,
  "amount" text,
  "detail" text,
  "cheque_id" text,
  "bill_image" text,
  "voucher_number" text,
  "create_date" text,
  "created_by" text
,
  CONSTRAINT "uq_webxl_expense_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_expense_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_expense_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "expense_id" text,
  "phead_id" text,
  "head_id" text,
  "office" text,
  "amount" text,
  "detail" text,
  "voucher_number" text,
  "cheque_id" text,
  "bill_image" text,
  "create_date" text,
  "created_by" text,
  "original_created_at" text,
  "deleted_by" text,
  "deleted_at" text,
  "deletion_reason" text
,
  CONSTRAINT "uq_webxl_expense_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_expense_images" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_expense_images',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "expense_id" text,
  "images" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_expense_images_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_expense_images_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_expense_images_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "history_id" text,
  "expense_id" text,
  "image_id" text,
  "images" text,
  "created_by" text,
  "deleted_at" text
,
  CONSTRAINT "uq_webxl_expense_images_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_expenses_head" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_expenses_head',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "head_id" text,
  "pid_head" text,
  "expenName" text,
  "type" text,
  "code" text,
  "head_type" text
,
  CONSTRAINT "uq_webxl_expenses_head_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_feedback" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_feedback',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "vfy_by" text,
  "feedback" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_feedback_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_follow_up_images" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_follow_up_images',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "follow_up_id" text,
  "service_detail_id" text,
  "user_id" text,
  "company_id" text,
  "image" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_follow_up_images_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_follow_up_services" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_follow_up_services',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "service_id" text,
  "follow_up_id" text,
  "service_type" text,
  "service_grade" text,
  "service_comment" text,
  "manager_id" text,
  "manager_comment" text,
  "sm_id" text,
  "sm_comment" text,
  "hod_id" text,
  "hod_comment" text,
  "purpose" text,
  "method" text,
  "next_date" text,
  "note" text,
  "talk_time" text,
  "added_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_follow_up_services_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_followup" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_followup',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "uid" text,
  "username" text,
  "purpose_call" text,
  "service_for" text,
  "cm" text,
  "nc" text,
  "ncm" text,
  "answer" text,
  "note" text,
  "tk_mint" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_followup_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_followup_service" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_followup_service',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "uid" text,
  "username" text,
  "report" text,
  "start_rating" text,
  "up_salling" text,
  "rfq" text,
  "products" text,
  "follow_rate" text,
  "sample" text,
  "order" text,
  "revenue" text,
  "happy_alibaba" text,
  "happy_webxl" text,
  "create_date" text,
  "manager_id" text,
  "manager_comment" text,
  "sm_id" text,
  "sm_comment" text,
  "hod_id" text,
  "hod_comment" text
,
  CONSTRAINT "uq_webxl_followup_service_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_gm_account_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_gm_account_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "history_id" text,
  "original_id" text,
  "com_id" text,
  "user_id" text,
  "user_bv_date" text,
  "bvDate" text,
  "startData" text,
  "endData" text,
  "LastStartDate" text,
  "LastExpireDate" text,
  "create_data" text,
  "renwal" text,
  "date_btn" text,
  "disable" text,
  "recorded_at" text,
  "recorded_by" text,
  "operation" text
,
  CONSTRAINT "uq_webxl_gm_account_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_gm_doc" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_gm_doc',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "com_id" text,
  "comm" text,
  "upload" text,
  "uploaded_doc" text
,
  CONSTRAINT "uq_webxl_gm_doc_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_gmaccount" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_gmaccount',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "user_bv_date" text,
  "bvDate" text,
  "startData" text,
  "endData" text,
  "LastStartDate" text,
  "LastExpireDate" text,
  "create_data" text,
  "renwal" text,
  "date_btn" text,
  "disable" text
,
  CONSTRAINT "uq_webxl_gmaccount_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_gmaccount_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_gmaccount_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "addBy" text,
  "user_id" text,
  "title" text,
  "bvDate" text,
  "bvExpire" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_gmaccount_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_govt_leave" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_govt_leave',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "leave_type" text,
  "leave_day" text,
  "comm" text,
  "date" text
,
  CONSTRAINT "uq_webxl_govt_leave_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_hod_meeting" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_hod_meeting',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "meeting_by" text,
  "meeting_type" text,
  "detail" text,
  "create_date" text,
  "status" text,
  "start_time" text,
  "end_time" text,
  "sc_id" text,
  "sc_comment" text,
  "hod_id" text,
  "hod_comment" text
,
  CONSTRAINT "uq_webxl_hod_meeting_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_increments" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_increments',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "target_achievment" text,
  "skills" text,
  "disciplinary" text,
  "feedback" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_increments_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_invoice" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_invoice',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "invoice_id" text,
  "qou_id" text,
  "is_auto" text,
  "com_id" text,
  "cname" text,
  "phone" text,
  "email" text,
  "address" text,
  "user_id" text,
  "sub_total" text,
  "discount" text,
  "grand_total" text,
  "pay" text,
  "gst" text,
  "create_date" text,
  "doller_rate" text,
  "start" text,
  "domain_renewal" text,
  "hod_user_id" text,
  "hod_role_id" text,
  "hod_dep_id" text,
  "hod" text,
  "hod_comm" text,
  "update_date" text,
  "account" text,
  "updated_by" text,
  "role_id" text,
  "dep_id" text,
  "invoice_dep" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_invoice_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_invoice_item" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_invoice_item',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "invoice_id" text,
  "item" text,
  "detail" text,
  "unit_price" text,
  "qty" text,
  "totalPkr" text,
  "pkr" text,
  "pay" text,
  "start" text
,
  CONSTRAINT "uq_webxl_invoice_item_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_invoice_item_pay" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_invoice_item_pay',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "inv_item_id" text,
  "invoice_id" text,
  "item" text,
  "pay" text,
  "method" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_invoice_item_pay_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_it_assets" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_it_assets',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "asset_type" text,
  "make_model" text,
  "colour" text,
  "purchase_date" text,
  "warranty" text,
  "warranty_period" text,
  "purchased_condition" text,
  "current_condition" text,
  "emp_code" text,
  "issued_status" text,
  "employee_name" text,
  "office" text,
  "specification" text,
  "asset_owned_by" text,
  "mobile_phone" text,
  "it_manager_remarks" text,
  "it_executive_remarks" text,
  "is_deleted" text
,
  CONSTRAINT "uq_webxl_it_assets_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_kwa" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_kwa',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "kwa" text,
  "remaning" text,
  "detail" text,
  "type" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_kwa_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_kwa_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_kwa_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "kwa_id" text,
  "user_id" text,
  "pay" text,
  "type" text,
  "kwa_detail_pay" text,
  "pay_date" text
,
  CONSTRAINT "uq_webxl_kwa_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_last_followup" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_last_followup',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "uid" text,
  "username" text,
  "cm" text,
  "nc" text,
  "ncm" text,
  "note" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_last_followup_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_leads" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_leads',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "assgin_by" text,
  "transfer" text,
  "transfer_note" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_leads_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_leave" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_leave',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "purpose" text,
  "leave_type" text,
  "day" text,
  "time" text,
  "st_date" text,
  "end_date" text,
  "detail" text,
  "alternative" text,
  "dep" text,
  "dep_comm" text,
  "hod" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_leave_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_log" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_log',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "userName" text,
  "title" text,
  "detail" text,
  "type" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_log_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_log_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_log_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "name" text,
  "mac_address" text,
  "ip_address" text,
  "sytem_name" text,
  "getuser_agent" text,
  "log_date" text
,
  CONSTRAINT "uq_webxl_log_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_login" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_login',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "role_id" text,
  "username" text,
  "password" text,
  "change_pass" text,
  "last_login" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_login_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_media" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_media',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "type" text,
  "media" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_media_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_messager" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_messager',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "role_id" text,
  "message" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_messager_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_notice_board" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_notice_board',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "heading" text,
  "detail" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_notice_board_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_overtime" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_overtime',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "purpose" text,
  "time" text,
  "dep" text,
  "detail" text,
  "dep_title" text,
  "type" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_overtime_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_package" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_package',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "pack_id" text,
  "title" text,
  "space" text
,
  CONSTRAINT "uq_webxl_package_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_password_reset_emails" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_password_reset_emails',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "email" text,
  "status" text,
  "error_message" text,
  "created_at" text
,
  CONSTRAINT "uq_webxl_password_reset_emails_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_pay_loan" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_pay_loan',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "loan_id" text,
  "pay" text,
  "pay_date" text
,
  CONSTRAINT "uq_webxl_pay_loan_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_payments" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_payments',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "invoice_id" text,
  "com_id" text,
  "amount" text,
  "receipt_number" text,
  "method" text,
  "status" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_payments_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_penalty" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_penalty',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "add_by" text,
  "head" text,
  "amount" text,
  "confirm" text,
  "system_genrated" text,
  "date" text
,
  CONSTRAINT "uq_webxl_penalty_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_penalty_head" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_penalty_head',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "head" text,
  "amount" text
,
  CONSTRAINT "uq_webxl_penalty_head_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_policies" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_policies',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "head" text,
  "detail" text,
  "policy_type" text,
  "min_allow" text,
  "max_allow" text,
  "penalty" text,
  "img" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_policies_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_portfolio" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_portfolio',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "category" text,
  "sub_cate" text,
  "keyword" text,
  "server_link" text,
  "main_img" text,
  "top_header_img" text,
  "main_sliders" text,
  "sliders" text,
  "body_img" text,
  "listing_page" text,
  "status" text,
  "used" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_portfolio_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_portfolio_booking" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_portfolio_booking',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "cname" text,
  "design_id" text,
  "user_id" text,
  "status" text,
  "detail" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_portfolio_booking_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_portfolio_categories" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_portfolio_categories',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "name" text,
  "ref_id" text
,
  CONSTRAINT "uq_webxl_portfolio_categories_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_posting_data" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_posting_data',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "categories" text,
  "images" text,
  "mimg_id" text,
  "user_id" text
,
  CONSTRAINT "uq_webxl_posting_data_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_posting_keywords" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_posting_keywords',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "category" text,
  "title" text,
  "keywords" text,
  "descp" text,
  "date" text
,
  CONSTRAINT "uq_webxl_posting_keywords_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_posting_mimg" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_posting_mimg',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "img" text,
  "cat" text,
  "user_id" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_posting_mimg_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_project_attribute" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_project_attribute',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "com_id" text,
  "name" text,
  "att_type" text,
  "delay_section" text,
  "delay_reason" text,
  "comment" text,
  "dep_id" text,
  "add_by" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_project_attribute_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_project_chats" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_project_chats',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "detail" text,
  "sender" text,
  "readFlag" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_project_chats_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_project_data" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_project_data',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "task_mes_id" text,
  "data" text,
  "user_id" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_project_data_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_project_img" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_project_img',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pid" text,
  "images" text,
  "upl_number" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_project_img_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_project_status" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_project_status',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "pro_id" text,
  "product" text,
  "assign_user" text,
  "status" text,
  "link" text,
  "pro_update" text,
  "upload_doc" text,
  "mag_verify" text,
  "vfy_date" text,
  "assign_date" text,
  "modification" text,
  "client_status" text
,
  CONSTRAINT "uq_webxl_project_status_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_projects" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_projects',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "project_name" text
,
  CONSTRAINT "uq_webxl_projects_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_promotions" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_promotions',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "package" text,
  "title" text,
  "img" text,
  "discount" text,
  "start_date" text,
  "end_date" text,
  "detail" text,
  "active" text,
  "rank" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_promotions_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_questions" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_questions',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "qid" text,
  "detail" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_questions_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_quotation_items" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_quotation_items',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "quo_id" text,
  "item" text,
  "detail" text,
  "unit_price" text,
  "ab_discount" text,
  "qty" text,
  "min_day" text,
  "max_day" text,
  "from_year" text,
  "to_year" text,
  "domain" text
,
  CONSTRAINT "uq_webxl_quotation_items_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_quotation_services" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_quotation_services',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "main_id" text,
  "name" text,
  "detail" text,
  "price" text,
  "discount" text,
  "min_day" text,
  "max_day" text,
  "dep_id" text
,
  CONSTRAINT "uq_webxl_quotation_services_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_quotation_tracker" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_quotation_tracker',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "quo_id" text,
  "com_id" text,
  "user_id" text,
  "service_id" text,
  "days" text,
  "create_date" text,
  "is_expire" text
,
  CONSTRAINT "uq_webxl_quotation_tracker_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_quotations" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_quotations',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "quo_id" text,
  "com_id" text,
  "cname" text,
  "phone" text,
  "email" text,
  "address" text,
  "user_id" text,
  "sub_total" text,
  "discount" text,
  "grand_total" text,
  "gst" text,
  "first_pay" text,
  "quo_title" text,
  "quo_note" text,
  "quo_save" text,
  "quo_type" text,
  "dliver_time" text,
  "dollar_rate" text,
  "hod_status" text,
  "hod_comment" text,
  "create_date" text,
  "is_used" text
,
  CONSTRAINT "uq_webxl_quotations_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_raw_attendence" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_raw_attendence',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "office" text,
  "device_ip" text,
  "uid" text,
  "user_id" text,
  "state" text,
  "type" text,
  "att_timestamp" text,
  "received_at" text,
  "raw_json" text
,
  CONSTRAINT "uq_webxl_raw_attendence_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_recoverd_ab_payments" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_recoverd_ab_payments',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "gmid" text,
  "recovery_id" text,
  "user_id" text,
  "member_id" text,
  "order_id" text,
  "dollars" text,
  "dollar_rate" text,
  "pkr_amount" text,
  "dollar_balance" text,
  "pkr_balance" text,
  "recovery_type" text,
  "payment_method" text,
  "add_by" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_recoverd_ab_payments_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_refund_gm" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_refund_gm',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "cname" text,
  "user_id" text,
  "amount" text,
  "amount_type" text,
  "status" text,
  "comment" text,
  "add_by" text,
  "create_at" text,
  "delete_date" text
,
  CONSTRAINT "uq_webxl_refund_gm_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_registry" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_registry',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "registry_id" text,
  "title" text
,
  CONSTRAINT "uq_webxl_registry_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_role" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_role',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "des" text,
  "department" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_role_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_sell" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_sell',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "domain_name" text,
  "username" text,
  "passowrd" text,
  "reg_date" text
,
  CONSTRAINT "uq_webxl_sell_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_sell_products" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_sell_products',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "sell_id" text,
  "pro_type" text,
  "key_id" text,
  "server_type" text,
  "start_date" text,
  "end_date" text,
  "last_expire" text,
  "af_coname" text,
  "status" text,
  "deactive_reason" text
,
  CONSTRAINT "uq_webxl_sell_products_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_servers" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_servers',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "server_id" text,
  "title" text,
  "space" text,
  "year" text,
  "server_name" text,
  "buying_date" text
,
  CONSTRAINT "uq_webxl_servers_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_service_project" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_service_project',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "profile" text,
  "minitsite" text,
  "listing" text,
  "pro_ft" text,
  "showcase" text,
  "training" text,
  "pro_six" text,
  "pro_tw" text,
  "three_m_dia" text,
  "smart_showcase" text,
  "auto_response" text,
  "kwa" text,
  "create_at" text,
  "status" text,
  "qa_status" text,
  "user_status" text,
  "project_end_date" text
,
  CONSTRAINT "uq_webxl_service_project_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_servicepool" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_servicepool',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "ta_user" text,
  "com_id" text,
  "parent_id" text,
  "note" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_servicepool_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_setterget" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_setterget',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "terget_id" text,
  "terget_cat" text,
  "target_num" text,
  "start_date" text,
  "end_date" text,
  "singDate" text
,
  CONSTRAINT "uq_webxl_setterget_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_social_account" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_social_account',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "email" text,
  "phone" text,
  "status" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_social_account_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_social_account_post" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_social_account_post',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "post_platform" text,
  "post_title" text,
  "url_fb" text,
  "linkedin_url" text,
  "insta_url" text,
  "youtube_url" text,
  "tiktok_url" text,
  "account_type" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_social_account_post_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_social_account_url" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_social_account_url',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "social_acc_id" text,
  "fb_profile" text,
  "fb_profile_url" text,
  "insta_profile" text,
  "insta_profile_url" text,
  "youtube_profile" text,
  "youtube_profile_url" text,
  "tiktok_profile" text,
  "tiktok_profile_url" text,
  "linkedin_profile" text,
  "linkedin_profile_url" text
,
  CONSTRAINT "uq_webxl_social_account_url_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_social_post_followup" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_social_post_followup',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "post_id" text,
  "user_id" text,
  "plat_form" text,
  "likes" text,
  "shares" text,
  "comments" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_social_post_followup_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_status_hod" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_status_hod',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "invoice_id" text,
  "com_id" text,
  "acc_status" text,
  "acc_comm" text,
  "hod_status" text,
  "hod_comm" text,
  "create_date" text,
  "update_date" text,
  "pay_rec_date" text
,
  CONSTRAINT "uq_webxl_status_hod_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_task_assign" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_task_assign',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "task_id" text,
  "pro_id" text,
  "hours" text,
  "min" text,
  "links" text,
  "timespent" text,
  "freetime" text,
  "totalTimespent" text,
  "assign_date" text,
  "stauts" text,
  "last_update" text,
  "mng_status" text,
  "final_links" text,
  "mng_date" text,
  "qa_status" text,
  "qa_com" text,
  "qa_date" text,
  "fy_status" text,
  "fy_com" text,
  "fy_fdb" text,
  "fy_date" text,
  "after_qa_changing" text,
  "open_url" text,
  "url_date" text,
  "soft_com_id" text,
  "soft_task_cname" text,
  "soft_task_name" text,
  "soft_task_time" text,
  "soft_task_day" text,
  "soft_task_type" text,
  "soft_task_piority" text,
  "soft_task_due_date" text,
  "assgin_by" text,
  "soft_task_detail" text,
  "shifted_task" text
,
  CONSTRAINT "uq_webxl_task_assign_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_task_detail" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_task_detail',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "detail" text,
  "data_date" text
,
  CONSTRAINT "uq_webxl_task_detail_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_task_group" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_task_group',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "department" text,
  "detail" text
,
  CONSTRAINT "uq_webxl_task_group_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_task_links" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_task_links',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "pro_id" text,
  "task_id" text,
  "link" text,
  "showcase" text,
  "detail" text,
  "user_id" text,
  "create_at" text,
  "verify" text,
  "note" text,
  "verify_date" text,
  "send_to_qa" text,
  "qa_status" text,
  "qa_com" text,
  "qa_reject_image" text,
  "qa_date" text
,
  CONSTRAINT "uq_webxl_task_links_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_task_log_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_task_log_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "task_id" text,
  "status" text,
  "time" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_task_log_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_tasks_list" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_tasks_list',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "department_id" text,
  "group_id" text,
  "name" text,
  "detail" text,
  "hours" text,
  "mins" text,
  "repeat_task" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_tasks_list_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_team_balance_leaves" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_team_balance_leaves',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "available_leaves" text,
  "leave_reason" text,
  "manager_approval" text,
  "hod_approval" text,
  "account_approval" text,
  "reject_reason" text,
  "is_approved" text,
  "is_resubmit" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_team_balance_leaves_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_tem_gm" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_tem_gm',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "cname" text,
  "user_id" text,
  "amount" text,
  "amount_type" text,
  "reasion" text,
  "status" text,
  "comment" text,
  "add_by" text,
  "create_at" text,
  "delete_date" text
,
  CONSTRAINT "uq_webxl_tem_gm_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_tem_salary_ship" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_tem_salary_ship',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "grossSalary" text,
  "present" text,
  "leave" text,
  "cuttingMin" text,
  "pendingLeave" text,
  "pendingleavesrupes" text,
  "vas" text,
  "commission3" text,
  "alibaba" text,
  "projectCommission" text,
  "pppcommission" text,
  "postingCommission" text,
  "overtimemin" text,
  "overtimers" text,
  "reward" text,
  "basicCutting" text,
  "tcutting" text,
  "penalty" text,
  "totalSalary" text,
  "create_date" text,
  "cus_paid_leave" text,
  "cus_unpaid_leave" text,
  "user_salary_status" text,
  "status_date" text
,
  CONSTRAINT "uq_webxl_tem_salary_ship_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_temp_visit" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_temp_visit',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "coname" text,
  "name" text,
  "designation" text,
  "phone" text,
  "cinc" text,
  "email" text,
  "website" text,
  "guide_person" text,
  "service" text,
  "status" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_temp_visit_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_terget" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_terget',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "terget_id" text,
  "terget_name" text,
  "target_number" text,
  "bonus" text,
  "conversion" text,
  "price" text,
  "max_amount" text,
  "detail" text,
  "package" text,
  "reward" text,
  "kwa" text,
  "vas" text,
  "pleanty" text,
  "type" text,
  "start_date" text,
  "end_date" text,
  "create_data" text
,
  CONSTRAINT "uq_webxl_terget_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_todo_list" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_todo_list',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "category" text,
  "priority" text,
  "time" text,
  "end_date" text,
  "task_tile" text,
  "task_des" text,
  "reminder" text,
  "repeat_alert" text,
  "received" text,
  "status" text,
  "partici" text,
  "partici_status" text,
  "to_do_file" text,
  "ref_task" text,
  "sub_task_title" text,
  "sub_task_des" text,
  "sub_task_time" text,
  "sub_task_date" text,
  "sub_task_priority" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_todo_list_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_training_thumbnail" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_training_thumbnail',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "title" text,
  "img" text,
  "status" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_training_thumbnail_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_training_video" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_training_video',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "video_cat" text,
  "title" text,
  "desc" text,
  "url" text,
  "status" text,
  "rank" text,
  "user_id" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_training_video_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_training_videos" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_training_videos',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "category_id" text,
  "sub_category_id" text,
  "title" text,
  "description" text,
  "video_url" text,
  "status" text,
  "order" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_training_videos_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_user" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_user',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "user_id" text,
  "att_id" text,
  "name" text,
  "fname" text,
  "email" text,
  "officeNumber" text,
  "guardiansNumber" text,
  "cinc" text,
  "joinDate" text,
  "serviceYears" text,
  "basicSalary" text,
  "dailyAll" text,
  "mobileAll" text,
  "conveyanceAll" text,
  "adminAll" text,
  "netSalary" text,
  "relaxationMin" text,
  "timeIn" text,
  "timeOut" text,
  "facebookId" text,
  "dob" text,
  "roleId" text,
  "underWork" text,
  "salary_distribution" text,
  "address" text,
  "gender" text,
  "picture" text,
  "country" text,
  "increment" text,
  "branch" text,
  "allowed_branch" text,
  "doc" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_user_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_user_actions" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_user_actions',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "type" text,
  "message" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_user_actions_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_vas" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_vas',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "amount" text,
  "mouth" text,
  "year" text,
  "last_update" text
,
  CONSTRAINT "uq_webxl_vas_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_vas_comm_final" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_vas_comm_final',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "user_id" text,
  "comm_type" text,
  "dep" text,
  "target" text,
  "total_amount" text,
  "per" text,
  "comm" text,
  "reward" text,
  "team_reward" text,
  "final_pay_amount" text,
  "user_status" text,
  "user_status_date" text,
  "manager_approve" text,
  "manager_approve_date" text,
  "comm_month" text,
  "comm_year" text,
  "rewardcomment" text,
  "hod_status" text,
  "hod_satatus_date" text,
  "account_pay_status" text,
  "account_pay_date" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_vas_comm_final_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_verify_gm" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_verify_gm',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "package" text,
  "price" text,
  "package_price" text,
  "amount" text,
  "customer_dollars" text,
  "dollar_rate" text,
  "discount" text,
  "extra_discount" text,
  "extra_pkr_discount" text,
  "com_id" text,
  "used_quo_id" text,
  "child_ids" text,
  "user_id" text,
  "sp_id" text,
  "add_by" text,
  "member_id" text,
  "order_id" text,
  "status" text,
  "coments" text,
  "create_request" text,
  "create_date" text,
  "acc_disc_status" text,
  "acc_pay_status" text,
  "ceo_disc_status" text,
  "ceo_extra_discout" text,
  "ceo_disc_date" text,
  "webxl_pay_status" text,
  "webxl_pay_date" text,
  "alibaba" text,
  "renwal" text,
  "expire_date" text,
  "extension" text,
  "droupout" text,
  "webxl_behalf" text,
  "pay_date" text,
  "finalComm" text,
  "updateBy" text,
  "screen_shot" text,
  "gm_update_request" text,
  "gm_update_status" text,
  "service_manager_status" text,
  "gm_update_comment" text,
  "gm_update_by" text,
  "gm_update_app_com" text,
  "gm_update_app_date" text,
  "approved_by" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_verify_gm_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_verify_gm_cash" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_verify_gm_cash',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "gmid" text,
  "pkr" text,
  "total_balance" text,
  "user_id" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_verify_gm_cash_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_verify_gm_delay_amount" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_verify_gm_delay_amount',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "gmid" text,
  "delay_dollars" text,
  "delay_pkr" text,
  "delay_dollar_status" text,
  "recovery_type" text,
  "user_id" text,
  "cheque_no" text,
  "pay_date" text,
  "create_at" text,
  "current_dollar_rate" text,
  "current_dollar_pay" text,
  "current_pkr" text,
  "balance" text,
  "pay_by" text,
  "cash_status" text,
  "acc_status" text,
  "current_pay_date" text,
  "alibaba" text,
  "ab_pay_date" text,
  "ab_pay_dollar" text,
  "cus_profit" text,
  "cus_dollar_rate" text,
  "pay_dollar_rate" text,
  "pay_pkr" text,
  "buyer_detail" text,
  "pay_type" text,
  "pay_detail" text,
  "ab_confirm_status" text,
  "ab_confirm_date" text,
  "ab_confirm_detail" text,
  "ab_confirm_by" text
,
  CONSTRAINT "uq_webxl_verify_gm_delay_amount_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_verify_gm_delay_amount_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_verify_gm_delay_amount_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "history_id" text,
  "original_id" text,
  "com_id" text,
  "gmid" text,
  "delay_dollars" text,
  "delay_pkr" text,
  "delay_dollar_status" text,
  "recovery_type" text,
  "user_id" text,
  "cheque_no" text,
  "pay_date" text,
  "create_at" text,
  "current_dollar_rate" text,
  "current_dollar_pay" text,
  "current_pkr" text,
  "balance" text,
  "pay_by" text,
  "cash_status" text,
  "acc_status" text,
  "current_pay_date" text,
  "alibaba" text,
  "ab_pay_date" text,
  "ab_pay_dollar" text,
  "cus_profit" text,
  "cus_dollar_rate" text,
  "pay_dollar_rate" text,
  "pay_pkr" text,
  "buyer_detail" text,
  "pay_type" text,
  "pay_detail" text,
  "ab_confirm_status" text,
  "ab_confirm_date" text,
  "ab_confirm_detail" text,
  "ab_confirm_by" text,
  "recorded_at" text,
  "recorded_by" text,
  "operation" text
,
  CONSTRAINT "uq_webxl_verify_gm_delay_amount_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_verify_gm_history" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_verify_gm_history',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "history_id" text,
  "original_id" text,
  "package" text,
  "price" text,
  "package_price" text,
  "amount" text,
  "customer_dollars" text,
  "dollar_rate" text,
  "discount" text,
  "extra_discount" text,
  "extra_pkr_discount" text,
  "com_id" text,
  "child_ids" text,
  "user_id" text,
  "add_by" text,
  "member_id" text,
  "order_id" text,
  "status" text,
  "coments" text,
  "create_request" text,
  "create_date" text,
  "acc_disc_status" text,
  "acc_pay_status" text,
  "ceo_disc_status" text,
  "ceo_extra_discout" text,
  "ceo_disc_date" text,
  "webxl_pay_status" text,
  "webxl_pay_date" text,
  "alibaba" text,
  "renwal" text,
  "expire_date" text,
  "extension" text,
  "droupout" text,
  "webxl_behalf" text,
  "pay_date" text,
  "finalComm" text,
  "updateBy" text,
  "screen_shot" text,
  "gm_update_request" text,
  "gm_update_status" text,
  "service_manager_status" text,
  "gm_update_comment" text,
  "gm_update_by" text,
  "gm_update_app_com" text,
  "gm_update_app_date" text,
  "approved_by" text,
  "updated_at" text,
  "recorded_at" text,
  "recorded_by" text,
  "operation" text
,
  CONSTRAINT "uq_webxl_verify_gm_history_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_video_category" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_video_category',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "category_name" text,
  "category_slug" text,
  "category_thumbnail" text,
  "category_status" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_video_category_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_video_sub_category" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_video_sub_category',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "category_id" text,
  "category_name" text,
  "category_slug" text,
  "category_thumbnail" text,
  "category_status" text,
  "created_by" text,
  "created_at" text,
  "updated_at" text
,
  CONSTRAINT "uq_webxl_video_sub_category_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_visit_meeting" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_visit_meeting',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "com_id" text,
  "user_id" text,
  "status" text,
  "per_status" text,
  "per_com" text,
  "service" text,
  "start_time" text,
  "end_time" text,
  "note" text,
  "per_start_time" text,
  "per_end_time" text,
  "manager" text,
  "com" text,
  "create_at" text,
  "manager_approve" text
,
  CONSTRAINT "uq_webxl_visit_meeting_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_whatsapp" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_whatsapp',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "cat" text,
  "title" text,
  "message" text,
  "status" text,
  "create_date" text
,
  CONSTRAINT "uq_webxl_whatsapp_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

CREATE TABLE IF NOT EXISTS legacy_archive."webxl_work_space" (
  "_archive_row_id" bigserial PRIMARY KEY,
  "_legacy_pk" text NOT NULL,
  "_legacy_pk_column" text NOT NULL,
  "_source_database" text NOT NULL DEFAULT 'ndrm',
  "_source_table" text NOT NULL DEFAULT 'webxl_work_space',
  "_ingested_at" timestamptz,
  "_mig_batch_id" uuid,
  "id" text,
  "name" text,
  "ref_id" text,
  "type" text,
  "create_at" text
,
  CONSTRAINT "uq_webxl_work_space_legacy_pk" UNIQUE (_source_table, _legacy_pk)
);

GRANT USAGE ON SCHEMA legacy_archive TO drm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA legacy_archive TO drm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA legacy_archive TO drm_app;
