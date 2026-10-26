"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

/** Mirrors legacy `reports-in-service.tsx` mock dashboard (no live API in Vite either). */
export function ReportsInServiceView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeQuarter, setActiveQuarter] = useState("q1");

  const pieData = [
    { name: "Target", value: 45 },
    { name: "Achieved", value: 15 },
    { name: "Remaining", value: 40 },
  ];

  const quarters = [
    { id: "q1", name: "Q1 Apr-Jun", count: 288 },
    { id: "q2", name: "Q2 Jul-Sep", count: 266 },
    { id: "q3", name: "Q3 Oct-Dec", count: 287 },
    { id: "q4", name: "Q4 Jan-Mar", count: 460 },
  ];

  const activeQuarterData = quarters.find((q) => q.id === activeQuarter);

  return (
    <Card>
      <PageHeader
        eyebrow="Customer"
        title="In service Report"
        description="Legacy comparison dashboard (static demo data — same as Vite page)."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {quarters.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setActiveQuarter(q.id)}
            className={
              activeQuarter === q.id
                ? "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
            }
          >
            {q.name} <Badge variant="neutral">{q.count}</Badge>
          </button>
        ))}
      </div>

      {activeQuarterData ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Selected: {activeQuarterData.name} — {activeQuarterData.count} records (demo).
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pieData.map((slice) => (
          <div
            key={slice.name}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-xs font-semibold uppercase text-zinc-500">{slice.name}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{slice.value}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
