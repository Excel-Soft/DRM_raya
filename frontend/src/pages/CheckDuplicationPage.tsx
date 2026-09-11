import React, { useEffect, useRef, useState } from "react";

type Row = {
  id: string;
  drmId?: string;
  company: string;
  country?: string;
  holder: string;
  salePerson: string;
  email: string;
  mobile: string;
  lastFollow: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getAuthHeaders(): HeadersInit {
  try {
    const token = sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function parseEmailOrPhone(value: string): { email?: string; phone?: string } {
  const v = value.trim();
  if (!v) return {};
  if (v.includes("@")) return { email: v };
  return { phone: v };
}

export default function CheckDuplicationPage() {
  const [companyQuery, setCompanyQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [apiRows, setApiRows] = useState<Row[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimer = useRef<number | null>(null);
  const normalizedCompany = companyQuery.trim();
  const normalizedEmail = emailQuery.trim();

  const hasSearch = normalizedCompany.length > 0 || normalizedEmail.length > 0;
  const visibleRows = apiRows ?? [];

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedRowIds.has(r.id));
  const someVisibleSelected =
    visibleRows.length > 0 && visibleRows.some((r) => selectedRowIds.has(r.id));

  useEffect(() => {
    const currentVisibleRows = apiRows ?? [];
    const visibleIds = new Set(currentVisibleRows.map((r) => r.id));
    setSelectedRowIds((prev) => {
      const next = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [apiRows]);

  useEffect(() => {
    if (!hasSearch) {
      setApiRows(null);
      setApiError(null);
      return;
    }

    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);

    debounceTimer.current = window.setTimeout(async () => {
      const headers = getAuthHeaders();
      const hasToken = !!(headers as Record<string, string>).Authorization;
      if (!hasToken) {
        setApiRows(null);
        setApiError("No token found. Please login first.");
        return;
      }

      const params = new URLSearchParams();
      if (companyQuery.trim()) params.set("company", companyQuery.trim());
      const { email, phone } = parseEmailOrPhone(emailQuery);
      if (email) params.set("email", email);
      if (phone) params.set("phone", phone);

      if (!params.toString()) return;

      setIsLoading(true);
      setApiError(null);
      try {
        const res = await fetch(`/api/check-duplicate?${params.toString()}`, {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          setApiRows(null);
          if (res.status === 401) {
            setApiError("Unauthorized. Please login again.");
          } else {
            setApiError("Failed to load results.");
          }
          return;
        }

        const body = (await res.json()) as {
          duplicates?: Array<{
            id: string;
            drmId: string | null;
            companyName: string;
            country: string | null;
            accountName: string;
            salesPersonName: string | null;
            email: string;
            phone: string;
            lastFollowDate: string | null;
          }>;
        };

        const rows: Row[] = (body.duplicates ?? []).map((d) => ({
          id: d.id,
          drmId: d.drmId ?? undefined,
          company: d.companyName,
          country: d.country ?? "",
          holder: d.accountName,
          salePerson: d.salesPersonName ?? "-",
          email: d.email,
          mobile: d.phone,
          lastFollow: d.lastFollowDate ? d.lastFollowDate.slice(0, 10) : "-",
        }));
        setApiRows(rows);
      } catch {
        setApiRows(null);
        setApiError("Failed to load results.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [companyQuery, emailQuery, hasSearch]);

  const onToggleAllVisible = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of visibleRows) next.delete(r.id);
      } else {
        for (const r of visibleRows) next.add(r.id);
      }
      return next;
    });
  };

  const onToggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onClear = () => {
    setCompanyQuery("");
    setEmailQuery("");
    setApiRows(null);
    setApiError(null);
    setSelectedRowIds(new Set());
  };

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-[15px] font-bold tracking-tight px-2 text-slate-800 uppercase dark:text-zinc-100">
        CHECK DUPLICATION
      </div>

      <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300" htmlFor="companyName">
              Company Name
            </label>
            <input
              id="companyName"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              placeholder="Enter company name Or id"
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#059669] transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Enter e-mail/mobile no"
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#059669] transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-3 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f1f5f9] border-b border-white dark:bg-zinc-800">
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 rounded-tl w-12 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={onToggleAllVisible}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#059669] focus:ring-[#059669] dark:border-zinc-800 dark:text-zinc-400"
                  />
                </th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">ID</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Company</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Holder</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Sale Person</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Email</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Last Follow</th>
                <th className="py-4 px-4 text-[13px] font-bold text-slate-600 rounded-tr w-20 text-center dark:text-zinc-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {hasSearch && visibleRows.length > 0 ? (
                visibleRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors dark:border-zinc-800">
                    <td className="py-4 px-4 w-12 text-[13px]">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${r.id}`}
                        checked={selectedRowIds.has(r.id)}
                        onChange={() => onToggleRow(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#059669] focus:ring-[#059669] dark:border-zinc-800 dark:text-zinc-400"
                      />
                    </td>
                    <td className="py-4 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">
                      {r.drmId || "—"}
                    </td>
                    <td className="py-4 px-4 text-[13px] font-semibold text-slate-500 uppercase dark:text-zinc-400">{r.company}</td>
                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{r.holder}</td>
                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{r.salePerson}</td>
                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{r.email}</td>
                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 text-center dark:text-zinc-400">{r.lastFollow}</td>
                    <td className="py-4 px-4 w-20 text-center">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:hover:text-slate-200 transition-colors dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800"
                      >
                        ...
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[13px] text-slate-400 font-medium tracking-wide">
                    {isLoading ? "Searching..." : hasSearch ? "No matching records found." : "Search to check for duplications."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
