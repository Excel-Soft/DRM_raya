/** Server-side pagination helpers (Express returns page + total). */

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

export function totalPagesFromCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginationSummary(page: number, pageSize: number, total: number): string {
  if (total === 0) return "No results";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} of ${total}`;
}
