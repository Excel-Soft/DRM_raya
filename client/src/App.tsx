import { Switch, Route } from "wouter";
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
import Dashboard from "@/pages/dashboard";
import SalesExecutiveDashboard from "@/pages/sales-executive-dashboard";
import SalesManagerDashboard from "@/pages/sales-manager-dashboard";
import SalesAssistantManagerDashboard from "@/pages/sales-assistant-manager-dashboard";
import AccountManagerDashboard from "@/pages/account-manager-dashboard";
import HodDashboard from "@/pages/hod-dashboard";
import SuperHODDashboard from "@/pages/super-hod-dashboard";
import DDManagerDashboard from "@/pages/dd-manager-dashboard";
import DDExecutiveDashboard from "@/pages/dd-executive-dashboard";
import ItManagerDashboard from "@/pages/it-manager-dashboard";
import ServiceManagerDashboard from "@/pages/service-manager-dashboard";
import ServiceAssistantManagerDashboard from "@/pages/service-assistant-manager-dashboard";
import ServiceExecutiveDashboard from "@/pages/service-executive-dashboard";
import ReceptionDashboard from "@/pages/reception-dashboard";
import { useRouteProtection } from "@/hooks/useRouteProtection";
import CustomerManagement from "@/pages/customer-management";
import DuplicateChecker from "@/pages/duplicate-checker";
import AddCustomer from "@/pages/add-customer";
import TempContact from "@/pages/temp-contact";
import LeadPools from "@/pages/lead-pools";
import InvoicePool from "@/pages/invoice-pool";
import AttendanceManagement from "@/pages/attendance-management";
import AttendanceReport from "@/pages/attendance-report";
import LeaveRequest from "@/pages/leave-request";
import OvertimeSubmission from "@/pages/overtime-submission";
import LoanRequest from "@/pages/loan-request";
import PmsTasks from "@/pages/pms-tasks";
import PmsStatus from "@/pages/pms-status";
import PmsRunningProjects from "@/pages/pms-running-projects";
import PmsCompletedProjects from "@/pages/pms-completed-projects";
import PmsPendingApprovals from "@/pages/pms-pending-approvals";
import PmsTaskHistory from "@/pages/pms-task-history";
import PmsTeamWorkspace from "@/pages/pms-team-workspace";
import ServicePoolDashboard from "@/pages/service-pool-dashboard";
import ServiceBvChecking from "@/pages/service-bv-checking";
import ServicePublicPool from "@/pages/service-public-pool";
import ServiceACustomer from "@/pages/service-a-customer";
import ServiceBPlusCustomer from "@/pages/service-b-plus-customer";
import ServiceBCustomer from "@/pages/service-b-customer";
import ServiceBMinusCustomer from "@/pages/service-b-minus-customer";
import ServiceMonthlyFollowup from "@/pages/service-monthly-followup";
import ServiceWeeklyDropout from "@/pages/service-weekly-dropout";
import ServiceDropoutCustomer from "@/pages/service-dropout-customer";
import ServiceComplaintList from "@/pages/service-complaint-list";
import ServiceNotFollowCustomer from "@/pages/service-not-follow-customer";
import ServiceBvDocumentList from "@/pages/service-bv-document-list";
import ServiceVasDocumentList from "@/pages/service-vas-document-list";
import ServiceDueVasPayment from "@/pages/service-due-vas-payment";
import ServiceTodoList from "@/pages/service-todo-list";
import PmsTaskTemplates from "@/pages/pms-task-templates";
import ReportsBvPendingRc from "@/pages/reports-bv-pending-rc";
import ReportsBvPendingEcnc from "@/pages/reports-bv-pending-ecnc";
import ReportsInService from "@/pages/reports-in-service";
import ReportsDiagnose from "@/pages/reports-diagnose";
import ReportsFollowUp from "@/pages/reports-follow-up";
import ReportsProjects from "@/pages/reports-projects";
import ReportsDayTarget from "@/pages/reports-day-target";
import PostingDataLinkReport from "@/pages/posting-data-link-report";
import PmsSettings from "@/pages/pms-settings";
import SupportTickets from "@/pages/support-tickets";
import SupportTicketDetail from "@/pages/support-ticket-detail";
import ComplaintsPage from "@/pages/complaints";
import AMinusCustomersPage from "@/pages/a-minus-customers";
import VasDocumentsPage from "@/pages/vas-documents";
import UserReports from "@/pages/user-reports";
import TrainingCenter from "@/pages/training-center";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import Workspace from "@/pages/workspace";
import PoliciesSettings from "@/pages/policies-settings";
import NoticeBoard from "@/pages/notice-board";
import AddPortfolio from "@/pages/add-portfolio";
import PortfolioList from "@/pages/portfolio-list";
import ItServers from "@/pages/it-servers";
import ItDomains from "@/pages/it-domains";
import ItBackup from "@/pages/it-backup";
import PmsProjectReport from "@/pages/pms-project-report";
import ItSystemReport from "@/pages/it-system-report";
import AccountGmEntries from "@/pages/account-gm-entries";
import AccountTempGm from "@/pages/account-temp-gm";
import AccountRefundGm from "@/pages/account-refund-gm";
import AccountDonations from "@/pages/account-donations";
import AppointmentsPage from "@/pages/appointments";
import AttendanceTodo from "@/pages/attendance-todo";
import SalesTargets from "@/pages/sales-targets";
import AccountInvoices from "@/pages/account-invoices";
import AccountLedger from "@/pages/account-ledger";
import OfficeExpenses from "@/pages/office-expenses";
import ChartOfAccounts from "@/pages/chart-of-accounts";
import OfficeAccountHead from "@/pages/office-account-head";
import OfficeVasPage from "@/pages/office-vas";
import ChequeSystem from "@/pages/cheque-system";
import BusinessCustomers from "@/pages/business-customers";
import UserActivityReport from "@/pages/user-report";
import LedgerReport from "@/pages/ledger-report";
import GMReport from "@/pages/gm-report";
import RefundReport from "@/pages/refund-report";
import InvoiceReport from "@/pages/invoice-report";
import GmPoolAddGm from "@/pages/gm-pool-add-gm";
import QuotationPage from "@/pages/quotation";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import ServicePool from "@/pages/service-pool";
import ServicePrivatePool from "@/pages/service-private-pool";
import ProductPostingDashboard from "@/pages/product-posting-dashboard";
import QAManagerDashboard from "@/pages/qa-manager-dashboard";
import VerificationManagerDashboard from "@/pages/verification-manager-dashboard";
import CustomersVerification from "@/pages/customers-verification";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import TracingPage from "@/pages/tracing";
import TracingViewPage from "@/pages/tracing-view";
import BvReportNew from "@/pages/bv-report-new";
import LoanReportNew from "@/pages/loan-report-new";
import VasReportNew from "@/pages/vas-report-new";
import GmReportNew from "@/pages/gm-report-new";
import LoanReportEdit from "@/pages/loan-report-edit";
import SalaryCreate from "@/pages/salary-create";
import SalaryReport from "@/pages/salary-report";
import AddUser from "@/pages/add-user";
import CreateInvoice from "@/pages/sales/create-invoice";
// import AttendanceDetail from "./pages/attendance-detail";
import CreateTarget from "./pages/create-target";
import SetTarget from "./pages/set-target";
import ViewTarget from "./pages/view-target";
import DailyTarget from "./pages/daily-target";
import AddKwa from "./pages/add-kwa";
import KwaHistory from "./pages/kwa-history";



