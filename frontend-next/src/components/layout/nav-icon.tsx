import type { IconType } from "react-icons";
import {
  HiOutlineBanknotes,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineChartPie,
  HiOutlineCircleStack,
  HiOutlineClipboardDocumentList,
  HiOutlineCog6Tooth,
  HiOutlineComputerDesktop,
  HiOutlineGlobeAlt,
  HiOutlineInbox,
  HiOutlineLifebuoy,
  HiOutlinePhoto,
  HiOutlineServerStack,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTag,
  HiOutlineUserGroup,
  HiOutlineUsers,
} from "react-icons/hi2";
import type { NavIconKey } from "@/lib/navigation/navigation-config";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<NavIconKey, IconType> = {
  dashboard: HiOutlineSquares2X2,
  customer: HiOutlineUserGroup,
  attendance: HiOutlineCalendarDays,
  lead: HiOutlineCircleStack,
  pms: HiOutlineClipboardDocumentList,
  reports: HiOutlineClipboardDocumentList,
  training: HiOutlineComputerDesktop,
  notice: HiOutlineInbox,
  portfolio: HiOutlinePhoto,
  settings: HiOutlineCog6Tooth,
  users: HiOutlineUsers,
  support: HiOutlineLifebuoy,
  account: HiOutlineBanknotes,
  office: HiOutlineBuildingOffice2,
  chart: HiOutlineChartPie,
  hosting: HiOutlineServerStack,
  branch: HiOutlineBuildingOffice2,
  database: HiOutlineCircleStack,
  target: HiOutlineTag,
  events: HiOutlineCalendarDays,
  social: HiOutlineGlobeAlt,
  daily: HiOutlineClipboardDocumentList,
  shield: HiOutlineShieldCheck,
  platform: HiOutlineSquares2X2,
};

export function NavIcon({ name, className }: { name: NavIconKey; className?: string }) {
  const Icon = ICONS[name] ?? HiOutlineSquares2X2;
  return <Icon className={cn("h-4 w-4 shrink-0 opacity-85", className)} aria-hidden />;
}
