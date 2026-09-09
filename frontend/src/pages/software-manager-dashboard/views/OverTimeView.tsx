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


export function OverTimeView() {
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
                      {["#", "Name", "Task", "Time", "Task Detail", "Manager", "Create", "Action"].map((head: any) => (
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
                    {filteredOvertimeRows.map((row: any) => (
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
