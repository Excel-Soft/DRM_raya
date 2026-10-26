/**
 * Migration tracker — populated by Phase 0A route matrix audit.
 * Regenerate: `node frontend-next/scripts/build-route-matrix.mjs`
 */
import migrationData from "./migration-routes.json";

export type MigrationRouteStatus =
  | "legacy"
  | "in-progress"
  | "ready-for-review"
  | "verified-on-staging"
  | "next"
  | "exception";

export type MigrationRouteRecord = {
  path: string;
  module: string;
  legacySource?: string;
  nextPath?: string;
  aliasRedirectTo?: string | null;
  migrationStatus: MigrationRouteStatus;
  proposedOwner?: string;
  ownerConfirmed?: boolean;
  discrepancies?: string[];
  testStatus?: string;
  notes?: string;
};

export const migrationRoutesGeneratedAt: string = migrationData.generatedAt;

export const migrationRoutes: MigrationRouteRecord[] =
  migrationData.routes as MigrationRouteRecord[];

export const migrationRouteCount = migrationRoutes.length;
