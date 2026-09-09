import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Component = {
  weight: number;
  score: number | null;
  weightedScore: number | null;
  status: "available" | "N/A";
  details: string;
  [k: string]: any;
};

type Summary = {
  employee: { id: string; name: string | null; email: string | null; role: string | null; department: string | null };
  dateRange: { startDate: string; endDate: string };
  components: { workCompletion: Component; quality: Component; targetAchievement: Component; timeliness: Component };
  finalScore: number | null;
  normalizedFinalScore: number | null;
  formulaCompletenessPercent: number;
  rating: string;
  dataQuality: "complete" | "partial" | "none";
  missingMetrics: string[];
  managementSuggestions: string[];
  totalRecords: number;
  records?: any[];
};

const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "N/A" : `${n}`);

const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 16).replace("T", " ");
};

const fmtDay = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};

function componentRows(summary: Summary): string[][] {
  const c = summary.components;
  const sourceFor = (comp: Component, available: string) =>
    comp.status === "available" ? available : comp.details;
  return [
    [
      "Work Completion",
      `${c.workCompletion.weight}%`,
      fmtScore(c.workCompletion.score),
      fmtScore(c.workCompletion.weightedScore),
      sourceFor(c.workCompletion, `${c.workCompletion.assigned ?? 0} assigned / ${c.workCompletion.completed ?? 0} completed`),
      c.workCompletion.status === "available" ? "Available" : "N/A",
    ],
    [
      "Quality",
      `${c.quality.weight}%`,
      fmtScore(c.quality.score),
      fmtScore(c.quality.weightedScore),
      sourceFor(c.quality, `${c.quality.approved ?? 0}/${c.quality.reviewed ?? 0} approved`),
      c.quality.status === "available" ? "Available" : "N/A",
    ],
    [
      "Target Achievement",
      `${c.targetAchievement.weight}%`,
      fmtScore(c.targetAchievement.score),
      fmtScore(c.targetAchievement.weightedScore),
      sourceFor(c.targetAchievement, `${c.targetAchievement.achievedTarget ?? 0}/${c.targetAchievement.assignedTarget ?? 0}`),
      c.targetAchievement.status === "available" ? "Available" : "N/A",
    ],
    [
      "Timeliness",
      `${c.timeliness.weight}%`,
      fmtScore(c.timeliness.score),
      fmtScore(c.timeliness.weightedScore),
      sourceFor(c.timeliness, `${c.timeliness.onTime ?? 0} on-time / ${c.timeliness.late ?? 0} late`),
      c.timeliness.status === "available" ? "Available" : "N/A",
    ],
  ];
}

function recordRows(summary: Summary): string[][] {
  const records = summary.records ?? [];
  return records.map((r: any) => [
    fmtDateTime(r.completedAt || r.assignedAt),
    r.sourceModule ?? "-",
    r.activityType ?? "-",
    r.clientCompany || "-",
    r.title || "-",
    r.taskValue ?? "-",
    r.status || "-",
    r.isOnTime === null || r.isOnTime === undefined ? "-" : r.isOnTime ? "Yes" : "No",
    r.isApproved ? "Approved" : r.isRejected ? "Rejected" : r.isReturned ? "Returned" : "-",
    r.revisionCount ?? 0,
    r.remarks || "-",
  ]);
}

const RECORD_HEADERS = [
  "Date", "Source", "Activity", "Client/Company", "Task/Project",
  "Value", "Status", "On Time", "Quality", "Revisions", "Remarks",
];

function baseFileName(summary: Summary): string {
  const name = (summary.employee.name || "employee").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const start = fmtDay(summary.dateRange.startDate);
  const end = fmtDay(summary.dateRange.endDate);
  return `performance_${name}_${start}_to_${end}`;
}

