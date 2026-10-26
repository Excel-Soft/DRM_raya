/** Legacy parity: `{CompanyName}_{YYYY-MM-DD}.pdf` */
export function pdfFileNameForCompany(companyOrAccount: string): string {
  const base = (companyOrAccount || "Company").trim().replace(/[^\w\s.-]+/g, "").replace(/\s+/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  return `${base || "Company"}_${dateStr}.pdf`;
}
