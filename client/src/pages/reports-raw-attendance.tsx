import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";

type RawAttendanceResponse = {
  records: any[];
  available?: boolean;
  message?: string;
};

const BRANCHES = [
  "Lahore Gulburg Branch",
  "Lahore Raya Branch",
  "Sialkot Branch",
];

export default function ReportsRawAttendance() {
  const [activeBranch, setActiveBranch] = useState("Lahore Gulburg Branch");

  const { data, isLoading, isError } = useQuery<RawAttendanceResponse>({
    queryKey: ["/api/attendance/raw", activeBranch],
    queryFn: async () =>
      apiRequestJson("GET", `/api/attendance/raw?branch=${encodeURIComponent(activeBranch)}`),
  });

  const records = data?.records ?? [];

  return (
    <div className="flex-1 overflow-auto bg-white min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <h1 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          ZKT ATTENDANCE REPORT
        </h1>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="text-sm text-slate-400">
            Current year attendance only. Missing days = leave, Sunday/Public Holiday skip.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BRANCHES.map(branch => (
            <button
              key={branch}
              onClick={() => setActiveBranch(branch)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                activeBranch === branch
                  ? "bg-[#5c7cfa] text-white"
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {branch}
            </button>
          ))}
        </div>

        <div className="pt-2">
          {isLoading ? (
            <div className="text-center text-slate-500 py-12 text-sm">Loading...</div>
          ) : isError ? (
            <div className="text-center text-[#d9534f] py-12 text-sm">
              Could not load raw attendance. Please try again.
            </div>
          ) : records.length === 0 ? (
            <div className="bg-[#f8f9fa] border border-slate-200 rounded-md px-6 py-12 text-center">
              <h2 className="text-sm font-bold text-slate-700 mb-2">No raw attendance logs</h2>
              <p className="text-sm text-slate-500 max-w-2xl mx-auto">
                {data?.message ||
                  "No biometric/raw attendance source is connected for this branch. Once a device or import is integrated, raw logs will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-sm text-center">
                <thead className="bg-[#343a40] text-white">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">#</th>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Date</th>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Check In Time</th>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Check Out Time</th>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Office</th>
                    <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Device IP</th>
                    <th className="py-3 px-4 font-semibold text-xs whitespace-nowrap">UID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record: any, idx: number) => (
                    <tr key={record.id ?? idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{record.date ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{record.in ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{record.out ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-500">{activeBranch}</td>
                      <td className="py-3 px-4 text-slate-500">{record.ip ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-500">{record.uid ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
