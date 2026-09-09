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


export function ProjectListView() {
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
                      {projectListHeaders.map((head: any) => (
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
                    {filteredProjectListRows.map((row: any) => (
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
