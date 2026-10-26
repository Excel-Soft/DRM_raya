/**
 * Browser-safety audit for `frontend/shared/` (Phase 1).
 * Do not import flagged modules from Client Components.
 */

export const SHARED_IMPORT_AUDIT = {
  safeForClient: [
    {
      file: "validators.ts",
      notes: "Zod only; safe for forms and client validation.",
    },
    {
      file: "gm-sales-constants.ts",
      notes: "Zod + constants; documented client/server safe.",
    },
    {
      file: "service-bridge-constants.ts",
      notes: "Zod + constants; documented client/server safe.",
    },
    {
      file: "verification-lifecycle.ts",
      notes: "Labels/constants only; no server imports.",
    },
  ],
  unsafeForClient: [
    {
      file: "schema.ts",
      reasons: [
        "Imports drizzle-orm/pg-core and drizzle-zod",
        "Large ORM table definitions — server/database layer",
        "Would bloat client bundle if imported in Client Components",
      ],
      recommendation:
        "Use Zod schemas from validators.ts or module-specific DTO types; import schema.ts only from server code if ever needed.",
    },
  ],
  notApplicable: [
    {
      file: "dollarsystem.php",
      notes: "PHP legacy asset; not a TypeScript import target for Next.",
    },
  ],
} as const;

/** Runtime `@shared` bundling: see `shared-path.typecheck.ts` and README (Turbopack symlink limits). */
export const SHARED_ALIAS_TYPECHECK_FILE = "src/config/shared-path.typecheck.ts";
