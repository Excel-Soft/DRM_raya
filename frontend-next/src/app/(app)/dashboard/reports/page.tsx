import { redirect } from "next/navigation";
import { USER_REPORT_LOAN } from "@/lib/navigation/user-reports-routes";

export default function UserReportsIndexPage() {
  redirect(USER_REPORT_LOAN);
}
