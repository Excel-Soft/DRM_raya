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


export function CommissionVerificationView() {
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
                    onClick={() => setShowCommissionColumnMenu((current: any) => !current)}
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
                      {visibleCommissionHeaders.map((head: any) => (
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
                      filteredCommissionRows.map((row: any) => (
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
