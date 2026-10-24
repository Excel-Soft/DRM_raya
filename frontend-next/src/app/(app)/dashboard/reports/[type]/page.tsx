import { redirect } from "next/navigation";
import { UserReportsView } from "@/modules/user-reports/user-reports-view";
import { USER_REPORT_LOAN } from "@/lib/navigation/user-reports-routes";

export const instant = false;

const VALID = new Set(["loan", "vas", "gm", "bv"]);

type PageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ scope?: string }>;
};

export default async function UserReportTypePage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const { scope } = await searchParams;
  if (!VALID.has(type)) {
    redirect(USER_REPORT_LOAN);
  }
  return (
    <UserReportsView
      reportType={type as "loan" | "vas" | "gm" | "bv"}
      scope={scope ?? null}
    />
  );
}
