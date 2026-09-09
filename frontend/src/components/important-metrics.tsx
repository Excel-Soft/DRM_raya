import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { InServiceModal } from "./in-service-modal";
import { Play } from "lucide-react";

type ImportantMetricKey =
  | "a_followup"
  | "followup_1"
  | "followup_30_days"
  | "b_followup"
  | "b_plus_followup"
  | "dropout_leads"
  | "dropout_7_days"
  | "not_follow_yet"
  | "vas_document"
  | "todo_list"
  | "complaints"
  | "bv_document"
  | "due_payment"
  | "in_service";

type ImportantMetrics = Record<ImportantMetricKey, number>;

const metricRoutes: Record<ImportantMetricKey, string> = {
  a_followup: "/service/a-customer",
  b_plus_followup: "/service/b-plus-customer",
  followup_1: "/service/b-customer",
  followup_30_days: "/service/monthly-followup",
  b_followup: "/service/b-minus-customer",
  dropout_leads: "/service/dropout-customer",
  dropout_7_days: "/service/weekly-dropout",
  not_follow_yet: "/service/not-follow-customer",
  vas_document: "/service/vas-document-list",
  todo_list: "/service/todo-list",
  complaints: "/service/complaint-list",
  bv_document: "/service/bv-document-list",
  due_payment: "/service/due-vas-payment",
  in_service: "#" // Special case handled with a modal
};

const orderedMetrics: { key: ImportantMetricKey; label: string }[] = [
  { key: "in_service", label: "In Service" },
  { key: "a_followup", label: "A- Followup" },
  { key: "b_plus_followup", label: "B+ Followup" },
  { key: "followup_1", label: "B Followup" },
  { key: "b_followup", label: "B- Followup" },
  { key: "followup_30_days", label: "30-Days Followup" },
  { key: "dropout_7_days", label: "7-Day Dropout" },
  { key: "dropout_leads", label: "Dropout Leads" },
  { key: "complaints", label: "Complaints" },
  { key: "not_follow_yet", label: "Not Follow Yet" },
  { key: "bv_document", label: "BV Document" },
  { key: "vas_document", label: "VAS Document" },
  { key: "due_payment", label: "Due Payment" },
  { key: "todo_list", label: "To Do List" },
];

export function ImportantMetrics({ inServiceApiEndpoint }: { inServiceApiEndpoint?: string } = {}) {
  const [isInServiceModalOpen, setIsInServiceModalOpen] = useState(false);
  const { data: metrics, isLoading } = useQuery<ImportantMetrics>({
    queryKey: ["/api/sales/important-metrics"],
  });

  return (
    <div className="bg-white rounded-[4px] border border-slate-100 shadow-sm p-4 dark:bg-zinc-900 dark:border-zinc-800" data-testid="card-important-metrics">
      <h2 className="text-[15px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Important</h2>
      {isLoading ? (
        <div className="py-4 text-center text-[13px] text-slate-500 dark:text-zinc-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {orderedMetrics.map((metric) => (
            <div key={metric.key}>
              {metric.key === "in_service" ? (
                <button
                  onClick={() => setIsInServiceModalOpen(true)}
                  className="w-full flex justify-between items-center bg-[#f1f5f9] hover:bg-[#e2e8f0] px-3 py-1.5 rounded-[2px] transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-800"
                  data-testid={`metric-${metric.key}`}
                >
                  <span className="text-slate-600 font-medium text-[13px] dark:text-zinc-300">{metric.label}</span>
                  <span className="text-slate-800 text-[13px] italic dark:text-zinc-100">
                    {metrics?.[metric.key] || 0}
                  </span>
                </button>
              ) : (
                <Link
                  href={metricRoutes[metric.key]}
                  className="flex justify-between items-center bg-[#f1f5f9] hover:bg-[#e2e8f0] px-3 py-1.5 rounded-[2px] transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-800"
                  data-testid={`metric-${metric.key}`}
                >
                  <span className="text-slate-600 font-medium text-[13px] dark:text-zinc-300">{metric.label}</span>
                  {metric.key === "todo_list" ? (
                    <span className="text-slate-500 flex items-center pr-1 dark:text-zinc-400">
                      <Play className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-slate-800 text-[13px] italic dark:text-zinc-100">
                      {metrics?.[metric.key] || 0}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <InServiceModal
        isOpen={isInServiceModalOpen}
        onClose={() => setIsInServiceModalOpen(false)}
        apiEndpoint={inServiceApiEndpoint}
      />
    </div>
  );
}
