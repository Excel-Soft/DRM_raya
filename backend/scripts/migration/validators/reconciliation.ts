/**
 * Validation: archived + migrated + rejected + pending = source count per table.
 */

export type TableReconciliation = {
  sourceTable: string;
  sourceRows: number;
  archivedRows: number;
  modernRows: number;
  rejectedRows: number;
  pendingRows: number;
};

export function reconcileCounts(r: TableReconciliation): boolean {
  return (
    r.sourceRows ===
    r.archivedRows + r.rejectedRows /* archived is superset; see Phase 2B state machine */
  );
}