export function exportPerformancePDF(summary: Summary): void {
  const doc = new jsPDF();
  const effectiveScore = summary.normalizedFinalScore ?? summary.finalScore;
  const marginX = 14;
  let y = 16;

  doc.setFontSize(16);
  doc.text("Performance Report", marginX, y);
  y += 8;

  doc.setFontSize(10);
  const headerLines = [
    `Employee: ${summary.employee.name || "-"}`,
    `Role: ${summary.employee.role || "-"}    Department: ${summary.employee.department || "-"}`,
    `Date Range: ${fmtDay(summary.dateRange.startDate)} to ${fmtDay(summary.dateRange.endDate)}`,
    `Final Score: ${fmtScore(effectiveScore)}    Rating: ${summary.rating}`,
    `Formula / Data: ${summary.formulaCompletenessPercent}% complete (${summary.dataQuality} data)    Records: ${summary.totalRecords}`,
  ];
  for (const line of headerLines) {
    doc.text(line, marginX, y);
    y += 5.5;
  }
  y += 2;

  doc.setFontSize(12);
  doc.text("Component Breakdown", marginX, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [["Component", "Weight", "Score", "Weighted", "Source Data", "Status"]],
    body: componentRows(summary),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 166, 90] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (summary.missingMetrics.length > 0) {
    doc.setFontSize(9);
    const missing = doc.splitTextToSize(
      `Missing components (excluded from normalized score): ${summary.missingMetrics.join(", ")}`,
      180,
    );
    doc.text(missing, marginX, y);
    y += missing.length * 5 + 2;
  }

  doc.setFontSize(12);
  doc.text("Performance Records", marginX, y);
  autoTable(doc, {
    startY: y + 2,
    head: [RECORD_HEADERS],
    body: recordRows(summary).length > 0 ? recordRows(summary) : [["No performance records found for this range.", "", "", "", "", "", "", "", "", "", ""]],
    styles: { fontSize: 7, cellWidth: "wrap" },
    headStyles: { fillColor: [0, 166, 90] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(12);
  doc.text("Management Suggestions", marginX, y);
  y += 6;
  doc.setFontSize(9);
  const suggestions = summary.managementSuggestions.length > 0 ? summary.managementSuggestions : ["No suggestions."];
  for (const s of suggestions) {
    const lines = doc.splitTextToSize(`• ${s}`, 180);
    if (y > 280) { doc.addPage(); y = 16; }
    doc.text(lines, marginX, y);
    y += lines.length * 5;
  }

  doc.save(`${baseFileName(summary)}.pdf`);
}

export function exportPerformanceExcel(summary: Summary): void {
  const effectiveScore = summary.normalizedFinalScore ?? summary.finalScore;
  const wb = XLSX.utils.book_new();

  const summaryAoa: (string | number | null)[][] = [
    ["Performance Report"],
    [],
    ["Employee", summary.employee.name || "-"],
    ["Role", summary.employee.role || "-"],
    ["Department", summary.employee.department || "-"],
    ["Email", summary.employee.email || "-"],
    ["Start Date", fmtDay(summary.dateRange.startDate)],
    ["End Date", fmtDay(summary.dateRange.endDate)],
    [],
    ["Final Score", fmtScore(effectiveScore)],
    ["Rating", summary.rating],
    ["Formula Completeness", `${summary.formulaCompletenessPercent}%`],
    ["Data Quality", summary.dataQuality],
    ["Total Records", summary.totalRecords],
    ["Missing Metrics", summary.missingMetrics.join(", ") || "None"],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  const componentsAoa = [
    ["Component", "Weight", "Score", "Weighted", "Source Data", "Status"],
    ...componentRows(summary),
  ];
  const componentsWs = XLSX.utils.aoa_to_sheet(componentsAoa);
  XLSX.utils.book_append_sheet(wb, componentsWs, "Components");

  const recordsAoa = [RECORD_HEADERS, ...recordRows(summary)];
  const recordsWs = XLSX.utils.aoa_to_sheet(recordsAoa);
  XLSX.utils.book_append_sheet(wb, recordsWs, "Records");

  const suggestionsAoa = [
    ["Management Suggestions"],
    ...(summary.managementSuggestions.length > 0
      ? summary.managementSuggestions.map((s) => [s])
      : [["No suggestions."]]),
  ];
  const suggestionsWs = XLSX.utils.aoa_to_sheet(suggestionsAoa);
  XLSX.utils.book_append_sheet(wb, suggestionsWs, "Suggestions");

  XLSX.writeFile(wb, `${baseFileName(summary)}.xlsx`);
}
