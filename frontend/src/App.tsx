import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ScreenContextProvider } from "@/contexts/screen-context";
import { AIAssistantButton } from "@/components/ai-assistant-button";
import { lazy, Suspense, useEffect, useState } from "react";
import { useRouteProtection } from "@/hooks/useRouteProtection";

// ---------------------------------------------------------------------------
// Feature-flag helpers (not components) — kept as a static import since they
// run synchronously while choosing which route component to render below.
// ---------------------------------------------------------------------------
import { isSupportModuleEnabled, isBotSystemEnabled, isOnlineFormEnabled, isFbPostEnabled } from "@/lib/feature-flags";

// ---------------------------------------------------------------------------
// Lazily loaded (code-split): none of these are required to render the
// initial Home/Admin Dashboard, so they're fetched on demand instead of being
// bundled into the main entry chunk. (Previously static imports — this also
// removes the xlsx/jsPDF/jspdf-autotable/html2canvas code pulled in by a few
// of these pages from every page load.)
// ---------------------------------------------------------------------------
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth"));
const CustomerManagement = lazy(() => import("@/pages/customer-management"));
const DuplicateChecker = lazy(() => import("@/pages/duplicate-checker"));
const AddCustomer = lazy(() => import("@/pages/add-customer"));
const TempContact = lazy(() => import("@/pages/temp-contact"));
const LeadPools = lazy(() => import("@/pages/lead-pools"));
const InvoicePool = lazy(() => import("@/pages/invoice-pool"));
const AttendanceManagement = lazy(() => import("@/pages/attendance-management"));
const LeaveRequest = lazy(() => import("@/pages/leave-request"));
const OvertimeSubmission = lazy(() => import("@/pages/overtime-submission"));
const LoanRequest = lazy(() => import("@/pages/loan-request"));
const SupportTickets = lazy(() => import("@/pages/support-tickets"));
const SupportTicketDetail = lazy(() => import("@/pages/support-ticket-detail"));
const ComplaintsPage = lazy(() => import("@/pages/complaints"));
const SupportInactive = lazy(() => import("@/pages/support-inactive"));
const BotSystemInactive = lazy(() => import("@/pages/bot-system-inactive"));
const OnlineFormInactive = lazy(() => import("@/pages/online-form-inactive"));
const FbPostInactive = lazy(() => import("@/pages/fb-post-inactive"));
const AMinusCustomersPage = lazy(() => import("@/pages/a-minus-customers"));
const VasDocumentsPage = lazy(() => import("@/pages/vas-documents"));
const TrainingCenter = lazy(() => import("@/pages/training-center"));
const Workspace = lazy(() => import("@/pages/workspace"));
const PoliciesSettings = lazy(() => import("@/pages/policies-settings"));
const NoticeBoard = lazy(() => import("@/pages/notice-board"));
const AddPortfolio = lazy(() => import("@/pages/add-portfolio"));
const PortfolioList = lazy(() => import("@/pages/portfolio-list"));
const ItServers = lazy(() => import("@/pages/it-servers"));
const ItDomains = lazy(() => import("@/pages/it-domains"));
const ItBackup = lazy(() => import("@/pages/it-backup"));
const ItSystemReport = lazy(() => import("@/pages/it-system-report"));
const AccountGmEntries = lazy(() => import("@/pages/account-gm-entries"));
const AccountTempGm = lazy(() => import("@/pages/account-temp-gm"));
const AccountRefundGm = lazy(() => import("@/pages/account-refund-gm"));
const AccountDonations = lazy(() => import("@/pages/account-donations"));
const AppointmentsPage = lazy(() => import("@/pages/appointments"));
const AttendanceTodo = lazy(() => import("@/pages/attendance-todo"));
const SalesTargets = lazy(() => import("@/pages/sales-targets"));
const AccountInvoices = lazy(() => import("@/pages/account-invoices"));
const AccountLedger = lazy(() => import("@/pages/account-ledger"));
const OfficeExpenses = lazy(() => import("@/pages/office-expenses"));
const ChartOfAccounts = lazy(() => import("@/pages/chart-of-accounts"));
const GeneralLedger = lazy(() => import("@/pages/general-ledger"));
const JournalVoucher = lazy(() => import("@/pages/journal-voucher"));
const OfficeVasPage = lazy(() => import("@/pages/office-vas"));
const Approvals = lazy(() => import("@/pages/approvals"));
const ChequeSystem = lazy(() => import("@/pages/cheque-system"));
const BusinessCustomers = lazy(() => import("@/pages/business-customers"));
const GmPoolAddGm = lazy(() => import("@/pages/gm-pool-add-gm"));
const QuotationPage = lazy(() => import("@/pages/quotation"));
const CustomersVerification = lazy(() => import("@/pages/customers-verification"));
const TracingPage = lazy(() => import("@/pages/tracing"));
const TracingViewPage = lazy(() => import("@/pages/tracing-view"));
const CustomerAttributePage = lazy(() => import("@/pages/customer-attribute-page"));
const AddUser = lazy(() => import("@/pages/add-user"));
const CreateInvoice = lazy(() => import("@/pages/sales/create-invoice"));
const CreateTarget = lazy(() => import("./pages/create-target"));
const SetTarget = lazy(() => import("./pages/set-target"));
const ViewTarget = lazy(() => import("./pages/view-target"));
const DailyTarget = lazy(() => import("./pages/daily-target"));
const AddKwa = lazy(() => import("./pages/add-kwa"));
const KwaHistory = lazy(() => import("./pages/kwa-history"));
const UserList = lazy(() => import("@/pages/user-list"));
const UserGroups = lazy(() => import("@/pages/user-groups"));
const AttributesPage = lazy(() => import("@/pages/drm/attributes"));
const PermissionPage = lazy(() => import("@/pages/drm/permission"));
const DelayProjectPage = lazy(() => import("@/pages/drm/delay-project"));
const PromotionPage = lazy(() => import("@/pages/drm/promotion"));
const RelatedCustomerPage = lazy(() => import("@/pages/drm/related-customer"));
const PmsSettingPage = lazy(() => import("@/pages/drm/pms-setting"));
const MonthlyCompleteProject = lazy(() => import("@/pages/drm/monthly-complete-project"));
const OverallReportPage = lazy(() => import("@/pages/drm/overall-report"));
const TodayPostPage = lazy(() => import("@/pages/drm/today-post"));
const AddPenaltyPage = lazy(() => import("@/pages/drm/add-penalty"));
const CommissionVerificationPage = lazy(() => import("@/pages/drm/commission-verification"));
const AllSocialAccountsPage = lazy(() => import("@/pages/drm/all-social-accounts"));
const IncrementPage = lazy(() => import("@/pages/drm/increment"));
const PerformancePage = lazy(() => import("@/pages/drm/performance"));
const LateComingPage = lazy(() => import("@/pages/drm/late-coming"));
const BotSystem = lazy(() => import("@/pages/bot-system"));
const OnlineForm = lazy(() => import("@/pages/online-form"));
const FbPost = lazy(() => import("@/pages/fb-post"));
const DelayProjectsNewPage = lazy(() => import("./pages/drm/delay-projects-new"));
const DollarSystem = lazy(() => import("@/pages/dollar-system"));
const UpcomingProjectPage = lazy(() => import("@/pages/drm/upcoming-project"));
const SocialMedia = lazy(() => import("@/pages/social-media"));
const VasSystem = lazy(() => import("@/pages/vas-system"));
const OfficeTrialBalance = lazy(() => import("@/pages/office-trial-balance"));
const AllowedIpList = lazy(() => import("@/pages/allowed-ip-list"));

