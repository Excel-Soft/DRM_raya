/** Strip HTML for PDF/print (legacy detail fields may contain `<br/>`). */
export function plainTextForPdf(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}
