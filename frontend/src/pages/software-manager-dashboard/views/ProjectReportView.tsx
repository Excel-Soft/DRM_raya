// @ts-nocheck
import React from "react";
import { useDashboard } from "../hooks/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, Users, ArrowRightLeft, Tag, Compass,
  PlusCircle, RefreshCw, Filter, ChevronRight,
  Activity, TrendingUp, Clock, CheckCircle2, ArrowRight, Search, Trash2, X
} from "lucide-react";


export function ProjectReportView() {
    const {
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
    TheadStyle,
        executionRows,
        projectOverviewButtons,
        importantItems,
        softwareExecutives,
        pendingProjectRows,
        projectTaskRows,
    } = useDashboard();

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
                    {["#", "ID", "Name", "Package", "Status", "Person", "Create", "GM Pay", "GM Doc", "BV Date", "Invoice", "Receipt", "Method", "Project", "Create", "Data", "Hod", "Dep", "15P", "Assign", "Finish", "Remaining"].map((head: any) => (
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
                  {filteredProjectReportRows.map((row: any, index: number) => (
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
