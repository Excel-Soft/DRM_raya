# Wave 7 — projects, CRM pool, meetings, finance, HR

| Module | Source → Target |
|--------|-----------------|
| create_project | `projects` |
| servicepool | `legacy_servicepool` |
| visit_meeting | `meetings` |
| cheque_system | `cheques` |
| penalty | `penalties` |
| notice_board | `legacy_notice_board` |
| advance_salary | `loan_requests` |
| dollar_pay | `legacy_dollar_pay` |
| pay_loan | `legacy_loan_payments` |
| donation | `donations` |
| allowed_ip | `allowed_ips` |

`bash scripts/migration/run-wave7-all-sequential.sh` → `/tmp/wave7-migrate.log`