// ---------------------------------------------------------------------------
// Lazily loaded (code-split) heavy pages: dashboards, reports, service, PMS,
// product-posting, and events. These only render inside the Suspense boundary
// wrapping the router <Switch>.
// ---------------------------------------------------------------------------
// Dashboards
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SalesExecutiveDashboard = lazy(() => import("@/pages/sales-executive-dashboard"));
const SalesManagerDashboard = lazy(() => import("@/pages/sales-manager-dashboard"));
const SalesAssistantManagerDashboard = lazy(() => import("@/pages/sales-assistant-manager-dashboard"));
const AccountManagerDashboard = lazy(() => import("@/pages/account-manager-dashboard"));
const HodDashboard = lazy(() => import("@/pages/hod-dashboard"));
const SuperHODDashboard = lazy(() => import("@/pages/super-hod-dashboard"));
const DDManagerDashboard = lazy(() => import("@/pages/dd-manager-dashboard"));
const DDExecutiveDashboard = lazy(() => import("@/pages/dd-executive-dashboard"));
const DeveloperDashboard = lazy(() => import("@/pages/developer-dashboard"));
const ItManagerDashboard = lazy(() => import("@/pages/it-manager-dashboard"));
const ServiceManagerDashboard = lazy(() => import("@/pages/service-manager-dashboard"));
const ServiceAssistantManagerDashboard = lazy(() => import("@/pages/service-assistant-manager-dashboard"));
const ServiceExecutiveDashboard = lazy(() => import("@/pages/service-executive-dashboard"));
const ReceptionDashboard = lazy(() => import("@/pages/reception-dashboard"));
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin-dashboard"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AuditLogsPage = lazy(() => import("@/pages/admin/audit-logs"));
const ProductPostingDashboard = lazy(() => import("@/pages/product-posting-dashboard"));
const QAManagerDashboard = lazy(() => import("@/pages/qa-manager-dashboard"));
const VerificationManagerDashboard = lazy(() => import("@/pages/verification-manager-dashboard"));
const SeoSmmManagerDashboard = lazy(() => import("@/pages/seo-smm-manager-dashboard"));
const LeadManagerDashboard = lazy(() => import("@/pages/lead-manager-dashboard"));
const LeadExecutiveDashboard = lazy(() => import("@/pages/lead-executive-dashboard"));
const SoftwareManagerDashboard = lazy(() => import("@/pages/software-manager-dashboard"));
const SoftwareExecutiveDashboard = lazy(() => import("@/pages/software-executive-dashboard"));
const MarketingManagerDashboard = lazy(() => import("@/pages/marketing-manager-dashboard"));

