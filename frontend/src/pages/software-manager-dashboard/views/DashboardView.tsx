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


export function DashboardView() {
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
                      {leaveApplicationHeaders.map((head: any) => (
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
                    {leaveApplicationRows.map((row: any) => (
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
                      onClick={() => setShowLeaveDecisionOptions((current: any) => !current)}
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
                  {workflowActionError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{workflowActionError}</div>
                  )}
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
                      <TableBody>
                        {(() => {
                          const rows = waitingQueueRows.filter((row) =>
                            [row.project?.name, row.project?.companyName].join(" ").toLowerCase().includes(attendanceSearch.toLowerCase()),
                          );
                          if (isManagerQueueLoading) return <EmptyRow cols={6} />;
                          if (!rows.length) return <EmptyRow cols={6} />;
                          return rows.map((row: any, i: number) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                              <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{i + 1}</TableCell>
                              <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.project?.companyName || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.project?.name || "-"}</TableCell>
                              <TableCell className="px-4 py-3"><Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{row.phaseLabel}</Badge></TableCell>
                              <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}</TableCell>
                              <TableCell className="px-4 py-3">
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={verifyProjectMutation.isPending}
                                  onClick={() => verifyProjectMutation.mutate(row.project.id)}
                                >
                                  {verifyProjectMutation.isPending ? "Verifying..." : "Verify"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing {waitingQueueRows.length > 0 ? 1 : 0} to {waitingQueueRows.length} of {waitingQueueRows.length} entries</p>
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
                      <TableBody>
                        {(() => {
                          const rows = delayQueueRows.filter((row) =>
                            [row.project?.name, row.project?.companyName].join(" ").toLowerCase().includes(attendanceSearch.toLowerCase()),
                          );
                          if (isManagerQueueLoading || !rows.length) return <EmptyRow cols={5} />;
                          return rows.map((row: any) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                              <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.project?.name || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.project?.companyName || "-"}</TableCell>
                              <TableCell className="px-4 py-3"><Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-semibold">{row.phaseLabel}</Badge></TableCell>
                              <TableCell className="px-4 py-3 text-slate-500 max-w-[220px] truncate dark:text-zinc-400">{row.lastReturnReason || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}</TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing {delayQueueRows.length > 0 ? 1 : 0} to {delayQueueRows.length} of {delayQueueRows.length} entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "approved" && (
                <>
                  {workflowActionError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{workflowActionError}</div>
                  )}
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
                      <TableBody>
                        {(() => {
                          const rows = approvedQueueRows.filter((row) =>
                            [row.project?.name, row.project?.companyName].join(" ").toLowerCase().includes(attendanceSearch.toLowerCase()),
                          );
                          if (isManagerQueueLoading || !rows.length) return <EmptyRow cols={6} />;
                          return rows.map((row: any, i: number) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                              <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{i + 1}</TableCell>
                              <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.project?.companyName || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.project?.name || "-"}</TableCell>
                              <TableCell className="px-4 py-3"><Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">{row.phaseLabel}</Badge></TableCell>
                              <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}</TableCell>
                              <TableCell className="px-4 py-3">
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => openAssignModal(row)}
                                >
                                  Assign
                                </Button>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing {approvedQueueRows.length > 0 ? 1 : 0} to {approvedQueueRows.length} of {approvedQueueRows.length} entries</p>
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
                        {(() => {
                          const rows = todayLeaveQueueRows.filter((row: any) =>
                            [row.userName, row.userId, row.reason].join(" ").toLowerCase().includes(attendanceSearch.toLowerCase()),
                          );
                          if (!rows.length) {
                            return (
                              <TableRow>
                                <TableCell colSpan={15} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No leaves for today</span></div></TableCell>
                              </TableRow>
                            );
                          }
                          return rows.map((row: any, i: number) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                              <TableCell className="px-3 py-3 text-slate-500 dark:text-zinc-400">{i + 1}</TableCell>
                              <TableCell className="px-3 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.userName || row.userId || "Unknown"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-600 dark:text-zinc-300">{row.purpose || row.reason || "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-600 dark:text-zinc-300">{row.type || row.leaveType || "Full"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 dark:text-zinc-400">{row.alternative || "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 max-w-[220px] truncate dark:text-zinc-400">{row.reason || row.description || "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-400">-</TableCell>
                              <TableCell className="px-3 py-3 text-slate-400">-</TableCell>
                              <TableCell className="px-3 py-3 text-slate-400">-</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 dark:text-zinc-400">{row.day || "1"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 dark:text-zinc-400">{row.time || "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 whitespace-nowrap dark:text-zinc-400">{row.fromDate ? new Date(row.fromDate).toLocaleDateString() : "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 whitespace-nowrap dark:text-zinc-400">{row.toDate ? new Date(row.toDate).toLocaleDateString() : "-"}</TableCell>
                              <TableCell className="px-3 py-3 text-slate-500 whitespace-nowrap dark:text-zinc-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</TableCell>
                              <TableCell className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => setCurrentView("leave-application")}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-600 text-emerald-600 text-[16px] font-bold hover:bg-emerald-50 transition-colors"
                                  aria-label={`Open leave application for ${row.userName || row.userId}`}
                                >
                                  +
                                </button>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <p className="text-slate-400 text-xs">Showing {todayLeaveQueueRows.length > 0 ? 1 : 0} to {todayLeaveQueueRows.length} of {todayLeaveQueueRows.length} entries</p>
                    <div className="flex gap-1">
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Previous</Button>
                      <Button variant="outline" className="h-8 px-4 text-xs font-bold text-slate-500 rounded-lg border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Next</Button>
                    </div>
                  </div>
                </>
              )}

              {/*
                NOTE (left mocked intentionally): "Team Yearly Leave" (Total/Unpaid/CM Leaves,
                L-Approval, Last Increment, Expire) and "Team Balance Leave" (Available Leaves +
                MA/HODA/AP multi-stage approval) below have no backing schema. `leave_requests`
                only tracks a single fromDate/toDate/status/approvedByUserId per request — there is
                no yearly leave quota, no half-leave/CM-leave bookkeeping, no multi-stage
                Manager/HOD/Admin approval chain, and no salary-increment tracking anywhere in
                shared/schema.ts. Wiring these would require inventing a business rule (what the
                yearly quota is, how it decrements, what "Last Increment" means) that isn't
                evidenced anywhere in the codebase, so both tabs are left as static mock per the
                task instructions and flagged in the report.
              */}
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
                        {filteredTeamBalanceRows.map((row: any, i: number) => (
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
                  <TableBody>
                    {isExecutionRowsLoading || !executionRows.length ? (
                      <EmptyRow cols={9} />
                    ) : (
                      executionRows.map((row: any) => {
                        const freeMinutes = Math.max((row.assignedDurationMinutes || 0) - (row.spentMinutes || 0), 0);
                        return (
                          <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                            <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.assignee?.name || "Unassigned"}</TableCell>
                            <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.companyName || "-"}</TableCell>
                            <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.name || row.title || "-"}</TableCell>
                            <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{freeMinutes} min</TableCell>
                            <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.title || "-"}</TableCell>
                            <TableCell className="px-4 py-3"><Badge className="bg-slate-100 text-slate-700 border border-slate-200 font-semibold">{row.phaseLabel}</Badge></TableCell>
                            <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{(row.spentMinutes || 0) > 0 ? "Running" : "Idle"}</TableCell>
                            <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.totalDurationMinutes || 0} min</TableCell>
                            <TableCell className="px-4 py-3"><ArrowRight className="w-3.5 h-3.5 text-emerald-500" /></TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* LEAVE REPORT */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
            <SectionHeader title="Leave Report">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={leaveReportUser}
                    onChange={(e) => setLeaveReportUser(e.target.value)}
                    className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] appearance-none outline-none bg-white w-32 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                  >
                    <option value="">All Users</option>
                    {Array.from(new Set((rawLeaveData as any[]).map((item) => item.userName || item.userId).filter(Boolean))).map((name) => (
                      <option key={String(name)} value={String(name)}>{String(name)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <Input type="date" value={leaveReportStart} onChange={(e) => setLeaveReportStart(e.target.value)} className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Input type="date" value={leaveReportEnd} onChange={(e) => setLeaveReportEnd(e.target.value)} className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Button className="h-8 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-[11px] border-none gap-1 rounded-lg shadow-sm">
                  <Filter className="w-3 h-3" /> Filter
                </Button>
                <button
                  type="button"
                  onClick={() => { setLeaveReportUser(""); setLeaveReportStart(""); setLeaveReportEnd(""); }}
                  className="h-8 w-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800"
                >
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
                    {(() => {
                      const rows = (rawLeaveData as any[]).filter((item) => {
                        const matchesUser = !leaveReportUser || (item.userName || item.userId) === leaveReportUser;
                        const from = item.fromDate ? new Date(item.fromDate).toISOString().slice(0, 10) : "";
                        const matchesStart = !leaveReportStart || from >= leaveReportStart;
                        const matchesEnd = !leaveReportEnd || from <= leaveReportEnd;
                        return matchesUser && matchesStart && matchesEnd;
                      });
                      if (!rows.length) {
                        return <TableRow><TableCell colSpan={7} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No records found</span></div></TableCell></TableRow>;
                      }
                      return rows.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                          <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{item.userName || item.userId || "Unknown"}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.purpose || item.reason || "-"}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.type || item.leaveType || "Full"}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-500 whitespace-nowrap dark:text-zinc-400">
                            {item.fromDate ? new Date(item.fromDate).toLocaleDateString() : "-"} - {item.toDate ? new Date(item.toDate).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-slate-500 max-w-[200px] truncate dark:text-zinc-400">{item.rejectionReason || "-"}</TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge className={
                              item.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              item.status === "Rejected" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            }>{item.status || "Pending"}</Badge>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
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
                  <select
                    value={overtimeReportUser}
                    onChange={(e) => { setOvertimeReportUser(e.target.value); setOvertimeReportPage(1); }}
                    className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] appearance-none outline-none bg-white w-32 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                  >
                    <option value="">All Users</option>
                    {Array.from(new Set(overtimeRows.map((row: any) => row.name).filter(Boolean))).map((name) => (
                      <option key={String(name)} value={String(name)}>{String(name)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <Input type="date" value={overtimeReportStart} onChange={(e) => { setOvertimeReportStart(e.target.value); setOvertimeReportPage(1); }} className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Input type="date" value={overtimeReportEnd} onChange={(e) => { setOvertimeReportEnd(e.target.value); setOvertimeReportPage(1); }} className="h-8 border-slate-200 rounded-lg text-[11px] w-36 dark:border-zinc-800" />
                <Button className="h-8 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-[11px] border-none gap-1 rounded-lg shadow-sm">
                  <Filter className="w-3 h-3" /> Filter
                </Button>
                <button
                  type="button"
                  onClick={() => { setOvertimeReportUser(""); setOvertimeReportStart(""); setOvertimeReportEnd(""); setOvertimeReportPage(1); }}
                  className="h-8 w-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800"
                >
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
                    {(() => {
                      const rows = overtimeRows.filter((row: any) => {
                        const matchesUser = !overtimeReportUser || row.name === overtimeReportUser;
                        const created = row.createdAtRaw ? new Date(row.createdAtRaw).toISOString().slice(0, 10) : "";
                        const matchesStart = !overtimeReportStart || created >= overtimeReportStart;
                        const matchesEnd = !overtimeReportEnd || created <= overtimeReportEnd;
                        return matchesUser && matchesStart && matchesEnd;
                      });
                      if (!rows.length) {
                        return <TableRow><TableCell colSpan={6} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><Activity className="w-5 h-5 opacity-40" /><span className="text-[11px] italic">No overtime records found for the selected filters</span></div></TableCell></TableRow>;
                      }
                      const totalPages = Math.max(1, Math.ceil(rows.length / OVERTIME_REPORT_PAGE_SIZE));
                      const page = Math.min(overtimeReportPage, totalPages);
                      const pagedRows = rows.slice((page - 1) * OVERTIME_REPORT_PAGE_SIZE, page * OVERTIME_REPORT_PAGE_SIZE);
                      return pagedRows.map((row: any) => (
                        <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                          <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.create}</TableCell>
                          <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.name}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.task || "-"}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.time}</TableCell>
                          <TableCell className="px-4 py-3 text-slate-400">-</TableCell>
                          <TableCell className="px-4 py-3 text-slate-500 max-w-[240px] truncate dark:text-zinc-400">{row.detail || "-"}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const rows = overtimeRows.filter((row: any) => {
                  const matchesUser = !overtimeReportUser || row.name === overtimeReportUser;
                  const created = row.createdAtRaw ? new Date(row.createdAtRaw).toISOString().slice(0, 10) : "";
                  const matchesStart = !overtimeReportStart || created >= overtimeReportStart;
                  const matchesEnd = !overtimeReportEnd || created <= overtimeReportEnd;
                  return matchesUser && matchesStart && matchesEnd;
                });
                const totalPages = Math.max(1, Math.ceil(rows.length / OVERTIME_REPORT_PAGE_SIZE));
                const page = Math.min(overtimeReportPage, totalPages);
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                      {rows.length === 0
                        ? "Showing 0 entries"
                        : `Showing ${(page - 1) * OVERTIME_REPORT_PAGE_SIZE + 1} to ${Math.min(page * OVERTIME_REPORT_PAGE_SIZE, rows.length)} of ${rows.length} entries`}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] px-3"
                        disabled={page <= 1}
                        onClick={() => setOvertimeReportPage((p: any) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] px-3"
                        disabled={page >= totalPages}
                        onClick={() => setOvertimeReportPage((p: any) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                );
              })()}
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
              {projectOverviewButtons.map((label: any, idx: number) => (
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
              {importantItems.map(([label, val, cls]: any, i) => (
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
                {teamRows.map((row: any, i: number) => (
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
              <select
                value={monthlyProjectPeriod}
                onChange={(e) => setMonthlyProjectPeriod(e.target.value as "WK" | "MON")}
                className="h-8 border border-slate-200 rounded-lg px-3 pr-8 text-[11px] font-bold appearance-none outline-none bg-white text-slate-600 w-20 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
              >
                <option value="WK">WK</option><option value="MON">MON</option>
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
                {(() => {
                  const now = new Date();
                  const periodStart = new Date(now);
                  if (monthlyProjectPeriod === "WK") {
                    periodStart.setDate(periodStart.getDate() - 7);
                  } else {
                    periodStart.setDate(1);
                    periodStart.setHours(0, 0, 0, 0);
                  }
                  const rows = executionRows.filter((row: any) => {
                    if (row.status !== "VERIFICATION_COMPLETE") return false;
                    const completedAt = row.verificationReviewedAt || row.managerCompletedAt || row.createdAt;
                    return completedAt && new Date(completedAt) >= periodStart;
                  });
                  if (!rows.length) {
                    return <TableRow><TableCell colSpan={12} className="h-16 text-center"><div className="flex flex-col items-center gap-1 text-slate-400"><CheckCircle2 className="w-5 h-5 opacity-30" /><span className="text-[11px] italic">No data available</span></div></TableCell></TableRow>;
                  }
                  return rows.map((row: any, i: number) => {
                    const link = row.evidenceLinks?.[0]?.url;
                    return (
                      <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 dark:border-zinc-800">
                        <TableCell className="px-4 py-3">
                          <input type="checkbox" className="rounded border-slate-300 accent-emerald-500 dark:border-zinc-800" />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{i + 1}</TableCell>
                        <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">{row.assignee?.name || "Unassigned"}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.companyName || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.name || row.title || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">0 min</TableCell>
                        <TableCell className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.title || "-"}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">{row.phaseLabel}</Badge></TableCell>
                        <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">Done</TableCell>
                        <TableCell className="px-4 py-3 text-slate-500 dark:text-zinc-400">{row.totalDurationMinutes || 0} min</TableCell>
                        <TableCell className="px-4 py-3">
                          {link ? (
                            <a href={link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline text-[11px] font-semibold">Open</a>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ASSIGN TASK MODAL */}
      {assignModalOpen && assignTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4">
          <div className="w-full max-w-[560px] rounded-[10px] bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 dark:border-zinc-800">
              <h2 className="text-[18px] font-semibold text-slate-700 dark:text-zinc-300">Assign Project — {assignTarget.project?.name}</h2>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close assign project modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {workflowActionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{workflowActionError}</div>
              )}

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Assign To Executive <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={assignForm.assigneeId}
                    onChange={(e) => setAssignForm((prev: any) => ({ ...prev, assigneeId: e.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-[13px] text-slate-700 outline-none appearance-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Select executive...</option>
                    {softwareExecutives.map((exec: any) => (
                      <option key={exec.id} value={exec.id}>{exec.name || exec.fullName || exec.email}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Task Title</label>
                <Input
                  value={assignForm.title}
                  onChange={(e) => setAssignForm((prev: any) => ({ ...prev, title: e.target.value }))}
                  className="h-11 border-slate-200 text-[13px] dark:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Duration (Hours)</label>
                  <Input
                    type="number"
                    min="0"
                    value={assignForm.hours}
                    onChange={(e) => setAssignForm((prev: any) => ({ ...prev, hours: e.target.value }))}
                    className="h-11 border-slate-200 text-[13px] dark:border-zinc-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Duration (Minutes)</label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={assignForm.minutes}
                    onChange={(e) => setAssignForm((prev: any) => ({ ...prev, minutes: e.target.value }))}
                    className="h-11 border-slate-200 text-[13px] dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Reference Links</label>
                <Input
                  value={assignForm.links}
                  onChange={(e) => setAssignForm((prev: any) => ({ ...prev, links: e.target.value }))}
                  placeholder="https://..."
                  className="h-11 border-slate-200 text-[13px] dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-5 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignModalOpen(false)}
                className="h-11 px-6 border-slate-200 bg-[#777e95] text-white hover:bg-[#656c82] hover:text-white dark:border-zinc-800"
              >
                Close
              </Button>
              <Button
                type="button"
                disabled={!assignForm.assigneeId || assignTaskMutation.isPending}
                onClick={() => assignTaskMutation.mutate()}
                className="h-11 px-6 bg-[#0c9b57] hover:bg-[#09884c] text-white font-semibold disabled:opacity-50"
              >
                {assignTaskMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

