import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportColumn<T = any> = {
  key: keyof T | string;
  header: string;
  format?: (value: any, row: T) => string | number | null | undefined;
};

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

function sanitizeName(reportName: string): string {
  return (reportName || "report")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "report";
}

export function buildFileName(reportName: string, ext: string): string {
  return `${sanitizeName(reportName)}_${timestamp()}.${ext}`;
}

function cellValue<T>(row: T, col: ExportColumn<T>): string {
  const raw = (row as any)?.[col.key as any];
  const value = col.format ? col.format(raw, row) : raw;
  if (value === null || value === undefined) return "";
  return String(value);
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCSV<T = any>(
  rows: T[],
  columns: ExportColumn<T>[],
  reportName: string,
): void {
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(cellValue(row, c))).join(","))
    .join("\r\n");
  const csv = body ? `${header}\r\n${body}` : header;

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildFileName(reportName, "csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel<T = any>(
  rows: T[],
  columns: ExportColumn<T>[],
  reportName: string,
): void {
  const aoa: (string | number | null)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => cellValue(row, c))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, buildFileName(reportName, "xlsx"));
}

export function exportToPDF<T = any>(
  rows: T[],
  columns: ExportColumn<T>[],
  reportName: string,
  options?: { title?: string },
): void {
  const doc = new jsPDF();
  const title = options?.title ?? reportName;
  const marginX = 14;

  doc.setFontSize(14);
  doc.text(title, marginX, 16);

  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body:
      rows.length > 0
        ? rows.map((row) => columns.map((c) => cellValue(row, c)))
        : [columns.map(() => "").map((_, i) => (i === 0 ? "No records found." : ""))],
    styles: { fontSize: 8, cellWidth: "wrap" },
    headStyles: { fillColor: [0, 166, 90] },
  });

  doc.save(buildFileName(reportName, "pdf"));
}