// Reports
const AttendanceReport = lazy(() => import("@/pages/attendance-report"));
const ReportsBvPendingRc = lazy(() => import("@/pages/reports-bv-pending-rc"));
const ReportsBvPendingEcnc = lazy(() => import("@/pages/reports-bv-pending-ecnc"));
const ReportsInService = lazy(() => import("@/pages/reports-in-service"));
const ReportsDiagnose = lazy(() => import("@/pages/reports-diagnose"));
const ReportsFollowUp = lazy(() => import("@/pages/reports-follow-up"));
const ReportsProjects = lazy(() => import("@/pages/reports-projects"));
const ReportsDayTarget = lazy(() => import("@/pages/reports-day-target"));
const PostingDataLinkReport = lazy(() => import("@/pages/posting-data-link-report"));
const UserReports = lazy(() => import("@/pages/user-reports"));
const UserActivityReport = lazy(() => import("@/pages/user-report"));
const LedgerReport = lazy(() => import("@/pages/ledger-report"));
const GMReport = lazy(() => import("@/pages/gm-report"));
const RefundReport = lazy(() => import("@/pages/refund-report"));
const InvoiceReport = lazy(() => import("@/pages/invoice-report"));
const BvReportNew = lazy(() => import("@/pages/bv-report-new"));
const LoanReportNew = lazy(() => import("@/pages/loan-report-new"));
const VasReportNew = lazy(() => import("@/pages/vas-report-new"));
const GmReportNew = lazy(() => import("@/pages/gm-report-new"));
const LoanReportEdit = lazy(() => import("@/pages/loan-report-edit"));
const SalaryCreate = lazy(() => import("@/pages/salary-create"));
const SalaryReport = lazy(() => import("@/pages/salary-report"));
const SalaryBonuses = lazy(() => import("@/pages/salary-bonuses"));
const AbReport = lazy(() => import("@/pages/ab-report"));
const ReportsRawAttendance = lazy(() => import("@/pages/reports-raw-attendance"));
const EditAtt = lazy(() => import("@/pages/reports-edit-att"));
const ReceptionReport = lazy(() => import("@/pages/reports-reception"));
const EventReport = lazy(() => import("@/pages/reports-event"));
const DepartmentReport = lazy(() => import("@/pages/reports-department"));
const DailyAddedGmReport = lazy(() => import("@/pages/daily-added-gm-report"));

