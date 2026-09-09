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


export function DepProjectView() {
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
                    {["#", "Company", "Package", "Status", "Project", "Amount", "Method", "Create/Verify"].map((head: any) => (
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
                  {filteredDepartmentProjectRows.map((row: any) => (
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
