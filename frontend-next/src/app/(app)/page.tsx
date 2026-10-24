import { redirect } from "next/navigation";
import { DASHBOARD_HOME } from "@/lib/navigation/dashboard-routes";

/** Authenticated root → dashboard home. */
export default function AppRootRedirect() {
  redirect(DASHBOARD_HOME);
}