// Service
const PublicPoolFollowup = lazy(() => import("@/pages/public-pool-followup"));
const ServicePoolDashboard = lazy(() => import("@/pages/service-pool-dashboard"));
const ServiceBvChecking = lazy(() => import("@/pages/service-bv-checking"));
const ServicePublicPool = lazy(() => import("@/pages/service-public-pool"));
const ServiceACustomer = lazy(() => import("@/pages/service-a-customer"));
const ServiceBPlusCustomer = lazy(() => import("@/pages/service-b-plus-customer"));
const ServiceBCustomer = lazy(() => import("@/pages/service-b-customer"));
const ServiceBMinusCustomer = lazy(() => import("@/pages/service-b-minus-customer"));
const ServiceMonthlyFollowup = lazy(() => import("@/pages/service-monthly-followup"));
const ServiceWeeklyDropout = lazy(() => import("@/pages/service-weekly-dropout"));
const ServiceDropoutCustomer = lazy(() => import("@/pages/service-dropout-customer"));
const ServiceComplaintList = lazy(() => import("@/pages/service-complaint-list"));
const ServiceNotFollowCustomer = lazy(() => import("@/pages/service-not-follow-customer"));
const ServiceBvDocumentList = lazy(() => import("@/pages/service-bv-document-list"));
const ServiceVasDocumentList = lazy(() => import("@/pages/service-vas-document-list"));
const ServiceDueVasPayment = lazy(() => import("@/pages/service-due-vas-payment"));
const ServiceTodoList = lazy(() => import("@/pages/service-todo-list"));
const ServicePool = lazy(() => import("@/pages/service-pool"));
const ServicePrivatePool = lazy(() => import("@/pages/service-private-pool"));

// PMS
const PmsTasks = lazy(() => import("@/pages/pms-tasks"));
const PmsStatus = lazy(() => import("@/pages/pms-status"));
const PmsRunningProjects = lazy(() => import("@/pages/pms-running-projects"));
const PmsCompletedProjects = lazy(() => import("@/pages/pms-completed-projects"));
const PmsPendingApprovals = lazy(() => import("@/pages/pms-pending-approvals"));
const PmsTaskHistory = lazy(() => import("@/pages/pms-task-history"));
const PmsTeamWorkspace = lazy(() => import("@/pages/pms-team-workspace"));
const PmsTaskTemplates = lazy(() => import("@/pages/pms-task-templates"));
const PmsProjectReport = lazy(() => import("@/pages/pms-project-report"));

// Product posting
const PostingData = lazy(() => import("@/pages/posting-data"));

// Events
const EventsAdd = lazy(() => import("@/pages/events-add"));
const EventsMenu = lazy(() => import("@/pages/events-menu"));
const EventsDutyPlanner = lazy(() => import("@/pages/events-duty-planner"));

function DynamicPrivatePool() {
  const userRole = sessionStorage.getItem("userRole")?.toLowerCase().replace(/\s+/g, "_") || "";
  if (userRole.includes("service")) return <ServicePrivatePool />;
  return <LeadPools />;
}

function DynamicPublicPool() {
  const userRole = sessionStorage.getItem("userRole")?.toLowerCase().replace(/\s+/g, "_") || "";
  if (userRole.includes("service")) return <ServicePublicPool />;
  return <LeadPools />;
}