import UserList from "@/pages/user-list";
import UserGroups from "@/pages/user-groups";
import AttributesPage from "@/pages/drm/attributes";
import PermissionPage from "@/pages/drm/permission";
import DelayProjectPage from "@/pages/drm/delay-project";
import PromotionPage from "@/pages/drm/promotion";
import RelatedCustomerPage from "@/pages/drm/related-customer";
import PmsSettingPage from "@/pages/drm/pms-setting";
import MonthlyCompleteProject from "@/pages/drm/monthly-complete-project";
import OverallReportPage from "@/pages/drm/overall-report";
import TodayPostPage from "@/pages/drm/today-post";
import AddPenaltyPage from "@/pages/drm/add-penalty";
import CommissionVerificationPage from "@/pages/drm/commission-verification";
import AllSocialAccountsPage from "@/pages/drm/all-social-accounts";
import IncrementPage from "@/pages/drm/increment";
import PerformancePage from "@/pages/drm/performance";
import LateComingPage from "@/pages/drm/late-coming";
import BotSystem from "@/pages/bot-system";
import OnlineForm from "@/pages/online-form";
import FbPost from "@/pages/fb-post";
import DelayProjectsNewPage from "./pages/drm/delay-projects-new";
import PostingData from "./pages/posting-data";
import SeoSmmManagerDashboard from "@/pages/seo-smm-manager-dashboard";
import AbReport from "@/pages/ab-report";
import DollarSystem from "@/pages/dollar-system";
import LeadManagerDashboard from "@/pages/lead-manager-dashboard";
import LeadExecutiveDashboard from "@/pages/lead-executive-dashboard";
import SoftwareManagerDashboard from "@/pages/software-manager-dashboard";
import SoftwareExecutiveDashboard from "@/pages/software-executive-dashboard";
import UpcomingProjectPage from "@/pages/drm/upcoming-project";
import MarketingManagerDashboard from "@/pages/marketing-manager-dashboard";

