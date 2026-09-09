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


export function LateComingView() {
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
                      onChange={(e) => setLateMinuteForm((current: any) => ({ ...current, person: e.target.value }))}
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
                    onChange={(e) => setLateMinuteForm((current: any) => ({ ...current, purpose: e.target.value }))}
                    placeholder="purpose"
                    className="h-11 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Time In Mint</label>
                  <Input
                    value={lateMinuteForm.timeInMinutes}
                    onChange={(e) => setLateMinuteForm((current: any) => ({ ...current, timeInMinutes: e.target.value }))}
                    placeholder="time in mint"
                    className="h-11 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[14px] font-semibold text-slate-700 dark:text-zinc-400">Detail</label>
                  <textarea
                    value={lateMinuteForm.detail}
                    onChange={(e) => setLateMinuteForm((current: any) => ({ ...current, detail: e.target.value }))}
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
                      {["#", "Name", "Task", "Time", "Task Detail", "Create", "Action"].map((head: any) => (
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
                      filteredLateComingRows.map((row: any) => (
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