function PageLoader() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/hod" component={HodDashboard} />
      <Route path="/dashboard/super-hod" component={SuperHODDashboard} />
      <Route path="/dashboard/sales-manager" component={SalesManagerDashboard} />
      <Route path="/dashboard/sales-assistant-manager" component={SalesAssistantManagerDashboard} />
      <Route path="/dashboard/account-manager" component={AccountManagerDashboard} />
      <Route path="/dashboard/sales-executive" component={SalesExecutiveDashboard} />
      <Route path="/dashboard/dd-manager" component={DDManagerDashboard} />
      <Route path="/dashboard/it-manager" component={ItManagerDashboard} />
      <Route path="/dashboard/service-manager" component={ServiceManagerDashboard} />
      <Route path="/dashboard/service-assistant-manager" component={ServiceAssistantManagerDashboard} />
      <Route path="/dashboard/service-executive" component={ServiceExecutiveDashboard} />
      <Route path="/dashboard/vas-system" component={VasSystem} />
      <Route path="/dashboard/reception" component={ReceptionDashboard} />
      <Route path="/product-posting/manager" component={ProductPostingDashboard} />
      <Route path="/product-posting/executive" component={ProductPostingDashboard} />
      <Route path="/qa/manager" component={QAManagerDashboard} />
      <Route path="/verification/manager" component={VerificationManagerDashboard} />
      <Route path="/verification/customers" component={CustomersVerification} />
      <Route path="/dashboard/seo-smm" component={SeoSmmManagerDashboard} />
      <Route path="/dashboard/dd-executive" component={DDExecutiveDashboard} />
      <Route path="/dashboard/developer" component={DeveloperDashboard} />
      <Route path="/product-posting" component={ProductPostingDashboard} />
      <Route path="/dashboard/lead-manager" component={LeadManagerDashboard} />
      <Route path="/dashboard/lead-executive" component={LeadExecutiveDashboard} />
      <Route path="/dashboard/software-manager" component={SoftwareManagerDashboard} />
      <Route path="/dashboard/software-executive" component={SoftwareExecutiveDashboard} />
      <Route path="/dashboard/marketing-manager" component={MarketingManagerDashboard} />
      <Route path="/events/add" component={EventsAdd} />
      <Route path="/events/menu" component={EventsMenu} />
      <Route path="/events/duty-planner" component={EventsDutyPlanner} />
      <Route path="/social-media" component={SocialMedia} />
      <Route path="/sales/customers" component={CustomerManagement} />
      <Route path="/sales/duplicate-checker" component={DuplicateChecker} />
      <Route path="/sales/add-customer" component={AddCustomer} />
      <Route path="/customer/temporary-contact" component={TempContact} />
      {/* Alias → canonical /customer/temporary-contact (Stage 2) */}
      <Route path="/sales/temp-contact">{() => <Redirect to="/customer/temporary-contact" />}</Route>
      <Route path="/sales/tracing" component={TracingPage} />
      <Route path="/sales/tracing/view/:id" component={TracingViewPage} />
      <Route path="/customers/private-pool" component={DynamicPrivatePool} />
      <Route path="/customers/attribute/:id" component={CustomerAttributePage} />
      <Route path="/customers/service-pool" component={ServicePool} />
      <Route path="/customers/gmbv-pool" component={LeadPools} />
      <Route path="/customers/public-pool" component={DynamicPublicPool} />
      <Route path="/customers/public-pool-followup" component={PublicPoolFollowup} />
      <Route path="/sales/lead-pools" component={LeadPools} />
      <Route path="/sales/invoice-pool" component={InvoicePool} />
      <Route path="/drm/attributes" component={AttributesPage} />
      <Route path="/gm-pool/add-gm" component={GmPoolAddGm} />
      <Route path="/sales/appointments" component={AppointmentsPage} />
      <Route path="/sales/targets" component={SalesTargets} />
      <Route path="/hr/attendance" component={AttendanceManagement} />
      <Route path="/hr/attendance/todo" component={AttendanceTodo} />
      <Route path="/hr/leave-request" component={LeaveRequest} />
      <Route path="/hr/overtime" component={OvertimeSubmission} />
      <Route path="/hr/loan" component={LoanRequest} />
      <Route path="/projects/upcoming" component={UpcomingProjectPage} />
      <Route path="/pms/tasks" component={PmsTasks} />
      {/* Alias → canonical /drm/delay-project (Stage 2) */}
      <Route path="/projects">{() => <Redirect to="/drm/delay-project" />}</Route>
      <Route path="/pms/task-templates" component={PmsTaskTemplates} />
      <Route path="/pms/status" component={PmsStatus} />
      <Route path="/drm/delay-project" component={DelayProjectPage} />
      <Route path="/drm/delay-projects-new" component={DelayProjectsNewPage} />
      <Route path="/drm/pms-setting" component={PmsSettingPage} />
      {/* Deprecated alias: canonical PMS settings live at /drm/pms-setting */}
      <Route path="/pms/settings">{() => <Redirect to="/drm/pms-setting" />}</Route>
      <Route path="/drm/monthly-complete-project" component={MonthlyCompleteProject} />
      <Route path="/drm/overall-report" component={OverallReportPage} />
      <Route path="/drm/today-post" component={TodayPostPage} />
      <Route path="/drm/add-penalty" component={AddPenaltyPage} />
      <Route path="/drm/commission-verification" component={CommissionVerificationPage} />
      <Route path="/drm/all-social-accounts" component={AllSocialAccountsPage} />
      <Route path="/drm/increment" component={IncrementPage} />
      <Route path="/drm/performance" component={PerformancePage} />
      <Route path="/drm/late-coming" component={LateComingPage} />
      <Route path="/pms/running-projects" component={PmsRunningProjects} />
      <Route path="/pms/completed-projects" component={PmsCompletedProjects} />
      <Route path="/pms/approvals" component={PmsPendingApprovals} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/pms/task-history" component={PmsTaskHistory} />
      <Route path="/pms/project-report" component={PmsProjectReport} />
      {/* Alias → canonical /pms/project-report (Stage 2) */}
      <Route path="/dd-manager/project-report">{() => <Redirect to="/pms/project-report" />}</Route>
      <Route path="/pms/team-workspace" component={PmsTeamWorkspace} />
      <Route path="/service/pool" component={ServicePoolDashboard} />
      <Route path="/service/bv-checking" component={ServiceBvChecking} />
      <Route path="/service/public-pool" component={ServicePublicPool} />
      <Route path="/office/trial-balance-report" component={OfficeTrialBalance} />
      <Route path="/office/old-account-head">{() => <Redirect to="/office/chart-of-accounts" />}</Route>
      <Route path="/office/chart-of-accounts" component={ChartOfAccounts} />
      <Route path="/office/general-ledger" component={GeneralLedger} />
      <Route path="/office/journal-voucher" component={JournalVoucher} />
      <Route path="/office/account-head">{() => <Redirect to="/office/chart-of-accounts" />}</Route>
      <Route path="/service/a-customer" component={ServiceACustomer} />
      <Route path="/service/b-plus-customer" component={ServiceBPlusCustomer} />
      <Route path="/service/b-customer" component={ServiceBCustomer} />
      <Route path="/service/b-minus-customer" component={ServiceBMinusCustomer} />
      <Route path="/service/monthly-followup" component={ServiceMonthlyFollowup} />
      <Route path="/service/weekly-dropout" component={ServiceWeeklyDropout} />
      <Route path="/service/dropout-customer" component={ServiceDropoutCustomer} />
      <Route path="/service/complaint-list" component={ServiceComplaintList} />
      <Route path="/service/not-follow-customer" component={ServiceNotFollowCustomer} />
      <Route path="/service/bv-document-list" component={ServiceBvDocumentList} />
      <Route path="/service/vas-document-list" component={ServiceVasDocumentList} />
      <Route path="/service/due-vas-payment" component={ServiceDueVasPayment} />
      <Route path="/service/todo-list" component={ServiceTodoList} />
      <Route path="/drm/bot-system" component={isBotSystemEnabled() ? BotSystem : BotSystemInactive} />
      <Route path="/drm/online-form" component={isOnlineFormEnabled() ? OnlineForm : OnlineFormInactive} />
      <Route path="/drm/fb-post" component={isFbPostEnabled() ? FbPost : FbPostInactive} />
      <Route path="/account/gm-entries" component={AccountGmEntries} />
      <Route path="/support/tickets" component={isSupportModuleEnabled() ? SupportTickets : SupportInactive} />
      <Route path="/support/tickets/:id" component={isSupportModuleEnabled() ? SupportTicketDetail : SupportInactive} />
      <Route path="/support/complaints" component={isSupportModuleEnabled() ? ComplaintsPage : SupportInactive} />
      <Route path="/sales/customers/a-minus" component={AMinusCustomersPage} />
      <Route path="/office/vas-documents" component={VasDocumentsPage} />
      <Route path="/reports/bv-pending-rc" component={ReportsBvPendingRc} />
      <Route path="/reports/bv-pending-ecnc" component={ReportsBvPendingEcnc} />
      <Route path="/reports/in-service" component={ReportsInService} />
      <Route path="/reports/follow-up" component={ReportsFollowUp} />
      <Route path="/reports/projects" component={ReportsProjects} />
      <Route path="/reports/day-target" component={ReportsDayTarget} />

      <Route path="/reports/diagnose" component={ReportsDiagnose} />
      <Route path="/reports/attendance" component={AttendanceReport} />
      <Route path="/reports/raw-attendance" component={ReportsRawAttendance} />
      <Route path="/reports/salary-create" component={SalaryCreate} />
      <Route path="/reports/salary-bonuses" component={SalaryBonuses} />
      <Route path="/reports/salary" component={SalaryReport} />
      <Route path="/reports/reception" component={ReceptionReport} />
      <Route path="/reports/event" component={EventReport} />
      <Route path="/reports/department" component={DepartmentReport} />
      <Route path="/reports/edit-att" component={EditAtt} />
      <Route path="/reports" component={UserReports} />
      <Route path="/reports/:type" component={UserReports} />
      <Route path="/analytics/user-activity" component={UserActivityReport} />
      <Route path="/analytics/ledger" component={LedgerReport} />
      <Route path="/analytics/gm" component={GMReport} />
      <Route path="/analytics/refund" component={RefundReport} />
      <Route path="/analytics/invoice" component={InvoiceReport} />
      <Route path="/training" component={TrainingCenter} />
      <Route path="/super-admin" component={SuperAdminDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/audit-logs" component={AuditLogsPage} />
      <Route path="/training/:category" component={TrainingCenter} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/policies" component={PoliciesSettings} />
      <Route path="/notice-board" component={NoticeBoard} />
      <Route path="/account/temp-gm" component={AccountTempGm} />
      <Route path="/account/refund-gm" component={AccountRefundGm} />
      <Route path="/account/donations" component={AccountDonations} />
      <Route path="/account/invoices" component={AccountInvoices} />
      <Route path="/account/ab-report" component={AbReport} />
      <Route path="/account/dollar-system" component={DollarSystem} />
      <Route path="/account/ledger" component={AccountLedger} />
      <Route path="/office/expenses" component={OfficeExpenses} />
      <Route path="/office/vas" component={OfficeVasPage} />
      <Route path="/office/cheques" component={ChequeSystem} />
      <Route path="/office/business-customers" component={BusinessCustomers} />
      <Route path="/sales/quotation" component={QuotationPage} />
      <Route path="/reports/bv/new" component={BvReportNew} />
      <Route path="/reports/loan/new" component={LoanReportNew} />
      <Route path="/reports/loan/:id/edit" component={LoanReportEdit} />
      <Route path="/reports/vas/new" component={VasReportNew} />
      <Route path="/reports/gm/new" component={GmReportNew} />
      <Route path="/drm/users/add" component={AddUser} />
      <Route path="/drm/users/list" component={UserList} />
      <Route path="/drm/users/groups" component={UserGroups} />
      <Route path="/drm/permission" component={PermissionPage} />
      <Route path="/drm/promotion" component={PromotionPage} />
      <Route path="/drm/related-customer" component={RelatedCustomerPage} />
      <Route path="/sales/create-invoice/:customerId" component={CreateInvoice} />
      <Route path="/posting-data" component={PostingData} />
      <Route path="/posting-data/add-products" component={PostingData} />
      <Route path="/posting-data/add-keywords" component={PostingData} />
      <Route path="/posting-data/keywords" component={PostingData} />
      <Route path="/posting-data/verified" component={PostingData} />
      <Route path="/posting-data/view-keywords" component={PostingData} />
      <Route path="/posting-data/view-products" component={PostingData} />
      <Route path="/posting-data/link-report" component={PostingDataLinkReport} />
      {/* Alias → canonical /posting-data/link-report (Stage 2) */}
      <Route path="/team-report/link-report">{() => <Redirect to="/posting-data/link-report" />}</Route>
      <Route path="/posting-data/data-verify" component={PostingData} />
      <Route path="/posting-data/restricted-keywords" component={PostingData} />
      <Route path="/portfolio-add" component={AddPortfolio} />
      <Route path="/portfolio-view" component={PortfolioList} />
      <Route path="/it/servers" component={ItServers} />
      <Route path="/it/domains" component={ItDomains} />
      <Route path="/it/backup" component={ItBackup} />
      <Route path="/it/system-report" component={ItSystemReport} />
      {/* Target System Module Routes */}
      <Route path="/target-system/create" component={CreateTarget} />
      <Route path="/target-system/set" component={SetTarget} />
      <Route path="/target-system/view" component={ViewTarget} />
      <Route path="/target-system/daily" component={DailyTarget} />
      <Route path="/target-system/add-kwa" component={AddKwa} />
      <Route path="/target-system/kwa-history" component={KwaHistory} />
      <Route path="/allowed-ip/drm-ip-list" component={AllowedIpList} />
      <Route path="/daily-reports/added-gm" component={DailyAddedGmReport} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}



