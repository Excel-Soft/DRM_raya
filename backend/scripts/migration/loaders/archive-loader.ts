/**
 * Phase 2B: INSERT parsed legacy rows into legacy_archive.* (TEXT columns).
 * Every source row must receive migration_record_state = ARCHIVED_ONLY minimum.
 */

export type ArchiveRow = {
  sourceTable: string;
  legacyPk: string;
  legacyPkColumn: string;
  columns: Record<string, string | null>;
};

export async function loadArchiveBatch(_rows: ArchiveRow[]): Promise<{ archived: number }> {
  throw new Error("Phase 2A: archive loader not executed — implement in Phase 2B");
}
