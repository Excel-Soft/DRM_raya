import { ATTENDANCE_LEAVE, ATTENDANCE_LOAN, ATTENDANCE_OVERTIME } from "./attendance-routes";
import {
  CUSTOMER_DUPLICATE_CHECKER,
  CUSTOMER_PRIVATE_POOL,
  CUSTOMER_SERVICE_POOL,
} from "./customer-routes";
import {
  QUICK_DD_MANAGER,
  QUICK_REPORTS_GRADE,
  QUICK_SALE_COMMISSION,
  QUICK_SALES_PERFORMANCE,
} from "./quick-link-routes";
import { USER_REPORT_BV } from "./user-reports-routes";

export type DashboardQuickLink =
  | { label: string; kind: "link"; href: string }
  | { label: string; kind: "appointment-modal" };

/** Home dashboard quick links — canonical Next paths. */
export const DASHBOARD_QUICK_LINKS: DashboardQuickLink[] = [
  { label: "Duplication Check", kind: "link", href: CUSTOMER_DUPLICATE_CHECKER },
  { label: "Services Pool", kind: "link", href: CUSTOMER_SERVICE_POOL },
  { label: "Leave Application", kind: "link", href: ATTENDANCE_LEAVE },
  { label: "BV Checking", kind: "link", href: USER_REPORT_BV },
  { label: "Commission Verification", kind: "link", href: QUICK_SALE_COMMISSION },
  { label: "Private Pool", kind: "link", href: CUSTOMER_PRIVATE_POOL },
  { label: "Performance", kind: "link", href: QUICK_SALES_PERFORMANCE },
  { label: "Loan Application", kind: "link", href: ATTENDANCE_LOAN },
  { label: "Over Time", kind: "link", href: ATTENDANCE_OVERTIME },
  { label: "Grade List", kind: "link", href: QUICK_REPORTS_GRADE },
  { label: "Appointment Request", kind: "appointment-modal" },
  { label: "D&D Manager", kind: "link", href: QUICK_DD_MANAGER },
];

export function quickLinkMigrationPath(href: string): string {
  return href.split("?")[0] ?? href;
}
