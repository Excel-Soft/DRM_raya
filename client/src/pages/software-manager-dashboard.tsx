import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
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

type TabType = "waiting" | "delay" | "approved" | "today-leave" | "team-yearly" | "team-balance";
type SoftwareManagerView = "dashboard" | "pms-setting" | "task-create" | "running-project" | "pending-project" | "project-task" | "project-report" | "dep-project" | "over-time" | "loan-application" | "performance" | "late-coming" | "project-list" | "commission-verification" | "upcoming-project" | "in-progress-project" | "completed-project" | "leave-application";
type CommissionTab = "approved" | "not-approved";

export default function SoftwareManagerDashboard() {
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

  const projectOverviewButtons: string[] = [
    "Pms Setting", "Task Create",
    "Running Project", "Pending Project",
    "Project Task", "Team Reports",
    "Project Report", "Dep Projects",
    "Over Time", "Loan Application",
    "Performance", "Late Coming",
    "Project List", "Commission Verification",
  ];

  const importantItems: [string, string, string?][] = [
    ["Upcoming", "0"], ["In Progress", "0"],
    ["Completed", "0"], ["Qc Verification", "0"],
    ["Dep Verification", "24(4600)", "text-red-500"], ["Leave Application", "13"],
  ];

  const teamRows = [
    { name: "Test", leads: 10, follow: 5, notFollow: 5, aCust: 2, bPlus: 1, bCust: 1, bMinus: 1, callConn: 5, notResp: 2, appoint: 5, meeting: 2 },
  ];

  const getStatCards = () => {
    if (topSellingFilter === "daily") {
      return [
        { label: "Total Project", value: "5(2)", icon: Users, gradient: "from-emerald-500 to-teal-600", lightBg: "bg-emerald-50", textColor: "text-emerald-600" },
        { label: "Verification", value: "1", icon: ArrowRightLeft, gradient: "from-blue-500 to-indigo-600", lightBg: "bg-blue-50", textColor: "text-blue-600" },
        { label: "Task", value: "8", icon: Tag, gradient: "from-violet-500 to-purple-600", lightBg: "bg-violet-50", textColor: "text-violet-600" },
        { label: "Free", value: "2", icon: Compass, gradient: "from-amber-500 to-orange-500", lightBg: "bg-amber-50", textColor: "text-amber-600" },
      ];
    }
    if (topSellingFilter === "weekly") {
      return [
        { label: "Total Project", value: "18(5)", icon: Users, gradient: "from-emerald-500 to-teal-600", lightBg: "bg-emerald-50", textColor: "text-emerald-600" },
        { label: "Verification", value: "4", icon: ArrowRightLeft, gradient: "from-blue-500 to-indigo-600", lightBg: "bg-blue-50", textColor: "text-blue-600" },
        { label: "Task", value: "35", icon: Tag, gradient: "from-violet-500 to-purple-600", lightBg: "bg-violet-50", textColor: "text-violet-600" },
        { label: "Free", value: "12", icon: Compass, gradient: "from-amber-500 to-orange-500", lightBg: "bg-amber-50", textColor: "text-amber-600" },
      ];
    }
    // monthly
    return [
      { label: "Total Project", value: "0(0)", icon: Users, gradient: "from-emerald-500 to-teal-600", lightBg: "bg-emerald-50", textColor: "text-emerald-600" },
      { label: "Verification", value: "0", icon: ArrowRightLeft, gradient: "from-blue-500 to-indigo-600", lightBg: "bg-blue-50", textColor: "text-blue-600" },
      { label: "Task", value: "0", icon: Tag, gradient: "from-violet-500 to-purple-600", lightBg: "bg-violet-50", textColor: "text-violet-600" },
      { label: "Free", value: "0", icon: Compass, gradient: "from-amber-500 to-orange-500", lightBg: "bg-amber-50", textColor: "text-amber-600" },
    ];
  };

  const statCards = getStatCards();

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: "waiting", label: "Waiting" },
    { key: "delay", label: "Delay" },
    { key: "approved", label: "Approved" },
    { key: "today-leave", label: "Today Leave", badge: 0 },
    { key: "team-yearly", label: "Team Yearly Leave" },
    { key: "team-balance", label: "Team Balance Leave" },
  ];

  const pmsSettingRows = [
    { no: "01", company: "Web Excels", person: "M. Shahbaz", project: "CRM Revamp", status: "Pending", docUpload: "Uploaded", depApproved: "Waiting", action: "View" },
    { no: "02", company: "Skillkot Traders", person: "Bilal Ahmed", project: "ERP Sync", status: "Running", docUpload: "Uploaded", depApproved: "Approved", action: "Open" },
    { no: "03", company: "Alpha Supplies", person: "Hamza Ali", project: "Portal Upgrade", status: "Data Verify", docUpload: "Pending", depApproved: "Waiting", action: "Review" },
  ];

  const filteredPmsRows = pmsSettingRows.filter((row) =>
    [row.no, row.company, row.person, row.project, row.status, row.docUpload, row.depApproved, row.action]
      .join(" ")
      .toLowerCase()
      .includes(pmsSearch.toLowerCase()),
  );

  const pmsHeaders = ["No#", "Company", "Person", "Project", "Status", "Doc Upload", "Dep Approved", "Action"];
  const [taskCreateRows, setTaskCreateRows] = useState([
    { id: "1", no: 1, name: "Excels Tech USA Website", time: "2:60", detail: "This task which i assigned to fahad to comeplete the functionality of the USA Website", repeatDaily: "No" },
    { id: "2", no: 2, name: "ERP Sale", time: "16:0", detail: "Test", repeatDaily: "No" },
    { id: "3", no: 3, name: "Website Backend Development", time: "10:0", detail: "", repeatDaily: "No" },
    { id: "4", no: 4, name: "Chatsystem Features", time: "8:0", detail: "Late messages replies of relivent team members Dashboard updates on both-ends Late replies record by each team members", repeatDaily: "No" },
    { id: "5", no: 5, name: "Development", time: "8:0", detail: "", repeatDaily: "No" },
  ]);

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

  const pendingProjectRows = [
    {
      id: "9399",
      project: "Alibaba Minisite",
      company: "MOZLAN SPORTS",
      status: "Start Work",
      hod: "Approved",
      dep: "Approved",
      date: "01 Jan 2026",
    },
    {
      id: "3618",
      project: "Alibaba Minisite",
      company: "SANZAF ENTERPRISES",
      status: "Start Work",
      hod: "Approved",
      dep: "Approved",
      date: "25 Apr 2024",
    },
    {
      id: "703",
      project: "Domain Registration",
      company: "DADDY D PRO",
      status: "verify Data",
      hod: "Approved",
      dep: "Waiting",
      date: "15 Jul 2024",
    },
  ];

  const projectTaskRows = [
    { id: "9911", project: "Alibaba Minisite", company: "MELSFIT SPORTS", date: "12 Mar 2026", status: "Pending", taskTime: "2:0", spentTime: "0:0:0" },
    { id: "9586", project: "Alibaba Minisite", company: "BRONO SPORTS WEARS", date: "16 Mar 2026", status: "Pending", taskTime: "2:0", spentTime: "0:0:0" },
    { id: "9939", project: "Dynamic Website", company: "SOCKER TEAMSPORT", date: "09 Mar 2026", status: "Pending", taskTime: "8:0", spentTime: "0:0:0" },
    { id: "9939-2", project: "Dynamic Website", company: "SOCKER TEAMSPORT", date: "09 Mar 2026", status: "Pending", taskTime: "8:0", spentTime: "0:0:0" },
    { id: "9399", project: "Alibaba Minisite", company: "MOZLAN SPORTS", date: "03 Apr 2026", status: "Pending", taskTime: "8:0", spentTime: "0:0:0" },
  ];

  const projectReportRows = [
    { no: "1", id: "PKNAZM201216", name: "NAZMA GROUP OF IND", package: "Verified Supplier", status: "New", person: "Abdul Qadir", create: "31-12-2025", gmPay: "09-02-2026", gmDoc: "0", bvDate: "30-11--0001", invoice: "14-04-2026", receipt: "15-04-2026", method: "Free", project: "Alibaba Product Posting / 500", create2: "15-04-2026", data: "15-04-2026", hod: "08-01-2026", dep: "0", fifteenP: "0-0", assign: "0", finish: "15", remaining: "15" },
    { no: "2", id: "PKLamd2575", name: "Lamda Industries", package: "", status: "", person: "Muhammad Nadeem Zulfiqar", create: "24-03-2021", gmPay: "0", gmDoc: "0", bvDate: "01-01-1970", invoice: "15-04-2026", receipt: "15-04-2026", method: "cash", project: "Domain Registration", create2: "15-04-2026", data: "15-04-2026", hod: "Approved", dep: "0", fifteenP: "0", assign: "0", finish: "0", remaining: "0" },
    { no: "3", id: "PKLamd2575", name: "Lamda Industries", package: "", status: "", person: "Muhammad Nadeem Zulfiqar", create: "24-03-2021", gmPay: "0", gmDoc: "0", bvDate: "01-01-1970", invoice: "15-04-2026", receipt: "15-04-2026", method: "cash", project: "Cloud Vps Professional", create2: "15-04-2026", data: "15-04-2026", hod: "Approved", dep: "0", fifteenP: "0", assign: "0", finish: "3", remaining: "3" },
    { no: "4", id: "PKSAIR3085", name: "SAIR GARMENTS INDUSTRY", package: "Basic Plus", status: "Renewal", person: "Mehreena Moeed", create: "13-04-2021", gmPay: "30-07-2025", gmDoc: "0", bvDate: "11-08-2025", invoice: "14-04-2026", receipt: "15-04-2026", method: "Free", project: "Listing Page", create2: "15-04-2026", data: "15-04-2026", hod: "05-08-2024", dep: "0", fifteenP: "0", assign: "0", finish: "2", remaining: "2" },
    { no: "5", id: "PKVELA213702", name: "VELANO HIDES", package: "Basic", status: "New", person: "Abu Baker Saeed Upal", create: "27-03-2026", gmPay: "31-03-2026", gmDoc: "0", bvDate: "30-11--0001", invoice: "14-04-2026", receipt: "15-04-2026", method: "Free", project: "Listing Page", create2: "15-04-2026", data: "15-04-2026", hod: "30-03-2026", dep: "0", fifteenP: "0-0", assign: "0", finish: "2", remaining: "2" },
    { no: "6", id: "PKHOLY215564", name: "HOLYWOON", package: "Basic Plus", status: "New", person: "Rehman Faisal", create: "13-04-2026", gmPay: "15-04-2026", gmDoc: "0", bvDate: "30-11--0001", invoice: "15-04-2026", receipt: "0", method: "Free", project: "Alibaba Product Posting / 62", create2: "15-04-2026", data: "15-04-2026", hod: "15-04-2026", dep: "0", fifteenP: "0", assign: "0", finish: "15", remaining: "15" },
    { no: "7", id: "PKHOLY215564", name: "HOLYWOON", package: "Basic Plus", status: "New", person: "Rehman Faisal", create: "13-04-2026", gmPay: "15-04-2026", gmDoc: "0", bvDate: "30-11--0001", invoice: "15-04-2026", receipt: "0", method: "Free", project: "Alibaba Minisite", create2: "15-04-2026", data: "15-04-2026", hod: "15-04-2026", dep: "0", fifteenP: "0", assign: "0", finish: "5", remaining: "5" },
    { no: "8", id: "GBON619", name: "GBON INTERNATIONAL", package: "", status: "", person: "Amina Shahzadi", create: "28-10-2020", gmPay: "0", gmDoc: "0", bvDate: "28-12-2021", invoice: "15-04-2026", receipt: "15-04-2026", method: "Bank Transfar", project: "Dynamic Website", create2: "15-04-2026", data: "15-04-2026", hod: "01-01-1970", dep: "0", fifteenP: "0", assign: "0", finish: "0", remaining: "0" },
    { no: "9", id: "PKGond23407", name: "Gondal Knitting", package: "Verified Supplier", status: "New", person: "Rohina Munir", create: "28-01-2023", gmPay: "31-07-2025", gmDoc: "0", bvDate: "17-10-2025", invoice: "15-04-2026", receipt: "15-04-2026", method: "Bank Transfar", project: "Alibaba Product Posting / 322", create2: "15-04-2026", data: "15-04-2026", hod: "09-07-2025", dep: "0", fifteenP: "0-0", assign: "0", finish: "15", remaining: "15" },
    { no: "10", id: "PKGond23407", name: "Gondal Knitting", package: "Verified Supplier", status: "New", person: "Rohina Munir", create: "28-01-2023", gmPay: "31-07-2025", gmDoc: "0", bvDate: "17-10-2025", invoice: "15-04-2026", receipt: "15-04-2026", method: "Bank Transfar", project: "VAT", create2: "15-04-2026", data: "15-04-2026", hod: "09-07-2025", dep: "0", fifteenP: "0-0", assign: "0", finish: "30", remaining: "30" },
  ];

  const filteredProjectReportRows = projectReportRows.filter((row) => {
    const matchesSearch = [row.project, row.method, row.hod, row.name, row.id, row.person, row.package].join(" ").toLowerCase().includes(projectReportSearch.toLowerCase());
    const matchesCompany = !projectReportCompany || row.name.toLowerCase().includes(projectReportCompany.toLowerCase());
    const matchesStart = !projectReportStartDate || row.create2 >= projectReportStartDate.split("-").reverse().join("-");
    const matchesEnd = !projectReportEndDate || row.create2 <= projectReportEndDate.split("-").reverse().join("-");
    return matchesSearch && matchesCompany && matchesStart && matchesEnd;
  });

  const departmentProjectRows = [
    {
      no: "1",
      company: "Webexcels",
      package: "Basic Plus",
      status: "New",
      project: "Website",
      amount: "50000",
      method: "Cash",
      createdAt: "2021-07-13 17:08:25",
      department: "Software Department",
      city: "Sialkot",
    },
  ];

  const filteredDepartmentProjectRows = departmentProjectRows.filter((row) => {
    const matchesDepartment = !depDepartment || row.department === depDepartment;
    const matchesCity = !depCity || row.city === depCity;
    const matchesStatus = !depStatus || row.status === depStatus;
    const matchesStart = !depStartDate || row.createdAt.slice(0, 10) >= depStartDate;
    const matchesEnd = !depEndDate || row.createdAt.slice(0, 10) <= depEndDate;
    return matchesDepartment && matchesCity && matchesStatus && matchesStart && matchesEnd;
  });

  const { data: rawOvertimeData = [] } = useQuery({ queryKey: ["/api/admin/overtime"] });
  const overtimeRows = rawOvertimeData.map((item: any, idx: number) => ({
    id: item.id,
    no: (idx + 1).toString(),
    name: item.userName || item.userId || "Unknown",
    task: item.taskTitle,
    time: item.timeSpent?.toString() || "0",
    detail: item.taskDetails || "",
    manager: item.status,
    create: new Date(item.createdAt).toLocaleString(),
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
      const res = await fetch(`/api/overtime/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
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
  const { data: rawLoanData = [] } = useQuery({ queryKey: ["/api/admin/loans"] });
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

  const performanceRows = [
    { company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25", user: "M. Shahbaz" },
    { company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25", user: "M. Shahbaz" },
  ];

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

  const projectListRows = [
    {
      no: "1",
      create: "2026-04-15",
      action: "View",
      company: "Webexcels",
      person: "M. Shahbaz",
      city: "Sialkot",
      project: "Website",
      itemStatus: "Pending",
      finish: "0",
      qa: "Pending",
      verification: "Waiting",
      method: "Cash",
      department: "Software",
      status: "Running",
      itemTime: "2",
      projectTime: "15",
      links: "0",
      upload: "0",
      task: "1",
      package: "Basic Plus",
      type: "New",
      cashStatus: "Pending",
    },
  ];

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

  const { data: rawLeaveData = [] } = useQuery({ queryKey: ["/api/admin/leaves"] });

  const { mutate: submitLeaveMutation } = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
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
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
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

  if (currentView === "pms-setting") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              List Of Project Activity
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-0.5">
                  {["Copy", "Excel", "CSV", "PDF"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => exportPmsRows(label.toLowerCase() as "copy" | "excel" | "csv" | "pdf")}
                      className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors first:rounded-l-md last:rounded-r-md"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input
                    value={pmsSearch}
                    onChange={(e) => setPmsSearch(e.target.value)}
                    className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {pmsHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPmsRows.length > 0 ? (
                      filteredPmsRows.map((row) => (
                        <TableRow key={`${row.no}-${row.project}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.company}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.person}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.project}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.status}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.docUpload}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.depApproved}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.action}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell colSpan={8} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="pt-1 text-[12px] text-slate-600 dark:text-zinc-300">
                Showing {filteredPmsRows.length === 0 ? 0 : 1} to {filteredPmsRows.length} of {filteredPmsRows.length} entries
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "task-create") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Task Manament System
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-5 space-y-6">
            <Button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="h-12 px-6 bg-[#0c9b57] hover:bg-[#09884c] text-white font-bold text-[13px] rounded-md shadow-none"
            >
              Add new Task
            </Button>

            <div className="space-y-3">
              <div className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">
                Task details <span className="text-emerald-500">/ Software Department</span>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {["#", "Name", "Time", "Detail", "Repeat Daily", "Action"].map((head) => (
                        <TableHead key={head} className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900">
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTaskCreateRows.map((row) => (
                      <TableRow key={row.id} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-slate-700 dark:text-zinc-400">{row.name}</TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-500 dark:text-zinc-400 dark:bg-zinc-900">
                            {row.time}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-slate-700 dark:text-zinc-400">{row.detail}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-slate-600 dark:text-zinc-300">{row.repeatDaily}</TableCell>
                        <TableCell className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDeleteTaskModal(row.id)}
                            className="text-[#fb6c6c] hover:text-[#ef4444] transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
            <div className="w-full max-w-[620px] rounded-2xl bg-white p-10 text-center shadow-2xl dark:bg-zinc-900">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#f4ca6a] text-[#f1b46f] dark:border-zinc-800">
                <span className="text-6xl font-light leading-none">!</span>
              </div>
              <h2 className="mb-10 text-[30px] font-extrabold text-[#545454] dark:text-zinc-400">
                Are you sure to Delete Task?
              </h2>
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setTaskToDelete(null);
                  }}
                  className="h-14 min-w-[130px] rounded-xl border-slate-200 bg-[#f8f8f8] text-[15px] font-bold text-slate-600 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteTask}
                  className="h-14 min-w-[86px] rounded-xl bg-[#ef4a43] text-[15px] font-bold text-white hover:bg-[#dc3f38] dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        )}

        {showAddTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
            <div className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
                <h2 className="text-[18px] font-bold text-slate-700 dark:text-zinc-400">ADD Task</h2>
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5 p-5">
                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Task Name:</label>
                  <Input
                    value={taskForm.name}
                    onChange={(e) => setTaskForm((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Create task name"
                    className="h-11 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Group:</label>
                    <div className="relative">
                      <select
                        value={taskForm.group}
                        onChange={(e) => setTaskForm((current) => ({ ...current, group: e.target.value }))}
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                      >
                        <option>Main</option>
                        <option>Support</option>
                        <option>Urgent</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Departmant:</label>
                    <div className="relative">
                      <select
                        value={taskForm.department}
                        onChange={(e) => setTaskForm((current) => ({ ...current, department: e.target.value }))}
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                      >
                        <option value="">Choose...</option>
                        <option value="Software Department">Software Department</option>
                        <option value="QA Department">QA Department</option>
                        <option value="Verification Department">Verification Department</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Hours:</label>
                    <Input
                      value={taskForm.hours}
                      onChange={(e) => setTaskForm((current) => ({ ...current, hours: e.target.value }))}
                      className="h-11 border-slate-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Min:</label>
                    <div className="relative">
                      <select
                        value={taskForm.minutes}
                        onChange={(e) => setTaskForm((current) => ({ ...current, minutes: e.target.value }))}
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                      >
                        {["00", "15", "30", "45"].map((minute) => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[14px] font-semibold text-slate-600 dark:text-zinc-300">
                    Detail:
                    <input
                      type="checkbox"
                      checked={taskForm.repeatDaily}
                      onChange={(e) => setTaskForm((current) => ({ ...current, repeatDaily: e.target.checked }))}
                      className="rounded border-slate-300 accent-emerald-500 dark:border-zinc-800"
                    />
                    <span>Repeat Daily</span>
                  </label>
                  <textarea
                    value={taskForm.detail}
                    onChange={(e) => setTaskForm((current) => ({ ...current, detail: e.target.value }))}
                    className="min-h-[102px] w-full rounded-md border border-slate-200 p-3 text-[14px] text-slate-700 outline-none resize-none dark:border-zinc-800 dark:text-zinc-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-5 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddTaskModal(false)}
                  className="h-12 rounded-xl border-slate-200 bg-[#f4f7fb] px-6 text-[15px] font-bold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={saveNewTask}
                  className="h-12 rounded-xl bg-[#0c9b57] px-6 text-[15px] font-bold text-white hover:bg-[#09884c]"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentView === "running-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Running Project <span className="text-emerald-500">/ Report</span>
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {runningProjectTopBoxes.map((box) => (
                <div key={box.title} className="rounded-xl bg-white shadow-sm border border-slate-100 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                  <h2 className="mb-4 text-[15px] font-bold text-slate-700 dark:text-zinc-400">{box.title}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className={box.headerClass}>
                          {box.columns.map((column) => (
                            <th
                              key={column}
                              className="px-4 py-4 text-left text-[12px] font-bold text-slate-700 whitespace-nowrap border border-white/50 dark:text-zinc-400"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-600 text-sm dark:text-zinc-300">
                <span>Show</span>
                <div className="relative">
                  <select className="h-10 border border-slate-200 rounded-lg px-3 pr-8 text-sm font-semibold appearance-none outline-none bg-white w-20 text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                    <option>100</option>
                    <option>50</option>
                    <option>25</option>
                    <option>10</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <span>entries</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                <span className="font-semibold">Search:</span>
                <Input
                  value={runningProjectSearch}
                  onChange={(e) => setRunningProjectSearch(e.target.value)}
                  className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["No#", "Company", "Person", "Project", "Status", "Time", "Assign", "Create Date", "Assign Date", "Finish Date", "Spent Time", "Link", "Action"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-white text-[12px] font-bold text-slate-700 whitespace-nowrap border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    <TableCell colSpan={13} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                      No data available in table
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
              <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 0 to 0 of 0 entries</div>
              <div className="flex items-center justify-center gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-r-none border-slate-200 bg-[#f8fafc] px-5 text-[14px] font-semibold text-slate-300 dark:bg-zinc-900 dark:border-zinc-800"
                  disabled
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-l-none border-slate-200 bg-[#f8fafc] px-5 text-[14px] font-semibold text-slate-300 dark:bg-zinc-900 dark:border-zinc-800"
                  disabled
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "pending-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              List Of Project Activity
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["#P-ID", "Projects", "Status", "Hod", "Dep", "Date", "Action"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-white text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingProjectRows.map((row) => (
                    <TableRow key={row.id} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#37c88f] text-[14px] font-bold text-white">
                          {row.id}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">{row.project}</span>
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">{row.company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex items-center rounded-full bg-[#34d399] px-2.5 py-1 text-[11px] font-bold text-white">
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex items-center rounded-full bg-[#e8edff] px-3 py-1 text-[12px] font-semibold text-[#00a56a] dark:bg-zinc-900 dark:text-zinc-400">
                          {row.hod}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${row.dep === "Approved" ? "bg-[#e8edff] text-[#00a56a]" : "bg-[#f0f1f5] text-slate-500 dark:text-slate-400"}`}>
                          {row.dep}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-[14px] text-slate-700 dark:text-zinc-400">{row.date}</TableCell>
                      <TableCell className="px-4 py-5 text-[14px] text-slate-500 dark:text-zinc-400"></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center pt-6">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2ac68b] hover:text-[#16a873] transition-colors dark:text-zinc-100"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c8f3e2] text-[12px] dark:border-zinc-800">✳</span>
                Load more
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "project-task") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Project History
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["#P-ID", "Projects", "Date", "Status", "Task Time", "Spent Time", "Link"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-white text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectTaskRows.map((row) => (
                    <TableRow key={row.id} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#37c88f] text-[14px] font-bold text-white">
                          {row.id.replace("-2", "")}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">{row.project}</span>
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">{row.company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-[14px] text-slate-700 dark:text-zinc-400">{row.date}</TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex items-center rounded-full bg-[#34d399] px-2.5 py-1 text-[11px] font-bold text-white">
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex items-center rounded-full bg-[#0ea85f] px-2.5 py-1 text-[11px] font-bold text-white">
                          {row.taskTime}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="inline-flex items-center rounded-full bg-[#6d748e] px-2.5 py-1 text-[11px] font-bold text-white">
                          {row.spentTime}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="text-[18px] text-slate-700 dark:text-zinc-400">🔗</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center pt-6">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2ac68b] hover:text-[#16a873] transition-colors dark:text-zinc-100"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#c8f3e2] text-[12px] dark:border-zinc-800">✳</span>
                Load more
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "project-report") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Check Project Reports
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto] gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Company Name</label>
                <Input
                  value={projectReportCompany}
                  onChange={(e) => setProjectReportCompany(e.target.value)}
                  placeholder="Enter name"
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Start Date</label>
                <Input
                  type="date"
                  value={projectReportStartDate}
                  onChange={(e) => setProjectReportStartDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">End Date</label>
                <Input
                  type="date"
                  value={projectReportEndDate}
                  onChange={(e) => setProjectReportEndDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
              <Button
                type="button"
                className="h-11 min-w-[138px] bg-[#0c9b57] hover:bg-[#09884c] text-white font-bold text-[14px]"
              >
                View
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-600 text-sm dark:text-zinc-300">
                <span>Show</span>
                <div className="relative">
                  <select className="h-10 border border-slate-200 rounded-lg px-3 pr-8 text-sm font-semibold appearance-none outline-none bg-white w-20 text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <span>entries</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                <span className="font-semibold">Search:</span>
                <Input
                  value={projectReportSearch}
                  onChange={(e) => setProjectReportSearch(e.target.value)}
                  className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["#", "ID", "Name", "Package", "Status", "Person", "Create", "GM Pay", "GM Doc", "BV Date", "Invoice", "Receipt", "Method", "Project", "Create", "Data", "Hod", "Dep", "15P", "Assign", "Finish", "Remaining"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjectReportRows.map((row, index) => (
                    <TableRow key={`${row.project}-${index}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell className="px-4 py-4 text-[12px] font-semibold text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] font-bold text-slate-700 dark:text-zinc-400">{row.id}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.name}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.package}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.status}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.person}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.create}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.gmPay}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.gmDoc}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.bvDate}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.invoice}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.receipt}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.method}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.project}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.create2}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.data}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.hod}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.dep}</TableCell>
                      <TableCell className={`px-4 py-4 text-[12px] ${row.fifteenP === "0-0" ? "text-red-500" : "text-slate-700"}`}>{row.fifteenP}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.assign}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.finish}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
              <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 1 to 10 of 148 entries</div>
              <div className="flex items-center gap-0">
              {["Previous", "1", "2", "3", "4", "5", "...", "15", "Next"].map((label, index) => (
                <button
                  key={`${label}-${index}`}
                  type="button"
                  className={`h-11 min-w-[40px] border border-slate-200 dark:border-slate-700 px-4 text-[14px] font-medium ${
                    label === "1"
                      ? "bg-[#0c9b57] text-white"
                      : label === "Previous"
                        ? "bg-[#f8fafc] dark:bg-zinc-950 text-slate-300"
                        : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "dep-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Department Project
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Department</label>
                <div className="relative">
                  <select
                    value={depDepartment}
                    onChange={(e) => setDepDepartment(e.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Choose ...</option>
                    <option value="Software Department">Software Department</option>
                    <option value="QA Department">QA Department</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Select City</label>
                <div className="relative">
                  <select
                    value={depCity}
                    onChange={(e) => setDepCity(e.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Choose...</option>
                    <option value="Sialkot">Sialkot</option>
                    <option value="Lahore">Lahore</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Select Status</label>
                <div className="relative">
                  <select
                    value={depStatus}
                    onChange={(e) => setDepStatus(e.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Choose...</option>
                    <option value="New">New</option>
                    <option value="Renewal">Renewal</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Start Date</label>
                <Input
                  type="date"
                  value={depStartDate}
                  onChange={(e) => setDepStartDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">End Date</label>
                <Input
                  type="date"
                  value={depEndDate}
                  onChange={(e) => setDepEndDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                className="h-11 min-w-[105px] bg-[#0c9b57] hover:bg-[#09884c] text-white font-bold text-[14px]"
              >
                View
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">List</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["#", "Company", "Package", "Status", "Project", "Amount", "Method", "Create/Verify"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartmentProjectRows.map((row) => (
                    <TableRow key={`${row.no}-${row.company}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.company}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.package}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.status}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.project}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.amount}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.method}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "over-time") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Overtime
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1 text-[12px] text-slate-700 dark:text-zinc-400">
                  <div className="font-semibold">Show</div>
                  <div className="relative w-[70px]">
                    <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-[12px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                      <option>10</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div>entries</div>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input
                    value={overtimeSearch}
                    onChange={(e) => setOvertimeSearch(e.target.value)}
                    className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {["#", "Name", "Task", "Time", "Task Detail", "Manager", "Create", "Action"].map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOvertimeRows.map((row) => (
                      <TableRow key={row.id} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">{row.no}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">
                          <div className="max-w-[120px] whitespace-normal">{row.name}</div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">
                          <div className="max-w-[180px] whitespace-normal">{row.task}</div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">{row.time}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">
                          <div className="min-w-[540px] max-w-[760px] whitespace-normal">{row.detail}</div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">{row.manager}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">
                          <div className="max-w-[90px] whitespace-normal break-words">{row.create}</div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 align-top dark:text-zinc-400">
                          <button
                            type="button"
                            onClick={() => openOvertimeActionModal(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"
                            aria-label={`Open overtime action for ${row.name}`}
                          >
                            <PlusCircle className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">
                  Showing {filteredOvertimeRows.length === 0 ? 0 : 1} to {filteredOvertimeRows.length} of {filteredOvertimeRows.length} entries
                </div>
                <div className="flex items-center gap-0">
                  <button type="button" className="h-11 min-w-[88px] border border-slate-200 px-4 text-[14px] font-medium bg-[#f8fafc] text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Previous
                  </button>
                  <button type="button" className="h-11 min-w-[40px] border border-[#0c9b57] px-4 text-[14px] font-medium bg-[#0c9b57] text-white dark:border-zinc-800">
                    1
                  </button>
                  <button type="button" className="h-11 min-w-[60px] border border-slate-200 px-4 text-[14px] font-medium bg-white text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showOvertimeActionModal && selectedOvertimeRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4">
            <div className="w-full max-w-[640px] rounded-[10px] bg-white shadow-2xl dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-zinc-800">
                <h2 className="text-[20px] font-medium text-slate-700 dark:text-zinc-400">Overtime</h2>
                <button
                  type="button"
                  onClick={() => setShowOvertimeActionModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close overtime modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-5 px-4 py-5">
                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Name</label>
                  <Input
                    value={selectedOvertimeRow.name}
                    readOnly
                    className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Task</label>
                  <Input
                    value={selectedOvertimeRow.task}
                    readOnly
                    className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Status</label>
                  <div className="relative">
                    <select
                      value={overtimeStatus}
                      onChange={(e) => setOvertimeStatus(e.target.value)}
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      <option value="">Choose...</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-5 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOvertimeActionModal(false)}
                  className="h-11 px-6 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-400"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={saveOvertimeStatus}
                  className="h-11 px-6 bg-[#63c297] hover:bg-[#51b184] text-white font-semibold"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (currentView === "loan-application") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Advance Salary List
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="text-[12px] text-slate-700 leading-6 dark:text-zinc-400">
                {loanApplicationDepartments.join("")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-0.5">
                  {["Copy", "Excel", "CSV", "PDF"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => exportLoanApplicationRows(label.toLowerCase() as "copy" | "excel" | "csv" | "pdf")}
                      className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors first:rounded-l-md last:rounded-r-md"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input
                    value={loanApplicationSearch}
                    onChange={(e) => setLoanApplicationSearch(e.target.value)}
                    className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {loanApplicationHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoanApplicationRows.length > 0 ? (
                      filteredLoanApplicationRows.map((row) => (
                        <TableRow key={`${row.no}-${row.employee}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.employee}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.advance}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.detail}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.instalment}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.remaining}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.manager}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.hod}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.date}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.action}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell colSpan={10} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="pt-1 text-[12px] text-slate-600 dark:text-zinc-300">
                Showing {filteredLoanApplicationRows.length === 0 ? 0 : 1} to {filteredLoanApplicationRows.length} of {filteredLoanApplicationRows.length} entries
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "performance") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Perfromance System
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Select User</label>
                <div className="relative">
                  <select
                    value={performanceUser}
                    onChange={(e) => setPerformanceUser(e.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Choose...</option>
                    <option value="M. Shahbaz">M. Shahbaz</option>
                    <option value="Bilal Ahmed">Bilal Ahmed</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Start Date</label>
                <Input
                  type="date"
                  value={performanceStartDate}
                  onChange={(e) => setPerformanceStartDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">End Date</label>
                <Input
                  type="date"
                  value={performanceEndDate}
                  onChange={(e) => setPerformanceEndDate(e.target.value)}
                  className="h-11 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                className="h-11 min-w-[105px] bg-[#0c9b57] hover:bg-[#09884c] text-white font-bold text-[14px]"
              >
                View
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Performance View</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                    {["Company", "Amount", "Method", "Date"].map((head) => (
                      <TableHead
                        key={head}
                        className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900"
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPerformanceRows.map((row, index) => (
                    <TableRow key={`${row.company}-${index}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell className="px-4 py-4 text-[12px] font-semibold lowercase text-slate-700 dark:text-zinc-400">{row.company}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.amount}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.method}</TableCell>
                      <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "late-coming") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold uppercase tracking-tight text-slate-800 dark:text-zinc-100">
              Late Coming <span className="text-slate-400">/</span>{" "}
              <button
                type="button"
                onClick={() => setShowLateMinuteForm(true)}
                className="text-emerald-600 hover:text-emerald-700"
              >
                Add Late Minut
              </button>
            </h1>
          </div>
        </div>

        {showLateMinuteForm ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Person</label>
                  <div className="relative">
                    <select
                      value={lateMinuteForm.person}
                      onChange={(e) => setLateMinuteForm((current) => ({ ...current, person: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      <option value="">Choose...</option>
                      <option value="Rana Ali Zeeshan">Rana Ali Zeeshan</option>
                      <option value="Zunair Bin Ahmad">Zunair Bin Ahmad</option>
                      <option value="Fahad bin Khalid">Fahad bin Khalid</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Purpose</label>
                  <Input
                    value={lateMinuteForm.purpose}
                    onChange={(e) => setLateMinuteForm((current) => ({ ...current, purpose: e.target.value }))}
                    placeholder="purpose"
                    className="h-11 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Time In Mint</label>
                  <Input
                    value={lateMinuteForm.timeInMinutes}
                    onChange={(e) => setLateMinuteForm((current) => ({ ...current, timeInMinutes: e.target.value }))}
                    placeholder="time in mint"
                    className="h-11 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Detail</label>
                  <textarea
                    value={lateMinuteForm.detail}
                    onChange={(e) => setLateMinuteForm((current) => ({ ...current, detail: e.target.value }))}
                    placeholder="add detail"
                    className="min-h-[42px] w-full rounded-md border border-slate-200 px-4 py-3 text-[14px] text-slate-700 outline-none resize-none dark:border-zinc-800 dark:text-zinc-400"
                  />
                </div>
              </div>

              <div className="pt-6">
                <Button
                  type="button"
                  onClick={submitLateMinute}
                  className="h-11 min-w-[105px] bg-[#0c9b57] hover:bg-[#09884c] text-white font-bold text-[14px]"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1 text-[12px] text-slate-700 dark:text-zinc-400">
                  <div className="font-semibold">Show</div>
                  <div className="relative w-[70px]">
                    <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-[12px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                      <option>10</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div>entries</div>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input
                    value={lateComingSearch}
                    onChange={(e) => setLateComingSearch(e.target.value)}
                    className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {["#", "Name", "Task", "Time", "Task Detail", "Create", "Action"].map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLateComingRows.length > 0 ? (
                      filteredLateComingRows.map((row) => (
                        <TableRow key={`${row.no}-${row.name}-${row.create}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.name}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.task}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.time}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.taskDetail}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.create}</TableCell>
                          <TableCell className="h-14 px-4 text-[12px] text-slate-700 dark:text-zinc-400"></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell colSpan={7} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">
                  Showing {filteredLateComingRows.length === 0 ? 0 : 1} to {filteredLateComingRows.length} of {filteredLateComingRows.length} entries
                </div>
                <div className="flex items-center gap-0">
                  <button type="button" className="h-11 min-w-[88px] border border-slate-200 px-4 text-[14px] font-medium bg-[#f8fafc] text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Previous
                  </button>
                  <button type="button" className="h-11 min-w-[60px] border border-slate-200 px-4 text-[14px] font-medium bg-white text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "project-list") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Projects Overview
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <Input
                value={projectListSearch}
                onChange={(e) => setProjectListSearch(e.target.value)}
                placeholder="Search..."
                className="h-11 border-slate-200 dark:border-zinc-800"
              />

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {projectListHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-3 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjectListRows.map((row) => (
                      <TableRow key={`${row.no}-${row.company}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.create}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.action}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.company}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.person}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.city}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.project}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.itemStatus}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.finish}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.qa}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.verification}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.method}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.department}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.status}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.itemTime}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.projectTime}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.links}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.upload}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.task}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.package}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.type}</TableCell>
                        <TableCell className="px-3 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.cashStatus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 1 to 1 of 1 entries</div>
                <div className="flex items-center justify-center gap-6 text-slate-300">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0c9b57] text-[14px] font-bold text-white">
                    1
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "commission-verification") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Commission Verification
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-center">
                <button
                  type="button"
                  onClick={() => setCommissionTab("approved")}
                  className={`h-10 rounded-md text-[14px] font-bold transition-colors ${
                    commissionTab === "approved"
                      ? "bg-[#0c9b57] text-white"
                      : "bg-transparent text-slate-700"
                  }`}
                >
                  Commission Approved
                </button>
                <button
                  type="button"
                  onClick={() => setCommissionTab("not-approved")}
                  className={`h-10 rounded-md text-[14px] font-bold transition-colors ${
                    commissionTab === "not-approved"
                      ? "bg-[#0c9b57] text-white"
                      : "bg-transparent text-slate-700"
                  }`}
                >
                  Commission Not Approved
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="relative flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => exportCommissionRows("copy")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-l-md"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCommissionRows("excel")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCommissionRows("pdf")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCommissionColumnMenu((current) => !current)}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-r-md"
                  >
                    Column visibility
                  </button>

                  {showCommissionColumnMenu ? (
                    <div className="absolute left-0 top-full z-10 mt-2 min-w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:bg-zinc-900 dark:border-zinc-800">
                      <div className="mb-2 text-[12px] font-bold text-slate-700 dark:text-zinc-400">Visible Columns</div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {commissionHeaders.map((header) => (
                          <label key={header} className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={visibleCommissionColumns[header] !== false}
                              onChange={() => toggleCommissionColumn(header)}
                            />
                            <span>{header}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input
                    value={commissionSearch}
                    onChange={(e) => setCommissionSearch(e.target.value)}
                    className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {visibleCommissionHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-2 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissionRows.length > 0 ? (
                      filteredCommissionRows.map((row) => (
                        <TableRow key={`${row.tab}-${row.no}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                          {visibleCommissionHeaders.map((header) => {
                            const valueMap = commissionRowValueMap(row);
                            return (
                              <TableCell key={`${row.tab}-${row.no}-${header}`} className="px-2 py-4 text-[12px] text-slate-700 dark:text-zinc-400">
                                {valueMap[header as keyof typeof valueMap]}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell colSpan={visibleCommissionHeaders.length} className="h-14 px-2 text-[12px] text-slate-600 dark:text-zinc-300">
                          No data available in table
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {visibleCommissionHeaders.map((header) => (
                        <TableCell key={`total-${header}`} className={`px-2 py-4 text-[12px] ${header === "No#" || header === "Pay" ? "font-bold text-slate-700" : "text-slate-700"}`}>
                          {header === "No#" ? "Total" : header === "Pay" ? "108962" : ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="text-[12px] text-slate-600 dark:text-zinc-300">
                Showing {filteredCommissionRows.length === 0 ? 0 : 1} to {filteredCommissionRows.length} of {filteredCommissionRows.length} entries
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "upcoming-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Upcoming Project
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <h2 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">View Detail</h2>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => exportUpcomingRows("copy")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-l-md"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => exportUpcomingRows("excel")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportUpcomingRows("pdf")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-r-md"
                  >
                    Column visibility
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {upcomingHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell colSpan={upcomingHeaders.length} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 0 to 0 of 0 entries</div>
                <div className="flex items-center gap-0">
                  <button type="button" className="h-11 min-w-[88px] border border-slate-200 px-4 text-[14px] font-medium bg-[#f8fafc] text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Previous
                  </button>
                  <button type="button" className="h-11 min-w-[60px] border border-slate-200 px-4 text-[14px] font-medium bg-white text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "in-progress-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Running Projects
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <h2 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">View Detail</h2>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => exportInProgressRows("copy")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-l-md"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => exportInProgressRows("excel")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportInProgressRows("pdf")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-r-md"
                  >
                    Column visibility
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {inProgressHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell colSpan={inProgressHeaders.length} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 0 to 0 of 0 entries</div>
                <div className="flex items-center gap-0">
                  <button type="button" className="h-11 min-w-[88px] border border-slate-200 px-4 text-[14px] font-medium bg-[#f8fafc] text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Previous
                  </button>
                  <button type="button" className="h-11 min-w-[60px] border border-slate-200 px-4 text-[14px] font-medium bg-white text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "completed-project") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              Completed Projects
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <h2 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">View Detail</h2>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => exportCompletedRows("copy")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-l-md"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCompletedRows("excel")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCompletedRows("pdf")}
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    className="h-11 px-5 bg-[#777e95] hover:bg-[#656c82] text-white text-[12px] font-semibold transition-colors rounded-r-md"
                  >
                    Column visibility
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {completedHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      <TableCell colSpan={completedHeaders.length} className="h-14 px-4 text-[12px] text-slate-600 dark:text-zinc-300">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                <div className="text-[12px] text-slate-600 dark:text-zinc-300">Showing 0 to 0 of 0 entries</div>
                <div className="flex items-center gap-0">
                  <button type="button" className="h-11 min-w-[88px] border border-slate-200 px-4 text-[14px] font-medium bg-[#f8fafc] text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Previous
                  </button>
                  <button type="button" className="h-11 min-w-[60px] border border-slate-200 px-4 text-[14px] font-medium bg-white text-slate-300 dark:bg-zinc-900 dark:border-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "leave-application") {
    return (
      <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentView("dashboard")}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-600 dark:text-zinc-300 dark:border-zinc-800"
            >
              Back
            </Button>
            <h1 className="text-[17px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-zinc-100">
              LEAVE FORM <span className="text-slate-400">/</span> <button onClick={() => setShowAddLeaveForm(!showAddLeaveForm)} className="text-emerald-600 hover:text-emerald-700 transition-colors uppercase">ADD LEAVE</button>
            </h1>
          </div>
        </div>

        {showAddLeaveForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <form onSubmit={handleLeaveSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Purpose</label>
                <select 
                  className="w-full h-10 px-3 text-[13px] rounded-md border border-slate-200 outline-none focus:border-emerald-500 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  value={newLeaveForm.purpose} onChange={e => setNewLeaveForm({...newLeaveForm, purpose: e.target.value})}
                  required
                >
                  <option value="">Choose...</option>
                  <option value="Urgent Work">Urgent Work</option>
                  <option value="Unhealthy">Unhealthy</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Type</label>
                <select 
                  className="w-full h-10 px-3 text-[13px] rounded-md border border-slate-200 outline-none focus:border-emerald-500 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  value={newLeaveForm.type} onChange={e => setNewLeaveForm({...newLeaveForm, type: e.target.value})}
                  required
                >
                  <option value="">Choose...</option>
                  <option value="Full">Full</option>
                  <option value="Short">Short</option>
                  <option value="Half">Half</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Alternative</label>
                <select 
                  className="w-full h-10 px-3 text-[13px] rounded-md border border-slate-200 outline-none focus:border-emerald-500 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  value={newLeaveForm.alternative} onChange={e => setNewLeaveForm({...newLeaveForm, alternative: e.target.value})}
                >
                  <option value="">Choose...</option>
                  <option value="Sajjad Hassan">Sajjad Hassan</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Day</label>
                <Input placeholder="day" className="h-10 text-[13px] border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" value={newLeaveForm.day} onChange={e => setNewLeaveForm({...newLeaveForm, day: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Time In Mint</label>
                <Input placeholder="time" className="h-10 text-[13px] border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" value={newLeaveForm.time} onChange={e => setNewLeaveForm({...newLeaveForm, time: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Start</label>
                <Input type="date" className="h-10 text-[13px] border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" value={newLeaveForm.start} onChange={e => setNewLeaveForm({...newLeaveForm, start: e.target.value})} required />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">End</label>
                <Input type="date" className="h-10 text-[13px] border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" value={newLeaveForm.end} onChange={e => setNewLeaveForm({...newLeaveForm, end: e.target.value})} required />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-zinc-400">Detail</label>
                <Input placeholder="add detail" className="h-10 text-[13px] border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" value={newLeaveForm.detail} onChange={e => setNewLeaveForm({...newLeaveForm, detail: e.target.value})} />
              </div>

              <div className="col-span-1 sm:col-span-2 lg:col-span-4 mt-2">
                <Button type="submit" className="bg-[#4fb888] hover:bg-[#43a175] text-white font-medium h-10 px-8 text-[13px]">Submit</Button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1 text-[12px] text-slate-700 dark:text-zinc-400">
                  <div className="font-semibold">Show</div>
                  <div className="relative w-[70px]">
                    <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-[12px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                      <option>10</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div>entries</div>
                </div>

                <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700 dark:text-zinc-400">
                  <span className="font-semibold">Search:</span>
                  <Input className="h-9 w-52 border-slate-200 rounded-md dark:border-zinc-800" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                      {leaveApplicationHeaders.map((head) => (
                        <TableHead
                          key={head}
                          className="h-12 px-4 bg-[#eef2f7] text-[12px] font-bold text-slate-700 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveApplicationRows.map((row) => (
                      <TableRow key={`${row.no}-${row.create}`} className="border-b border-slate-100 hover:bg-transparent dark:border-zinc-800">
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.no}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.name}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.purpose}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.type}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-normal dark:text-zinc-400">{row.alternative}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-normal min-w-[320px] dark:text-zinc-400">{row.detail}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.monthlyLeaves}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.monthlyHalfLeaves}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.day}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">{row.time}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-normal dark:text-zinc-400">{row.start}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-normal dark:text-zinc-400">{row.end}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 whitespace-normal dark:text-zinc-400">{row.create}</TableCell>
                        <TableCell className="px-4 py-4 text-[12px] text-slate-700 dark:text-zinc-400">
                          <button
                            type="button"
                            onClick={() => openLeaveApplicationModal(row.no)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-600 text-emerald-600 text-[18px] font-bold hover:bg-emerald-50 transition-colors"
                            aria-label={`Open application for ${row.name}`}
                          >
                            {row.action}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {showLeaveApplicationModal && selectedLeaveRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4">
            <div className="w-full max-w-[640px] overflow-hidden rounded-[10px] bg-white shadow-2xl dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 dark:border-zinc-800">
                <h2 className="text-[20px] font-medium text-slate-700 dark:text-zinc-400">Application</h2>
                <button
                  type="button"
                  onClick={closeLeaveApplicationModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close application modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Name</label>
                  <Input
                    value={selectedLeaveRow.name}
                    readOnly
                    className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Decision</label>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowLeaveDecisionOptions((current) => !current)}
                      className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 text-left text-[14px] text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      <span>{leaveDecision || "Choose..."}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showLeaveDecisionOptions ? "rotate-180" : ""}`} />
                    </button>

                    {showLeaveDecisionOptions ? (
                      <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="border-b border-slate-100 p-3 dark:border-zinc-800">
                          <Input className="h-8 border-slate-200 dark:border-zinc-800" />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveDecision("Approved");
                            setShowLeaveDecisionOptions(false);
                          }}
                          className="block w-full bg-[#0c9b57] px-4 py-2 text-left text-[14px] font-semibold text-white"
                        >
                          Approved
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveDecision("Cancel");
                            setShowLeaveDecisionOptions(false);
                          }}
                          className="block w-full border-t border-slate-100 px-4 py-2 text-left text-[14px] text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-5 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeLeaveApplicationModal}
                  className="h-11 px-6 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-400"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleProcessLeaveSave}
                  disabled={processLeaveMutation.isPending}
                  className="h-11 px-6 bg-[#0c9b57] hover:bg-[#09884c] text-white font-semibold disabled:opacity-50"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#f0f4f8] dark:bg-zinc-950">

      {/* ── BREADCRUMB ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">DASHBOARD</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm dark:bg-zinc-900 dark:text-zinc-400">SOFTWARE DEPARTMENT</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">SOFTWARE MANAGER</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="xl:col-span-8 space-y-5">

          {/* TOP SELLING */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <SectionHeader title="Top Selling">
              <div className="relative">
                <select 
                  value={topSellingFilter}
                  onChange={(e) => setTopSellingFilter(e.target.value)}
                  className="h-7 border border-slate-200 rounded-lg px-3 pr-7 text-[11px] font-semibold appearance-none outline-none bg-white text-slate-600 focus:border-emerald-400 transition dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </SectionHeader>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon, gradient, lightBg, textColor }, i) => (
                <div key={i} className="group relative rounded-xl p-4 bg-white border border-slate-100 hover:border-transparent hover:shadow-lg transition-all duration-300 overflow-hidden cursor-default dark:bg-zinc-900 dark:border-zinc-800">
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${lightBg} flex items-center justify-center`}>
                      <Icon className={`w-4.5 h-4.5 ${textColor}`} />
                    </div>
                    <TrendingUp className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-0.5 dark:text-zinc-400">{label}</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* VERIFICATION SECTION */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            {/* Title + Tabs */}
            <div className="px-5 pt-4 pb-0 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <span className="font-bold text-[13px] text-slate-800 dark:text-zinc-100">Verification &amp; Assign Project / Attendance Report</span>
                </div>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-hide">
                {tabs.map(({ key, label, badge }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`relative flex-shrink-0 px-4 py-2 text-[11px] font-bold rounded-t-lg transition-all duration-200 border-t border-x whitespace-nowrap ${
                      activeTab === key
                        ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-emerald-500 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-slate-700 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                    {badge !== undefined && (
                      <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${activeTab === key ? "bg-white dark:bg-zinc-900/30 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-5 text-[12px]">
              {activeTab === "waiting" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["No#","Company","Project","Status","Time","Action"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody><EmptyRow cols={6} /></TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing 0 to 0 of 0 entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "delay" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["Name","Company","Project","Dep","Deadlines"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody><EmptyRow cols={5} /></TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing 0 to 0 of 0 entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "approved" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["No#","Company","Project","Status","Time","Action"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody><EmptyRow cols={6} /></TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing 0 to 0 of 0 entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "today-leave" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["No","Name","Purpose","Type","Alternative","Detail","Leave As Per Sheet","Leave As Per Approval","Monthly Half Leaves","Day","Time","Start","End","Create","Action"].map(h => (
                          <TableHead key={h} className="font-semibold text-xs text-slate-600 px-3 h-10 bg-slate-50 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-300">{h}</TableHead>
                        ))}
                      </TableRow></TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={15} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No data available in table</span></div></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing 0 to 0 of 0 entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "team-yearly" && (
                <>
                  <div className="flex items-center gap-2 mb-4 text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 dark:text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Last Upload Attendance : <span className="font-bold text-slate-700 dark:text-zinc-400">2026-03-30</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["No","Name","AC Month","Total Leaves","Unpaid Leaves","CM Leaves","L-Approval","Last Increment","Expire"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody><EmptyRow cols={9} /></TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing 0 to 0 of 0 entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "team-balance" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">
                      Show
                      <div className="relative">
                        <select className="h-8 border border-slate-200 rounded-lg px-2 pr-7 text-xs font-bold appearance-none outline-none w-16 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <option>10</option><option>25</option><option>50</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      entries
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-xs dark:text-zinc-300">Search: <Input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="h-8 w-44 border-slate-200 rounded-lg text-xs dark:border-zinc-800" /></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                        {["Sr.No","Name","Available Leaves","Leave Reason","MA","HODA","AP","Comment","Action"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredTeamBalanceRows.map((row, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                            <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.no}</TableCell>
                            <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.name}</TableCell>
                            <TableCell className="px-4 py-3"><span className="inline-flex items-center justify-center min-w-[2rem] h-6 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full px-2">{row.leaves}</span></TableCell>
                            <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.reason}</TableCell>
                            <TableCell className={`px-4 py-3 font-semibold ${row.maColor}`}>{row.ma}</TableCell>
                            <TableCell className="px-4 py-3 text-amber-600 font-medium">{row.hoda}</TableCell>
                            <TableCell className="px-4 py-3 text-amber-600 font-medium">{row.ap}</TableCell>
                            <TableCell className="px-4 py-3 text-slate-500 max-w-[180px] truncate dark:text-zinc-400">{row.comment}</TableCell>
                            <TableCell className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => openProcessLeaveModal(row.no)}
                                className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing {filteredTeamBalanceRows.length > 0 ? 1 : 0} to {filteredTeamBalanceRows.length} of {filteredTeamBalanceRows.length} entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {showProcessLeaveModal && selectedTeamBalanceRow ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4">
              <div className="w-full max-w-[640px] rounded-[10px] bg-white shadow-2xl dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 dark:border-zinc-800">
                  <h2 className="text-[20px] font-medium text-slate-700 dark:text-zinc-400">Process Leave Request</h2>
                  <button
                    type="button"
                    onClick={closeProcessLeaveModal}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Close process leave request modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Employee Name:</label>
                      <Input
                        value={selectedTeamBalanceRow.name}
                        readOnly
                        className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Available Leaves:</label>
                      <Input
                        value={String(selectedTeamBalanceRow.leaves)}
                        readOnly
                        className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Leave Reason:</label>
                    <Input
                      value={selectedTeamBalanceRow.reason}
                      readOnly
                      className="h-11 border-slate-200 bg-slate-50 text-[14px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Approval Status <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        value={processLeaveStatus}
                        onChange={(e) => setProcessLeaveStatus(e.target.value)}
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-[14px] text-slate-700 outline-none appearance-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                      >
                        <option value="">Select Status</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Pending">Pending</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Comments</label>
                    <textarea
                      value={processLeaveComments}
                      onChange={(e) => setProcessLeaveComments(e.target.value)}
                      placeholder="Enter your comments here..."
                      className="min-h-[84px] w-full rounded-md border border-slate-200 px-4 py-3 text-[14px] text-slate-700 outline-none resize-none dark:border-zinc-800 dark:text-zinc-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-5 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeProcessLeaveModal}
                    className="h-11 px-6 border-slate-200 bg-[#777e95] text-white hover:bg-[#656c82] hover:text-white dark:border-zinc-800"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={closeProcessLeaveModal}
                    className="h-11 px-6 bg-[#0c9b57] hover:bg-[#09884c] text-white font-semibold"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* DAILY REPORT */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <SectionHeader title="Daily Report">
              <div className="relative">
                <select className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] font-semibold appearance-none outline-none bg-white text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                  <option>Daily Report</option><option>Weekly Report</option><option>Monthly Report</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </SectionHeader>
            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                    {["Name","Company","Project","Free","Task","Status","Run","Spent","Action"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody><EmptyRow cols={9} /></TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* LEAVE REPORT */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <SectionHeader title="Leave Report">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] appearance-none outline-none bg-white w-32 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                    <option>All Users</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Button className="h-8 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-[11px] border-none gap-1 rounded-lg shadow-sm">
                  <Filter className="w-3 h-3" /> Filter
                </Button>
                <button type="button" className="h-8 w-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </SectionHeader>
            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                    {["Create Date","Name","Purpose","Type","Leave Date","PM-Comments","Status"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow><TableCell colSpan={7} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No records found</span></div></TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* OVERTIME REPORT */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <SectionHeader title="Overtime Report">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] appearance-none outline-none bg-white w-32 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                    <option>All Users</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Button className="h-8 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-[11px] border-none gap-1 rounded-lg shadow-sm">
                  <Filter className="w-3 h-3" /> Filter
                </Button>
                <button type="button" className="h-8 w-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </SectionHeader>
            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                    {["Create Date","Name","Purpose","Time (Mins)","Department","Detail"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow><TableCell colSpan={6} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No overtime records found for the selected filters</span></div></TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="xl:col-span-4 space-y-4">

          {/* BANNER */}
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-2 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
              <span className="font-bold text-[13px] text-slate-800 dark:text-zinc-100">Promotion Banners</span>
            </div>
            <div className="relative bg-gradient-to-br from-[#c93b8f] via-[#9b3fce] to-[#5b21b6] h-44 flex items-center justify-center overflow-hidden">
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white dark:bg-zinc-900" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white dark:bg-zinc-900" />
              <div className="absolute top-4 left-6 right-6 text-white/20 text-[7px] leading-[1.6] font-mono">
                Lorem ipsum dolor sit amet consectetur adipiscing elit. Pellentesque a lacoreet est sit dapibus ullamcorper magna nam pretium erat aocean volutpat ornare et malesuada.
              </div>
              <Button className="relative z-10 bg-[#e2354e] hover:bg-[#c82d42] text-white font-bold text-xs h-9 px-6 rounded-xl border-none shadow-lg hover:shadow-xl transition-all dark:bg-zinc-900">
                READ MORE
              </Button>
            </div>
          </div>

          {/* PROJECTS OVERVIEW */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-3 bg-gradient-to-r from-[#1a2d5a] to-[#243b6e] flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
              <span className="font-bold text-[13px] text-white tracking-tight">Projects Overview</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-1.5">
              {projectOverviewButtons.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (label === "Pms Setting") {
                      setCurrentView("pms-setting");
                    }
                    if (label === "Task Create") {
                      setCurrentView("task-create");
                    }
                    if (label === "Running Project") {
                      setCurrentView("running-project");
                    }
                    if (label === "Pending Project") {
                      setCurrentView("pending-project");
                    }
                    if (label === "Project Task") {
                      setCurrentView("project-task");
                    }
                    if (label === "Project Report") {
                      setCurrentView("project-report");
                    }
                    if (label === "Dep Projects") {
                      setCurrentView("dep-project");
                    }
                    if (label === "Over Time") {
                      setCurrentView("over-time");
                    }
                    if (label === "Loan Application") {
                      setCurrentView("loan-application");
                    }
                    if (label === "Performance") {
                      setCurrentView("performance");
                    }
                    if (label === "Late Coming") {
                      setCurrentView("late-coming");
                    }
                    if (label === "Project List") {
                      setCurrentView("project-list");
                    }
                    if (label === "Commission Verification") {
                      setCurrentView("commission-verification");
                    }
                  }}
                  className="group flex items-center justify-between h-9 px-3 rounded-lg bg-slate-50 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 font-semibold text-[11px] text-slate-600 hover:text-emerald-700 transition-all duration-200 border border-transparent hover:border-emerald-100 border-none outline-none cursor-pointer dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span className="truncate">{label}</span>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* IMPORTANT */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 dark:border-zinc-800">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
              <span className="font-bold text-[13px] text-slate-800 dark:text-zinc-100">Important</span>
            </div>
            <div className="grid grid-cols-2">
              {importantItems.map(([label, val, cls], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (label === "Upcoming") {
                      setCurrentView("upcoming-project");
                    }
                    if (label === "In Progress") {
                      setCurrentView("in-progress-project");
                    }
                    if (label === "Completed") {
                      setCurrentView("completed-project");
                    }
                    if (label === "Leave Application") {
                      setCurrentView("leave-application");
                    }
                  }}
                  className={`flex flex-col p-3 px-4 text-left hover:bg-slate-50 dark:bg-zinc-900 transition-colors ${i < 4 ? "border-b" : ""} ${i % 2 === 0 ? "border-r" : ""} border-slate-100 dark:border-slate-700`}
                >
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</span>
                  <span className={`text-[15px] font-extrabold ${cls || "text-slate-800 dark:text-slate-200"}`}>{val}</span>
                </button>
              ))}
            </div>
          </div>

          {/* DAILY ACTIVITIES */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 dark:border-zinc-800">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
              <span className="font-bold text-[13px] text-slate-800 dark:text-zinc-100">Daily Activities</span>
            </div>
            <div className="p-4">
              <div className="rounded-xl border border-slate-100 overflow-hidden dark:border-zinc-800">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                    {["Name","Method","Target","Time"].map(h => <TableHead key={h} className={TheadStyle}>{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow><TableCell colSpan={4} className="h-14 text-center"><span className="text-[11px] text-slate-400 italic">No activities</span></TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FULL WIDTH ── */}

      {/* TEAM WORK PERFORMANCE */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
        <SectionHeader title="Team Work Performance">
          <div className="flex gap-2">
            <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
            <Input type="date" className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
          </div>
        </SectionHeader>
        <div className="p-5">
          <Badge className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 font-bold mb-4 hover:from-slate-100 border border-slate-200 rounded-lg px-3 dark:text-zinc-300 dark:border-zinc-800">All Team</Badge>
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                  {["Name","Leads","Follow","Not Follow","A- Customer","B+ Customer","B Csutomer","B- Csutomer","Call Connected","Not Response","Appointment","Meeting"].map(h => (
                    <TableHead key={h} className="font-semibold text-xs text-slate-600 px-4 h-10 bg-gradient-to-r from-slate-50 to-slate-50/80 whitespace-nowrap dark:text-zinc-300">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30 transition-colors border-b border-slate-50 dark:border-zinc-800">
                    <TableCell className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-100">{row.name}</TableCell>
                    {[row.leads, row.follow, row.notFollow, row.aCust, row.bPlus, row.bCust, row.bMinus, row.callConn, row.notResp, row.appoint, row.meeting].map((v, j) => (
                      <TableCell key={j} className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 bg-slate-50 border border-slate-100 text-slate-700 font-semibold text-xs rounded-lg px-2 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">{v}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* MONTHLY COMPLETE PROJECT */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
        <SectionHeader title="Monthly Complete Project">
          <div className="flex items-center gap-2">
            <button type="button" className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
            </button>
            <div className="relative">
              <select className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] font-bold appearance-none outline-none bg-white text-slate-600 w-20 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                <option>WK</option><option>MON</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </SectionHeader>
        <div className="p-5">
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                  <TableHead className="w-10 px-4 bg-slate-50 dark:bg-zinc-900">
                    <input type="checkbox" className="rounded border-slate-300 accent-emerald-500 dark:border-zinc-800" />
                  </TableHead>
                  {["No.","Name","Company","Project","Free","Task","Status","Run","Spent","Link","Action"].map(h => (
                    <TableHead key={h} className="font-semibold text-xs text-slate-600 px-4 h-10 bg-slate-50 whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-300">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={12} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><CheckCircle2 className="w-5 h-5 opacity-30" /><span className="text-[11px] italic">No data available</span></div></TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

    </div>
  );
}
