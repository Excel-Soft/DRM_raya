# WebExcels DRM — UAT Sign-off Matrix (Stage 10, section I)

Fill **Actual result**, **Status** (Pass/Fail/Blocked), **Tester**, and **Notes**
during UAT. "Expected result" reflects the intended behavior after Stages 1–10.

| Module | Scenario | Role | Route / API | Expected result | Actual result | Status | Tester | Notes |
|---|---|---|---|---|---|---|---|---|
| Auth | Valid login | any | `POST /api/auth/login` | 200 + token; lands on dashboard | | | | |
| Auth | Invalid/expired token | any | any `/api/*` | 401; client redirects to login | | | | |
| Permissions | Unauthorized route (direct nav) | non-admin | e.g. `/admin/audit-logs` | client redirect; API 403 | | | | |
| Permissions | Sidebar reflects role | any | `app-sidebar` | only permitted modules visible | | | | |
| Invoice | Create → HOD → Account → Paid | sales/HOD/account | invoice routes | each transition succeeds + audited | | | | |
| Invoice | Reject without remarks | HOD | invoice reject | rejected: remarks required | | | | |
| Approval | Approval modal requires reason | approver | shared modal | submit blocked until remarks present | | | | |
| Workflow | Assignment→evidence→complete→QA→verify | mgr/QA/verif | product/software routes | full chain transitions; role enforced | | | | |
| Workflow | Wrong-stage action forced | any | workflow API | backend rejects (4xx) | | | | |
| Cross-dept | Invoice ↔ project link | mgr | link report | link visible both directions | | | | |
| Follow-up | Communication + reminder logged | service | communication routes | logged + appears in audit | | | | |
| Service | Follow-up complete needs outcome | service | `PATCH /api/service/followups/:id/complete` | 400 when outcome missing | | | | |
| Service | Dropout create needs reason | service | `POST /api/service/dropouts` | 400 when reason missing | | | | |
| Service | Renewal create needs fields | service | `POST /api/service/renewals` | 400 when fields missing | | | | |
| Service | Complaint closure | service | complaint close | requires resolution remark | | | | |
| Financial/GM/BV | GM approval/rejection | gm approver | gm routes | records; legacy bridge → 501 | | | | |
| Reports | Filter + export | any with access | report routes | export respects filters | | | | |
| Reports | Loading/empty/error states | any | data tables | all three states render | | | | |
| HR/Salary | Leave/overtime/loan approval | hr/mgr | hr routes | approval gated + audited | | | | |
| UI | Breadcrumb/title on major screens | any | pages | title/breadcrumb present | | | | |
| UI | No alert() on converted screens | any | top-bar, dashboards | toast/inline used | | | | |
| Audit | Audit viewer access | admin/super_admin/super_hod | `GET /api/audit-logs` | 200 for allowed; 403 otherwise | | | | |
| Audit | Sensitive action logged | admin | `/admin/audit-logs` | action appears after performing it | | | | |
