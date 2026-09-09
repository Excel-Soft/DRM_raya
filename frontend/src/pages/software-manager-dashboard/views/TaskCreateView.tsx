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


export function TaskCreateView() {
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
                      {["#", "Name", "Time", "Detail", "Repeat Daily", "Action"].map((head: any) => (
                        <TableHead key={head} className="h-12 px-4 bg-[#d9f3ec] text-[12px] font-bold text-slate-800 whitespace-nowrap dark:text-zinc-100 dark:bg-zinc-900">
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTaskCreateRows.map((row: any) => (
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
                    onChange={(e) => setTaskForm((current: any) => ({ ...current, name: e.target.value }))}
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
                        onChange={(e) => setTaskForm((current: any) => ({ ...current, group: e.target.value }))}
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
                        onChange={(e) => setTaskForm((current: any) => ({ ...current, department: e.target.value }))}
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
                      onChange={(e) => setTaskForm((current: any) => ({ ...current, hours: e.target.value }))}
                      className="h-11 border-slate-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-slate-600 dark:text-zinc-300">Min:</label>
                    <div className="relative">
                      <select
                        value={taskForm.minutes}
                        onChange={(e) => setTaskForm((current: any) => ({ ...current, minutes: e.target.value }))}
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
                      onChange={(e) => setTaskForm((current: any) => ({ ...current, repeatDaily: e.target.checked }))}
                      className="rounded border-slate-300 accent-emerald-500 dark:border-zinc-800"
                    />
                    <span>Repeat Daily</span>
                  </label>
                  <textarea
                    value={taskForm.detail}
                    onChange={(e) => setTaskForm((current: any) => ({ ...current, detail: e.target.value }))}
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