type AuthStatus = "loading" | "authed" | "unauthed";

function AppContent() {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [userName, setUserName] = useState<string>("John Doe");
  const [userRole, setUserRole] = useState<string>("Sales Executive");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  const isAuthRoute = location === "/auth";

  // Add route protection driven by the authoritative server auth state.
  useRouteProtection({
    activeRoleId,
    userRoles,
    ready: authStatus !== "loading",
    isAuthenticated: authStatus === "authed",
  });

  const style = {
    "--sidebar-width": "280px",
  };

  useEffect(() => {
    // The auth page does not require a validated session.
    if (isAuthRoute) return;

    const token = sessionStorage.getItem("token");
    const storedName = sessionStorage.getItem("userName");
    const storedRole = sessionStorage.getItem("userRole");
    const storedRoles = sessionStorage.getItem("userRoles");
    if (storedName) setUserName(storedName);
    if (storedRole) setUserRole(storedRole);
    if (storedRoles) try { setUserRoles(JSON.parse(storedRoles)); } catch { }

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let cancelled = false;

    // Authoritatively validate the session against the server before showing
    // any private page. Stale sessionStorage values are NOT trusted on their own.
    fetch("/api/auth/me", { headers, credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthenticated");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.fullName) {
          setUserName(data.fullName);
          sessionStorage.setItem("userName", data.fullName);
        }
        const effectiveRole = data?.activeRoleId || data?.role;
        if (data?.role) {
          setUserRole(data.role);
          sessionStorage.setItem("userRole", data.role);
        }
        if (effectiveRole) setActiveRoleId(effectiveRole);
        if (data?.roles && Array.isArray(data.roles)) {
          setUserRoles(data.roles);
          sessionStorage.setItem("userRoles", JSON.stringify(data.roles));
        }
        setAuthStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        // Fail-closed: the session is invalid/expired. Clear any stale client
        // state, surface an expired-session message, and force re-login. This
        // prevents private pages from flashing for an unauthenticated user.
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("userName");
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("userRoles");
        sessionStorage.setItem("authMessage", "Your session has expired. Please sign in again.");
        queryClient.clear();
        setAuthStatus("unauthed");
        setLocation("/auth");
      });

    return () => {
      cancelled = true;
    };
  }, [location, isAuthRoute, setLocation]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userRoles");
    // Clear the query cache to ensure subsequent logins do not see cached data
    queryClient.clear();
    setAuthStatus("unauthed");
    setLocation("/auth");
  };

  const renderBody = () => {
    if (isAuthRoute) {
      return <Router />;
    }
    // Hold rendering until the server has validated the session — avoids a
    // flash of private content before auth resolves.
    if (authStatus === "loading") {
      return (
        <div className="flex h-screen w-full items-center justify-center text-muted-foreground">
          Loading…
        </div>
      );
    }
    // Not authenticated: redirect is in flight (handled in the effect / logout).
    if (authStatus !== "authed") {
      return null;
    }
    return (
      <div className="flex w-full min-w-0">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-x-auto">
          <TopBar
            userRole={userRole}
            userRoles={userRoles}
            userName={userName}
            isDark={theme === "dark"}
            onThemeToggle={toggleTheme}
            onLogout={handleLogout}
            onNavigate={(path) => setLocation(path)}
            showPeriodFilter={location.startsWith("/product-posting")}
          />
          <main className="page-frame">
            <Router />
          </main>
        </div>
      </div>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScreenContextProvider>
          <AssistantProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              {renderBody()}
            </SidebarProvider>
            <AIAssistantButton />
            <Toaster />
          </AssistantProvider>
        </ScreenContextProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <AppContent />
      </div>
    </ThemeProvider>
  );
}
