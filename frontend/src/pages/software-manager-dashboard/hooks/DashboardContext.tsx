// @ts-nocheck

import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, Users, ArrowRightLeft, Tag, Compass,
  PlusCircle, RefreshCw, Filter, ChevronRight,
  Activity, TrendingUp, Clock, CheckCircle2, ArrowRight, Search, Trash2, X
} from "lucide-react";

const DashboardContext = createContext<any>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {

  const queryClient = useQueryClient();
  const [location] = useLocation();
  const searchString = useSearch();
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({ purpose: "", type: "", alternative: "", day: "", time: "", start: "", end: "", detail: "" });
  const [activeTab, setActiveTab] = useState<TabType>("waiting");
  const [currentView, setCurrentView] = useState<SoftwareManagerView>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    return (view as SoftwareManagerView) || "dashboard";
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const view = params.get("view");
    if (view) {
      setCurrentView(view as SoftwareManagerView);
    } else {
      setCurrentView("dashboard");
    }
  }, [searchString]);
  const [pmsSearch, setPmsSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [runningProjectSearch, setRunningProjectSearch] = useState("");
  const [projectReportSearch, setProjectReportSearch] = useState("");
  const [projectReportCompany, setProjectReportCompany] = useState("");
  const [projectReportStartDate, setProjectReportStartDate] = useState("");
  const [projectReportEndDate, setProjectReportEndDate] = useState("");
  const [depDepartment, setDepDepartment] = useState("");
  const [depCity, setDepCity] = useState("");
  const [depStatus, setDepStatus] = useState("");
  const [depStartDate, setDepStartDate] = useState("");
  const [depEndDate, setDepEndDate] = useState("");
  const [overtimeSearch, setOvertimeSearch] = useState("");
  const [selectedOvertimeRowId, setSelectedOvertimeRowId] = useState<string | null>(null);
  const [showOvertimeActionModal, setShowOvertimeActionModal] = useState(false);
  const [overtimeStatus, setOvertimeStatus] = useState("");
  const [loanApplicationSearch, setLoanApplicationSearch] = useState("");
  const [performanceUser, setPerformanceUser] = useState("");
  const [performanceStartDate, setPerformanceStartDate] = useState("");
  const [performanceEndDate, setPerformanceEndDate] = useState("");
  const [showLateMinuteForm, setShowLateMinuteForm] = useState(false);
  const [lateComingSearch, setLateComingSearch] = useState("");
  const [projectListSearch, setProjectListSearch] = useState("");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [topSellingFilter, setTopSellingFilter] = useState("monthly");
  const [commissionTab, setCommissionTab] = useState<CommissionTab>("approved");
  const [showCommissionColumnMenu, setShowCommissionColumnMenu] = useState(false);
  const [visibleCommissionColumns, setVisibleCommissionColumns] = useState<Record<string, boolean>>({
    "No#": true,
    Date: true,
    Person: true,
    Status: true,
    "Commission Type": true,
    Amount: true,
    "%": true,
    Commission: true,
    Reward: true,
    "Team Reward": true,
    Pay: true,
    Total: true,
    Action: true,
  });
  const [lateComingRows, setLateComingRows] = useState<
    Array<{ no: string; name: string; task: string; time: string; taskDetail: string; create: string }>
  >([]);
  const [selectedLeaveRowNo, setSelectedLeaveRowNo] = useState<string | null>(null);
  const [showLeaveApplicationModal, setShowLeaveApplicationModal] = useState(false);
  const [showLeaveDecisionOptions, setShowLeaveDecisionOptions] = useState(false);
  const [leaveDecision, setLeaveDecision] = useState("");
  const [selectedTeamBalanceRowNo, setSelectedTeamBalanceRowNo] = useState<number | null>(null);
  const [showProcessLeaveModal, setShowProcessLeaveModal] = useState(false);
  const [processLeaveStatus, setProcessLeaveStatus] = useState("");
  const [processLeaveComments, setProcessLeaveComments] = useState("");
  const [lateMinuteForm, setLateMinuteForm] = useState({
    person: "",
    purpose: "",
    timeInMinutes: "",
    detail: "",
  });
  const [taskForm, setTaskForm] = useState({
    name: "",
    group: "Main",
    department: "",
    hours: "00",
    minutes: "00",
    detail: "",
    repeatDaily: false,
  });

  // ── Real software-workflow backend wiring ──
  // `/api/software/manager/queue` = live verification/assignment queue (one row per project
  // workflow) used to drive the Waiting/Delay/Approved tabs, the assign/verify actions and the
  // top summary cards.
  const { data: managerQueueRes, isLoading: isManagerQueueLoading } = useQuery({
    queryKey: ["/api/software/manager/queue"],
  });
  const managerQueueRows: any[] = (managerQueueRes as any)?.data || [];

  // `/api/software/manager/execution-rows` = reporting view (assignee, time spent, evidence,
  // rework history) reused from the same engine that already powers the QA/Verification queues,
  // used for Daily Report / Monthly Complete Project.
  const { data: executionRowsRes, isLoading: isExecutionRowsLoading } = useQuery({
    queryKey: ["/api/software/manager/execution-rows"],
  });
  const executionRows: any[] = (executionRowsRes as any)?.data || [];

  const { data: softwareUsersRes } = useQuery({
    queryKey: ["/api/users", { role: "all" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?role=all");
      return res.json();
    },
  });
  const softwareExecutives: any[] = ((softwareUsersRes as any)?.users || []).filter(
    (u: any) => u.role === "software_executive" || u.roleId === "software_executive",
  );

  // Real overtime + leave data (already the two working endpoints in this dashboard) — moved up
  // here so the summary/leave widgets further down can all read from the same single fetch.
  const { data: rawOvertimeData = [] } = useQuery<any[]>({ queryKey: ["/api/admin/overtime"] });
  const { data: rawLeaveData = [] } = useQuery<any[]>({ queryKey: ["/api/admin/leaves"] });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({ assigneeId: "", title: "", hours: "0", minutes: "0", links: "" });
  const [workflowActionError, setWorkflowActionError] = useState<string | null>(null);

  const openAssignModal = (row: any) => {
    setAssignTarget(row);
    setAssignForm({ assigneeId: "", title: row.project?.name || "", hours: "0", minutes: "0", links: "" });
    setWorkflowActionError(null);
    setAssignModalOpen(true);
  };

  const verifyProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("POST", `/api/software/workflows/${projectId}/transition`, {
        status: "APPROVED",
        notes: "Verified by Software Manager",
      });
      await throwIfResNotOk(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/software/manager/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/software/manager/execution-rows"] });
    },
    onError: (error: Error) => setWorkflowActionError(error.message),
  });

  const assignTaskMutation = useMutation({
    mutationFn: async () => {
      if (!assignTarget?.project?.id) throw new Error("No project selected");
      const durationMinutes = (Number(assignForm.hours) || 0) * 60 + (Number(assignForm.minutes) || 0);
      const res = await apiRequest("POST", `/api/software/projects/${assignTarget.project.id}/assign-task`, {
        assigneeId: assignForm.assigneeId,
        title: assignForm.title || assignTarget.project?.name,
        description: assignTarget.project?.description || "",
        assignedDurationMinutes: durationMinutes,
        links: assignForm.links,
      });
      await throwIfResNotOk(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/software/manager/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/software/manager/execution-rows"] });
      setAssignModalOpen(false);
    },
    onError: (error: Error) => setWorkflowActionError(error.message),
  });

  const [leaveReportUser, setLeaveReportUser] = useState("");
  const [leaveReportStart, setLeaveReportStart] = useState("");
  const [leaveReportEnd, setLeaveReportEnd] = useState("");
  const [overtimeReportUser, setOvertimeReportUser] = useState("");
  const [overtimeReportStart, setOvertimeReportStart] = useState("");
  const [overtimeReportEnd, setOvertimeReportEnd] = useState("");
  const [overtimeReportPage, setOvertimeReportPage] = useState(1);
  const OVERTIME_REPORT_PAGE_SIZE = 10;
  const [monthlyProjectPeriod, setMonthlyProjectPeriod] = useState<"WK" | "MON">("MON");

  const projectOverviewButtons: string[] = [
    "Pms Setting", "Task Create",
    "Running Project", "Pending Project",
    "Project Task", "Team Reports",
    "Project Report", "Dep Projects",
    "Over Time", "Loan Application",
    "Performance", "Late Coming",
    "Project List", "Commission Verification",
  ];

  // Real phase counts from the live software-workflow queue (`/api/software/manager/queue`).
  const upcomingCount = managerQueueRows.filter((row) => row.currentPhase === "PENDING_PROJECT").length;
  const inProgressCount = managerQueueRows.filter((row) => row.currentPhase === "RUNNING_PROJECT").length;
  const completedCount = managerQueueRows.filter((row) => row.currentPhase === "VERIFICATION_COMPLETE").length;
  const qcVerificationCount = managerQueueRows.filter((row) => row.currentPhase === "QA_REVIEW").length;
  const depVerificationCount = managerQueueRows.filter((row) => row.currentPhase === "VERIFICATION_PENDING").length;
  const pendingLeaveCount = (rawLeaveData as any[]).filter((item) => (item.status || "Pending") === "Pending").length;

  const importantItems: [string, string, string?][] = [
    ["Upcoming", String(upcomingCount)], ["In Progress", String(inProgressCount)],
    ["Completed", String(completedCount)], ["Qc Verification", String(qcVerificationCount)],
    ["Dep Verification", String(depVerificationCount), depVerificationCount > 0 ? "text-red-500" : undefined],
    ["Leave Application", String(pendingLeaveCount)],
  ];

  // NOTE (left mocked intentionally): "Team Work Performance" below uses CRM/sales columns
  // (Leads, Follow, A-/B+/B/B- Customer grade, Call Connected, Appointment, Meeting) that have no
  // equivalent in the software-workflow schema (software_workflows / tasks / task_time_logs only
  // track phase, assigned/spent minutes and evidence links — there is no lead/appointment/customer
  // grading concept for a software executive). There is no evidenced business rule for what these
  // columns should mean for this role, so the original single demo row is left as-is rather than
  // guessing a mapping. Flagged in the task report.
  const teamRows = [
    { name: "Test", leads: 10, follow: 5, notFollow: 5, aCust: 2, bPlus: 1, bCust: 1, bMinus: 1, callConn: 5, notResp: 2, appoint: 5, meeting: 2 },
  ];

  const getStatRangeStart = (filter: string) => {
    const now = new Date();
    if (filter === "daily") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (filter === "weekly") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  };

  const getStatCards = () => {
    const rangeStart = getStatRangeStart(topSellingFilter);
    const rowsInRange = managerQueueRows.filter((row) => row.createdAt && new Date(row.createdAt) >= rangeStart);
    const totalProjectsCount = rowsInRange.length;
    const totalProjectsCompletedCount = rowsInRange.filter((row) => row.currentPhase === "VERIFICATION_COMPLETE").length;
    const verificationCount = managerQueueRows.filter(
      (row) => row.currentPhase === "DATA_VERIFY" && row.updatedAt && new Date(row.updatedAt) >= rangeStart,
    ).length;
    const taskCount = managerQueueRows.filter(
      (row) => ["TASK_ASSIGNMENT", "RUNNING_PROJECT"].includes(row.currentPhase) && row.updatedAt && new Date(row.updatedAt) >= rangeStart,
    ).length;
    const busyExecutiveIds = new Set(
      managerQueueRows.filter((row) => row.currentPhase === "RUNNING_PROJECT" && row.executiveUserId).map((row) => row.executiveUserId),
    );
    const freeExecutivesCount = Math.max(softwareExecutives.length - busyExecutiveIds.size, 0);

    return [
      { label: "Total Project", value: `${totalProjectsCount}(${totalProjectsCompletedCount})`, icon: Users, gradient: "from-emerald-500 to-teal-600", lightBg: "bg-emerald-50", textColor: "text-emerald-600" },
      { label: "Verification", value: String(verificationCount), icon: ArrowRightLeft, gradient: "from-blue-500 to-indigo-600", lightBg: "bg-blue-50", textColor: "text-blue-600" },
      { label: "Task", value: String(taskCount), icon: Tag, gradient: "from-violet-500 to-purple-600", lightBg: "bg-violet-50", textColor: "text-violet-600" },
      { label: "Free", value: String(freeExecutivesCount), icon: Compass, gradient: "from-amber-500 to-orange-500", lightBg: "bg-amber-50", textColor: "text-amber-600" },
    ];
  };

  const statCards = getStatCards();

  // Verification & Assign Project queue — real rows bucketed by software_workflows.currentPhase,
  // sourced from the same /api/software/manager/queue used for the summary cards above.
  const waitingQueueRows = managerQueueRows.filter((row) => row.currentPhase === "DATA_VERIFY");
  const delayQueueRows = managerQueueRows.filter((row) => row.currentPhase === "RETURNED_FOR_CHANGE");
  const approvedQueueRows = managerQueueRows.filter((row) => ["PROJECT_OVERVIEW", "TASK_ASSIGNMENT"].includes(row.currentPhase));

  const todayLeaveQueueRows = (rawLeaveData as any[]).filter((item) => {
    if (!item.fromDate || !item.toDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(item.fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(item.toDate);
    to.setHours(0, 0, 0, 0);
    return today >= from && today <= to;
  });

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: "waiting", label: "Waiting", badge: waitingQueueRows.length },
    { key: "delay", label: "Delay", badge: delayQueueRows.length },
    { key: "approved", label: "Approved", badge: approvedQueueRows.length },
    { key: "today-leave", label: "Today Leave", badge: todayLeaveQueueRows.length },
    { key: "team-yearly", label: "Team Yearly Leave" },
    { key: "team-balance", label: "Team Balance Leave" },
  ];

  // Stage 4 (spec J): fabricated PMS rows removed — no mock workflow state.
  // Renders an empty table until wired to a live PMS endpoint (deferred — see
  // PATCH3_STAGE4_WORKFLOW_TRANSITION_CHANGELOG.md).
  const pmsSettingRows: any[] = [];

  const filteredPmsRows = pmsSettingRows.filter((row) =>
    [row.no, row.company, row.person, row.project, row.status, row.docUpload, row.depApproved, row.action]
      .join(" ")
      .toLowerCase()
      .includes(pmsSearch.toLowerCase()),
  );

  const pmsHeaders = ["No#", "Company", "Person", "Project", "Status", "Doc Upload", "Dep Approved", "Action"];
  // Stage 4 (spec J): fabricated seed task rows removed — no mock workflow state.
  const [taskCreateRows, setTaskCreateRows] = useState<any[]>([]);

  const filteredTaskCreateRows = taskCreateRows.filter((row) =>
    [row.name, row.time, row.detail, row.repeatDaily].join(" ").toLowerCase().includes(taskSearch.toLowerCase()),
  );

  const exportPmsRows = (type: "copy" | "csv" | "excel" | "pdf") => {
    const rows = filteredPmsRows.length ? filteredPmsRows : pmsSettingRows;
    const body = rows.map((row) => [row.no, row.company, row.person, row.project, row.status, row.docUpload, row.depApproved, row.action]);

    if (type === "copy") {
      const text = [pmsHeaders.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1000,height=700");
      if (!printWindow) return;
      const tableRows = body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("");
      printWindow.document.write(`
        <html>
          <head><title>PMS Setting Report</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:16px;">List Of Project Activity</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${pmsHeaders.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#eef2f7;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [pmsHeaders.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "excel" ? "pms-setting-report.xls" : "pms-setting-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openDeleteTaskModal = (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;
    setTaskCreateRows((current) => current.filter((row) => row.id !== taskToDelete).map((row, index) => ({ ...row, no: index + 1 })));
    setTaskToDelete(null);
    setShowDeleteModal(false);
  };

  const saveNewTask = () => {
    if (!taskForm.name.trim()) return;
    setTaskCreateRows((current) => [
      ...current,
      {
        id: Date.now().toString(),
        no: current.length + 1,
        name: taskForm.name.trim(),
        time: `${taskForm.hours}:${taskForm.minutes}`,
        detail: taskForm.detail.trim(),
        repeatDaily: taskForm.repeatDaily ? "Yes" : "No",
      },
    ]);
    setTaskForm({
      name: "",
      group: "Main",
      department: "",
      hours: "00",
      minutes: "00",
      detail: "",
      repeatDaily: false,
    });
    setShowAddTaskModal(false);
  };

  const runningProjectTopBoxes = [
    {
      title: "Upcoming Projects",
      headerClass: "bg-[#5ab77d]",
      columns: ["Company", "Project", "Status", "Person", "Create Date"],
    },
    {
      title: "Running Projects",
      headerClass: "bg-[#cda77f]",
      columns: ["Company", "Project", "Status", "Time", "Assign", "Assign Date", "Link"],
    },
    {
      title: "Completed Projects",
      headerClass: "bg-[#eceff4]",
      columns: ["Company", "Project", "Status", "Time", "Assign", "Assign Date", "Link"],
    },
  ];

  // Stage 4 (spec J): fabricated pending-project rows removed — no mock workflow
  // state. Renders an empty table until wired to the live software manager queue
  // (deferred — see PATCH3_STAGE4_WORKFLOW_TRANSITION_CHANGELOG.md).
  const pendingProjectRows: any[] = [];

  // Stage 4 (spec J): fabricated project-task rows removed — no mock workflow state.
  const projectTaskRows: any[] = [];

  // Stage 4 (spec J): fabricated project-report rows removed — no mock workflow
  // state (also removes the legacy "Alibaba Product Posting" strings).
  const projectReportRows: any[] = [];

  const filteredProjectReportRows = projectReportRows.filter((row) => {
    const matchesSearch = [row.project, row.method, row.hod, row.name, row.id, row.person, row.package].join(" ").toLowerCase().includes(projectReportSearch.toLowerCase());
    const matchesCompany = !projectReportCompany || row.name.toLowerCase().includes(projectReportCompany.toLowerCase());
    const matchesStart = !projectReportStartDate || row.create2 >= projectReportStartDate.split("-").reverse().join("-");
    const matchesEnd = !projectReportEndDate || row.create2 <= projectReportEndDate.split("-").reverse().join("-");
    return matchesSearch && matchesCompany && matchesStart && matchesEnd;
  });

  // Stage 4 (spec J): fabricated department-project rows removed — no mock workflow state.
  const departmentProjectRows: any[] = [];

  const filteredDepartmentProjectRows = departmentProjectRows.filter((row) => {
    const matchesDepartment = !depDepartment || row.department === depDepartment;
    const matchesCity = !depCity || row.city === depCity;
    const matchesStatus = !depStatus || row.status === depStatus;
    const matchesStart = !depStartDate || row.createdAt.slice(0, 10) >= depStartDate;
    const matchesEnd = !depEndDate || row.createdAt.slice(0, 10) <= depEndDate;
    return matchesDepartment && matchesCity && matchesStatus && matchesStart && matchesEnd;
  });

  const overtimeRows = rawOvertimeData.map((item: any, idx: number) => ({
    id: item.id,
    no: (idx + 1).toString(),
    name: item.userName || item.userId || "Unknown",
    task: item.taskTitle,
    time: item.timeSpent?.toString() || "0",
    detail: item.taskDetails || "",
    manager: item.status,
    create: new Date(item.createdAt).toLocaleString(),
    // Raw ISO value for date-range filtering below — `create` above is
    // already locale-formatted for display (e.g. "29/5/2026, 21:41"),
    // and re-parsing a locale string with `new Date()` isn't reliably
    // supported outside en-US, causing `RangeError: Invalid time value`
    // once `.toISOString()` ran on the resulting Invalid Date.
    createdAtRaw: item.createdAt,
  }));

  const filteredOvertimeRows = overtimeRows.filter((row: any) =>
    [row.no, row.name, row.task, row.time, row.detail, row.manager, row.create]
      .join(" ")
      .toLowerCase()
      .includes(overtimeSearch.toLowerCase()),
  );

  const selectedOvertimeRow = overtimeRows.find((row: any) => row.id === selectedOvertimeRowId) ?? null;

  const openOvertimeActionModal = (rowId: string) => {
    setSelectedOvertimeRowId(rowId);
    setOvertimeStatus("");
    setShowOvertimeActionModal(true);
  };

  const { mutate: mutateOvertime } = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string, action: string, reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/overtime/${id}/${action}`, { reason });
      if (!res.ok) throw new Error("Failed to update overtime");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtime"] });
      setShowOvertimeActionModal(false);
    }
  });

  const saveOvertimeStatus = () => {
    if (!selectedOvertimeRowId || !overtimeStatus) {
      setShowOvertimeActionModal(false);
      return;
    }

    if (overtimeStatus === "Approved") {
      mutateOvertime({ id: selectedOvertimeRowId, action: "approve" });
    } else if (overtimeStatus === "Rejected") {
      mutateOvertime({ id: selectedOvertimeRowId, action: "reject" });
    } else {
      setShowOvertimeActionModal(false);
    }
  };

  const loanApplicationDepartments = [
    "Sales Department",
    "Sales Department",
    "Sales Department",
    "Sales Department",
    "Sales Department",
    "D&D Department",
    "D&D Department",
    "Accounts Department",
    "Accounts Department",
    "Deactive",
    "Deactive",
    "D&D Department",
    "D&D Department",
    "Deactive",
    "Deactive",
  ];

  const loanApplicationHeaders = ["No#", "Employee", "Advance", "Detail", "Instalment", "Remaining", "Manager", "Hod", "Date", "Action"];
  const { data: rawLoanData = [] } = useQuery<any[]>({ queryKey: ["/api/admin/loans"] });
  const loanApplicationRows = rawLoanData.map((item: any, idx: number) => ({
    no: (idx + 1).toString(),
    employee: item.userName || item.userId || "Unknown",
    advance: item.amount,
    detail: item.detail || "No details",
    instalment: item.installmentAmount,
    remaining: item.remainingAmount,
    manager: item.status === "Pending" ? "Pending" : "Approved",
    hod: item.status === "HODApproved" || item.status === "Completed" ? "Approved" : "Pending",
    date: new Date(item.createdAt).toLocaleDateString(),
    action: "View",
  }));

  const filteredLoanApplicationRows = loanApplicationRows.filter((row) =>
    [row.no, row.employee, row.advance, row.detail, row.instalment, row.remaining, row.manager, row.hod, row.date, row.action]
      .join(" ")
      .toLowerCase()
      .includes(loanApplicationSearch.toLowerCase()),
  );

  const exportLoanApplicationRows = (type: "copy" | "csv" | "excel" | "pdf") => {
    const rows = filteredLoanApplicationRows.length ? filteredLoanApplicationRows : loanApplicationRows;
    const body = rows.map((row) => [
      row.no,
      row.employee,
      row.advance,
      row.detail,
      row.instalment,
      row.remaining,
      row.manager,
      row.hod,
      row.date,
      row.action,
    ]);

    if (type === "copy") {
      const text = [loanApplicationHeaders.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1100,height=700");
      if (!printWindow) return;
      const tableRows = body.length
        ? body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${loanApplicationHeaders.length}" style="border:1px solid #dbe3ef;padding:12px;font-size:12px;">No data available in table</td></tr>`;
      printWindow.document.write(`
        <html>
          <head><title>Advance Salary List</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:8px;">Advance Salary List</h2>
            <div style="margin-bottom:16px;font-size:12px;color:#475569;">${loanApplicationDepartments.join(" ")}</div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${loanApplicationHeaders.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#eef2f7;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [loanApplicationHeaders.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "excel" ? "advance-salary-list.xls" : "advance-salary-list.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Stage 4 (spec J): fabricated performance rows removed — no mock workflow state.
  const performanceRows: any[] = [];

  const filteredPerformanceRows = performanceRows.filter((row) => {
    const matchesUser = !performanceUser || row.user === performanceUser;
    const rowDate = row.date.slice(0, 10);
    const matchesStart = !performanceStartDate || rowDate >= performanceStartDate;
    const matchesEnd = !performanceEndDate || rowDate <= performanceEndDate;
    return matchesUser && matchesStart && matchesEnd;
  });

  const filteredLateComingRows = lateComingRows.filter((row) =>
    [row.no, row.name, row.task, row.time, row.taskDetail, row.create]
      .join(" ")
      .toLowerCase()
      .includes(lateComingSearch.toLowerCase()),
  );

  const projectListHeaders = [
    "No#",
    "Create",
    "Action",
    "Company",
    "Person",
    "City",
    "Project",
    "Item Status",
    "Finish",
    "Qa",
    "Verification",
    "Method",
    "Department",
    "Status",
    "Item Time",
    "Project Time",
    "Links",
    "Upload",
    "Task",
    "Package",
    "Type",
    "Cash Status",
  ];

  // Stage 4 (spec J): fabricated project-list rows removed — no mock workflow state.
  const projectListRows: any[] = [];

  const filteredProjectListRows = projectListRows.filter((row) =>
    Object.values(row).join(" ").toLowerCase().includes(projectListSearch.toLowerCase()),
  );

  const commissionHeaders = [
    "No#",
    "Date",
    "Person",
    "Status",
    "Commission Type",
    "Amount",
    "%",
    "Commission",
    "Reward",
    "Team Reward",
    "Pay",
    "Total",
    "Action",
  ];

  const commissionRows: Array<{
    no: string;
    date: string;
    person: string;
    status: string;
    commissionType: string;
    amount: string;
    percent: string;
    commission: string;
    reward: string;
    teamReward: string;
    pay: string;
    total: string;
    action: string;
    tab: CommissionTab;
  }> = [];

  const filteredCommissionRows = commissionRows.filter((row) => {
    const matchesTab = row.tab === commissionTab;
    const matchesSearch = [
      row.no,
      row.date,
      row.person,
      row.status,
      row.commissionType,
      row.amount,
      row.percent,
      row.commission,
      row.reward,
      row.teamReward,
      row.pay,
      row.total,
      row.action,
    ]
      .join(" ")
      .toLowerCase()
      .includes(commissionSearch.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const upcomingHeaders = ["Company", "Project", "Status", "Person", "Create Date"];
  const upcomingRows: Array<{
    company: string;
    project: string;
    status: string;
    person: string;
    createDate: string;
  }> = [];

  const exportUpcomingRows = (type: "copy" | "excel" | "pdf") => {
    const body = upcomingRows.map((row) => [row.company, row.project, row.status, row.person, row.createDate]);

    if (type === "copy") {
      const text = [upcomingHeaders.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1000,height=700");
      if (!printWindow) return;
      const tableRows = body.length
        ? body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${upcomingHeaders.length}" style="border:1px solid #dbe3ef;padding:12px;font-size:12px;">No data available in table</td></tr>`;
      printWindow.document.write(`
        <html>
          <head><title>Upcoming Project</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:16px;">Upcoming Project</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${upcomingHeaders.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#d9f3ec;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [upcomingHeaders.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "upcoming-project.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const inProgressHeaders = ["Company", "Project", "Status", "Time", "Assign", "Assign Date", "Link"];
  const inProgressRows: Array<{
    company: string;
    project: string;
    status: string;
    time: string;
    assign: string;
    assignDate: string;
    link: string;
  }> = [];

  const exportInProgressRows = (type: "copy" | "excel" | "pdf") => {
    const body = inProgressRows.map((row) => [row.company, row.project, row.status, row.time, row.assign, row.assignDate, row.link]);

    if (type === "copy") {
      const text = [inProgressHeaders.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1000,height=700");
      if (!printWindow) return;
      const tableRows = body.length
        ? body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${inProgressHeaders.length}" style="border:1px solid #dbe3ef;padding:12px;font-size:12px;">No data available in table</td></tr>`;
      printWindow.document.write(`
        <html>
          <head><title>Running Projects</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:16px;">Running Projects</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${inProgressHeaders.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#d9f3ec;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [inProgressHeaders.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "running-projects.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const completedHeaders = ["Company", "Project", "Status", "Time", "Assign", "Assign Date", "Link"];
  const completedRows: Array<{
    company: string;
    project: string;
    status: string;
    time: string;
    assign: string;
    assignDate: string;
    link: string;
  }> = [];

  const exportCompletedRows = (type: "copy" | "excel" | "pdf") => {
    const body = completedRows.map((row) => [row.company, row.project, row.status, row.time, row.assign, row.assignDate, row.link]);

    if (type === "copy") {
      const text = [completedHeaders.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1000,height=700");
      if (!printWindow) return;
      const tableRows = body.length
        ? body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${completedHeaders.length}" style="border:1px solid #dbe3ef;padding:12px;font-size:12px;">No data available in table</td></tr>`;
      printWindow.document.write(`
        <html>
          <head><title>Completed Projects</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:16px;">Completed Projects</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${completedHeaders.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#d9f3ec;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [completedHeaders.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "completed-projects.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const leaveApplicationHeaders = [
    "No",
    "Name",
    "Purpose",
    "Type",
    "Alternative",
    "Detail",
    "Monthly Leaves",
    "Monthly Half Leaves",
    "Day",
    "Time",
    "Start",
    "End",
    "Create",
    "Action",
  ];

  const { mutate: submitLeaveMutation } = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/leave", data);
      if (!res.ok) throw new Error("Failed to submit leave");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leaves"] });
      setNewLeaveForm({ purpose: "", type: "", alternative: "", day: "", time: "", start: "", end: "", detail: "" });
      setShowAddLeaveForm(false);
    }
  });

  const processLeaveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string | number; decision: string }) => {
      const endpoint = decision === "Approved" ? `/api/leaves/${id}/approve` : `/api/leaves/${id}/reject`;
      const res = await apiRequest("PATCH", endpoint);
      if (!res.ok) throw new Error("Failed to process leave");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leaves"] });
      closeLeaveApplicationModal();
    },
    onError: (error: Error) => {
      console.error(error);
      alert(error.message);
    }
  });

  const handleProcessLeaveSave = () => {
    if (!selectedLeaveRow) return;
    if (!leaveDecision || leaveDecision === "Choose...") {
      alert("Please select a decision");
      return;
    }
    processLeaveMutation.mutate({ id: selectedLeaveRow.no, decision: leaveDecision });
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitLeaveMutation({
      fromDate: newLeaveForm.start,
      toDate: newLeaveForm.end,
      type: newLeaveForm.type || "Full",
      reason: newLeaveForm.detail || newLeaveForm.purpose
    });
  };

  const leaveApplicationRows = rawLeaveData.map((item: any) => ({
    no: item.id,
    name: item.userName || item.userId || "Unknown",
    purpose: item.reason || "N/A",
    type: item.type || "Full",
    alternative: "-",
    detail: item.reason || "",
    monthlyLeaves: "0",
    monthlyHalfLeaves: "0",
    day: "1",
    time: "480",
    start: new Date(item.fromDate).toLocaleDateString(),
    end: new Date(item.toDate).toLocaleDateString(),
    create: new Date(item.createdAt).toLocaleString(),
    action: "+",
  }));

  const selectedLeaveRow = leaveApplicationRows.find((row) => row.no === selectedLeaveRowNo) ?? null;

  const openLeaveApplicationModal = (rowNo: string) => {
    setSelectedLeaveRowNo(rowNo);
    setLeaveDecision("");
    setShowLeaveDecisionOptions(false);
    setShowLeaveApplicationModal(true);
  };

  const closeLeaveApplicationModal = () => {
    setShowLeaveApplicationModal(false);
    setShowLeaveDecisionOptions(false);
  };

  const teamBalanceRows = [
    { no: 1, name: "Muhammad Habib Ahmed", leaves: 4, reason: "Test Leaves", ma: "Pending", hoda: "Pending", ap: "Pending", comment: "-", maColor: "text-amber-600" },
    { no: 2, name: "Fahad bin Khalid", leaves: 2, reason: "Test Leaves", ma: "rejected", hoda: "pending", ap: "pending", comment: "You have to submit again this request", maColor: "text-red-500" },
  ];

  const filteredTeamBalanceRows = teamBalanceRows.filter((row) =>
    [row.no, row.name, row.leaves, row.reason, row.ma, row.hoda, row.ap, row.comment]
      .join(" ")
      .toLowerCase()
      .includes(attendanceSearch.toLowerCase())
  );

  const selectedTeamBalanceRow = teamBalanceRows.find((row) => row.no === selectedTeamBalanceRowNo) ?? null;

  const openProcessLeaveModal = (rowNo: number) => {
    setSelectedTeamBalanceRowNo(rowNo);
    setProcessLeaveStatus("");
    setProcessLeaveComments("");
    setShowProcessLeaveModal(true);
  };

  const closeProcessLeaveModal = () => {
    setShowProcessLeaveModal(false);
  };

  const visibleCommissionHeaders = commissionHeaders.filter((header) => visibleCommissionColumns[header] !== false);

  const commissionRowValueMap = (row: (typeof commissionRows)[number]) => ({
    "No#": row.no,
    Date: row.date,
    Person: row.person,
    Status: row.status,
    "Commission Type": row.commissionType,
    Amount: row.amount,
    "%": row.percent,
    Commission: row.commission,
    Reward: row.reward,
    "Team Reward": row.teamReward,
    Pay: row.pay,
    Total: row.total,
    Action: row.action,
  });

  const exportCommissionRows = (type: "copy" | "excel" | "pdf") => {
    const rows = filteredCommissionRows;
    const headers = visibleCommissionHeaders;
    const body = rows.map((row) => {
      const valueMap = commissionRowValueMap(row);
      return headers.map((header) => valueMap[header as keyof typeof valueMap]);
    });

    if (type === "copy") {
      const text = [headers.join("\t"), ...body.map((row) => row.join("\t"))].join("\n");
      void navigator.clipboard.writeText(text);
      return;
    }

    if (type === "pdf") {
      const printWindow = window.open("", "_blank", "width=1200,height=700");
      if (!printWindow) return;
      const tableRows = body.length
        ? body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dbe3ef;padding:10px;font-size:12px;">${cell}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${headers.length}" style="border:1px solid #dbe3ef;padding:12px;font-size:12px;">No data available in table</td></tr>`;
      printWindow.document.write(`
        <html>
          <head><title>Commission Verification</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="margin-bottom:16px;">Commission Verification</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>${headers.map((head) => `<th style="border:1px solid #dbe3ef;padding:10px;background:#eef2f7;text-align:left;font-size:12px;">${head}</th>`).join("")}</tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const csv = [headers.join(","), ...body.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "commission-verification.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleCommissionColumn = (header: string) => {
    setVisibleCommissionColumns((current) => ({
      ...current,
      [header]: !current[header],
    }));
  };

  const submitLateMinute = () => {
    if (!lateMinuteForm.person || !lateMinuteForm.purpose.trim() || !lateMinuteForm.timeInMinutes.trim()) {
      return;
    }

    const currentDate = new Date();
    const dateStamp = `${String(currentDate.getFullYear())}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

    setLateComingRows((current) => [
      ...current,
      {
        no: String(current.length + 1),
        name: lateMinuteForm.person,
        task: lateMinuteForm.purpose.trim(),
        time: lateMinuteForm.timeInMinutes.trim(),
        taskDetail: lateMinuteForm.detail.trim(),
        create: dateStamp,
      },
    ]);

    setLateMinuteForm({
      person: "",
      purpose: "",
      timeInMinutes: "",
      detail: "",
    });
  };

  const SectionHeader = ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white dark:border-zinc-800">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
        <span className="font-bold text-[13px] text-slate-800 tracking-tight dark:text-zinc-100">{title}</span>
      </div>
      {children}
    </div>
  );

  const EmptyRow = ({ cols }: { cols: number }) => (
    <TableRow>
      <TableCell colSpan={cols} className="h-16 text-center">
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <Activity className="w-5 h-5 opacity-40" />
          <span className="text-[11px] italic">No data available</span>
        </div>
      </TableCell>
    </TableRow>
  );

  const TheadStyle = "font-semibold text-xs text-slate-600 dark:text-slate-300 px-4 h-10 bg-gradient-to-r from-slate-50 to-slate-50/80 whitespace-nowrap";

  

  const contextValue = {
    projectTaskRows,
    pendingProjectRows,
    softwareExecutives,
    importantItems,
    projectOverviewButtons,
    executionRows,
    queryClient,
    location,
    searchString,
    showAddLeaveForm,
    setShowAddLeaveForm,
    newLeaveForm,
    setNewLeaveForm,
    activeTab,
    setActiveTab,
    currentView,
    setCurrentView,
    pmsSearch,
    setPmsSearch,
    taskSearch,
    setTaskSearch,
    showDeleteModal,
    setShowDeleteModal,
    taskToDelete,
    setTaskToDelete,
    showAddTaskModal,
    setShowAddTaskModal,
    runningProjectSearch,
    setRunningProjectSearch,
    projectReportSearch,
    setProjectReportSearch,
    projectReportCompany,
    setProjectReportCompany,
    projectReportStartDate,
    setProjectReportStartDate,
    projectReportEndDate,
    setProjectReportEndDate,
    depDepartment,
    setDepDepartment,
    depCity,
    setDepCity,
    depStatus,
    setDepStatus,
    depStartDate,
    setDepStartDate,
    depEndDate,
    setDepEndDate,
    overtimeSearch,
    setOvertimeSearch,
    selectedOvertimeRowId,
    setSelectedOvertimeRowId,
    showOvertimeActionModal,
    setShowOvertimeActionModal,
    overtimeStatus,
    setOvertimeStatus,
    loanApplicationSearch,
    setLoanApplicationSearch,
    performanceUser,
    setPerformanceUser,
    performanceStartDate,
    setPerformanceStartDate,
    performanceEndDate,
    setPerformanceEndDate,
    showLateMinuteForm,
    setShowLateMinuteForm,
    lateComingSearch,
    setLateComingSearch,
    projectListSearch,
    setProjectListSearch,
    commissionSearch,
    setCommissionSearch,
    attendanceSearch,
    setAttendanceSearch,
    topSellingFilter,
    setTopSellingFilter,
    commissionTab,
    setCommissionTab,
    showCommissionColumnMenu,
    setShowCommissionColumnMenu,
    visibleCommissionColumns,
    setVisibleCommissionColumns,
    lateComingRows,
    setLateComingRows,
    selectedLeaveRowNo,
    setSelectedLeaveRowNo,
    showLeaveApplicationModal,
    setShowLeaveApplicationModal,
    showLeaveDecisionOptions,
    setShowLeaveDecisionOptions,
    leaveDecision,
    setLeaveDecision,
    selectedTeamBalanceRowNo,
    setSelectedTeamBalanceRowNo,
    showProcessLeaveModal,
    setShowProcessLeaveModal,
    processLeaveStatus,
    setProcessLeaveStatus,
    processLeaveComments,
    setProcessLeaveComments,
    lateMinuteForm,
    setLateMinuteForm,
    taskForm,
    setTaskForm,
    managerQueueRes,
    isManagerQueueLoading,
    executionRowsRes,
    isExecutionRowsLoading,
    softwareUsersRes,
    rawOvertimeData = [],
    rawLeaveData = [],
    assignModalOpen,
    setAssignModalOpen,
    assignTarget,
    setAssignTarget,
    assignForm,
    setAssignForm,
    workflowActionError,
    setWorkflowActionError,
    openAssignModal,
    verifyProjectMutation,
    assignTaskMutation,
    leaveReportUser,
    setLeaveReportUser,
    leaveReportStart,
    setLeaveReportStart,
    leaveReportEnd,
    setLeaveReportEnd,
    overtimeReportUser,
    setOvertimeReportUser,
    overtimeReportStart,
    setOvertimeReportStart,
    overtimeReportEnd,
    setOvertimeReportEnd,
    overtimeReportPage,
    setOvertimeReportPage,
    OVERTIME_REPORT_PAGE_SIZE,
    monthlyProjectPeriod,
    setMonthlyProjectPeriod,
    upcomingCount,
    inProgressCount,
    completedCount,
    qcVerificationCount,
    depVerificationCount,
    pendingLeaveCount,
    teamRows,
    getStatRangeStart,
    getStatCards,
    statCards,
    waitingQueueRows,
    delayQueueRows,
    approvedQueueRows,
    todayLeaveQueueRows,
    filteredPmsRows,
    pmsHeaders,
    taskCreateRows,
    setTaskCreateRows,
    filteredTaskCreateRows,
    exportPmsRows,
    openDeleteTaskModal,
    confirmDeleteTask,
    saveNewTask,
    runningProjectTopBoxes,
    filteredProjectReportRows,
    filteredDepartmentProjectRows,
    overtimeRows,
    filteredOvertimeRows,
    selectedOvertimeRow,
    openOvertimeActionModal,
    mutateOvertime,
    saveOvertimeStatus,
    loanApplicationDepartments,
    loanApplicationHeaders,
    rawLoanData = [],
    loanApplicationRows,
    filteredLoanApplicationRows,
    exportLoanApplicationRows,
    filteredPerformanceRows,
    filteredLateComingRows,
    projectListHeaders,
    filteredProjectListRows,
    commissionHeaders,
    filteredCommissionRows,
    upcomingHeaders,
    exportUpcomingRows,
    inProgressHeaders,
    exportInProgressRows,
    completedHeaders,
    exportCompletedRows,
    leaveApplicationHeaders,
    submitLeaveMutation,
    processLeaveMutation,
    handleProcessLeaveSave,
    handleLeaveSubmit,
    leaveApplicationRows,
    selectedLeaveRow,
    openLeaveApplicationModal,
    closeLeaveApplicationModal,
    teamBalanceRows,
    filteredTeamBalanceRows,
    selectedTeamBalanceRow,
    openProcessLeaveModal,
    closeProcessLeaveModal,
    visibleCommissionHeaders,
    commissionRowValueMap,
    exportCommissionRows,
    toggleCommissionColumn,
    submitLateMinute,
    SectionHeader,
    EmptyRow,
    TheadStyle
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