import EventsAdd from "@/pages/events-add";
import EventsMenu from "@/pages/events-menu";
import EventsDutyPlanner from "@/pages/events-duty-planner";
import SocialMedia from "@/pages/social-media";
import VasSystem from "@/pages/vas-system";
import OfficeTrialBalance from "@/pages/office-trial-balance";
import OfficeOldAccountHead from "@/pages/office-old-account-head";
import ReportsRawAttendance from "@/pages/reports-raw-attendance";
import EditAtt from "@/pages/reports-edit-att";
import ReceptionReport from "@/pages/reports-reception";
import EventReport from "@/pages/reports-event";
import DepartmentReport from "@/pages/reports-department";
import AllowedIpList from "@/pages/allowed-ip-list";
import DailyAddedGmReport from "@/pages/daily-added-gm-report";

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

function Router() {
  return (
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
      <Route path="/sales/temp-contact" component={TempContact} />
      <Route path="/sales/tracing" component={TracingPage} />
      <Route path="/sales/tracing/view/:id" component={TracingViewPage} />
      <Route path="/customers/private-pool" component={DynamicPrivatePool} />
      <Route path="/customers/service-pool" component={ServicePool} />
      <Route path="/customers/gmbv-pool" component={LeadPools} />
      <Route path="/customers/public-pool" component={DynamicPublicPool} />
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
      <Route path="/projects" component={DelayProjectPage} />
      <Route path="/pms/task-templates" component={PmsTaskTemplates} />
      <Route path="/pms/status" component={PmsStatus} />
      <Route path="/drm/delay-project" component={DelayProjectPage} />
      <Route path="/drm/delay-projects-new" component={DelayProjectsNewPage} />
      <Route path="/drm/pms-setting" component={PmsSettingPage} />
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
      <Route path="/pms/task-history" component={PmsTaskHistory} />
      <Route path="/pms/project-report" component={PmsProjectReport} />
      <Route path="/dd-manager/project-report" component={PmsProjectReport} />
      <Route path="/pms/team-workspace" component={PmsTeamWorkspace} />
      <Route path="/service/pool" component={ServicePoolDashboard} />
      <Route path="/service/bv-checking" component={ServiceBvChecking} />
      <Route path="/service/public-pool" component={ServicePublicPool} />
      <Route path="/office/trial-balance-report" component={OfficeTrialBalance} />
      <Route path="/office/old-account-head" component={OfficeOldAccountHead} />
      <Route path="/office/chart-of-accounts" component={ChartOfAccounts} />
      <Route path="/office/account-head" component={OfficeAccountHead} />
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
      <Route path="/drm/pms-setting" component={PmsSettings} />
      <Route path="/drm/delay-project" component={DelayProjectPage} />
      <Route path="/drm/bot-system" component={BotSystem} />
      <Route path="/drm/online-form" component={OnlineForm} />
      <Route path="/drm/fb-post" component={FbPost} />
      <Route path="/account/gm-entries" component={AccountGmEntries} />
      <Route path="/support/tickets" component={SupportTickets} />
      <Route path="/support/tickets/:id" component={SupportTicketDetail} />
      <Route path="/support/complaints" component={ComplaintsPage} />
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
      <Route path="/training/:category" component={TrainingCenter} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/policies" component={PoliciesSettings} />
      <Route path="/notice-board" component={NoticeBoard} />
      <Route path="/account/gm-entries" component={AccountGmEntries} />
      <Route path="/account/temp-gm" component={AccountTempGm} />
      <Route path="/account/refund-gm" component={AccountRefundGm} />
      <Route path="/account/donations" component={AccountDonations} />
      <Route path="/account/invoices" component={AccountInvoices} />
      <Route path="/account/ab-report" component={AbReport} />
      <Route path="/account/dollar-system" component={DollarSystem} />
      <Route path="/account/ledger" component={AccountLedger} />
      <Route path="/office/expenses" component={OfficeExpenses} />
      <Route path="/office/chart-of-accounts" component={ChartOfAccounts} />
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
      <Route path="/drm/delay-project" component={DelayProjectPage} />
      <Route path="/drm/promotion" component={PromotionPage} />
      <Route path="/drm/related-customer" component={RelatedCustomerPage} />
      <Route path="/product-posting/manager" component={ProductPostingDashboard} />
      <Route path="/product-posting/executive" component={ProductPostingDashboard} />
      <Route path="/sales/create-invoice/:customerId" component={CreateInvoice} />
      <Route path="/posting-data" component={PostingData} />
      <Route path="/posting-data/add-products" component={PostingData} />
      <Route path="/posting-data/add-keywords" component={PostingData} />
      <Route path="/posting-data/keywords" component={PostingData} />
      <Route path="/posting-data/verified" component={PostingData} />
      <Route path="/posting-data/view-keywords" component={PostingData} />
      <Route path="/posting-data/view-products" component={PostingData} />
      <Route path="/posting-data/link-report" component={PostingDataLinkReport} />
      <Route path="/team-report/link-report" component={PostingDataLinkReport} />
      <Route path="/posting-data/data-verify" component={PostingData} />
      <Route path="/posting-data/restricted-keywords" component={PostingData} />
      <Route path="/portfolio-add" component={AddPortfolio} />
      <Route path="/portfolio-view" component={PortfolioList} />
      <Route path="/it/servers" component={ItServers} />
      <Route path="/it/domains" component={ItDomains} />
      <Route path="/it/backup" component={ItBackup} />
      <Route path="/pms/project-report" component={PmsProjectReport} />
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
      <div className="flex w-full min-w-0 overflow-x-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <TopBar
            userRole={userRole}
            userRoles={userRoles}
            userName={userName}
            isDark={theme === "dark"}
            onThemeToggle={toggleTheme}
            onLogout={handleLogout}
            onNavigate={(path) => setLocation(path)}
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
      <div className="min-h-screen bg-background text-foreground transition-colors overflow-x-hidden">
        <AppContent />
      </div>
    </ThemeProvider>
  );
}
