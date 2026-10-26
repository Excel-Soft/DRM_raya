"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/browser-client";

type CompanyOption = {
  id: string;
  companyName: string;
  accountName?: string | null;
  drmId?: string | null;
};

export function GmCompanySearch({
  companyId,
  companyLabel,
  onSelect,
  error,
}: {
  companyId: string;
  companyLabel: string;
  onSelect: (id: string, label: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const json = await apiFetch<{ customers?: CompanyOption[] }>(
          `/api/customers/search?q=${encodeURIComponent(debounced)}&poolOnly=true`,
        );
        if (!cancelled) setOptions(json.customers ?? []);
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="relative space-y-1">
      <Input
        placeholder={companyLabel || "Search company by name or DRM ID"}
        value={open ? query : companyLabel || query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onSelect("", "");
        }}
        onFocus={() => setOpen(true)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {open && options.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  const label = c.drmId ? `${c.companyName} (${c.drmId})` : c.companyName;
                  onSelect(c.id, label);
                  setQuery(label);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.companyName}</span>
                {c.drmId ? <span className="ml-2 font-mono text-xs text-emerald-700">{c.drmId}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {companyId ? <p className="text-[11px] text-zinc-500">Selected ID: {companyId.slice(0, 8)}…</p> : null}
    </div>
  );
}
