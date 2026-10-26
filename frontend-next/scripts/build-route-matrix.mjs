#!/usr/bin/env node
/**
 * Phase 0A — reconciled route matrix generator (read-only audit).
 * Run from repo root: node frontend-next/scripts/build-route-matrix.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(__dirname, "../docs/route-matrix");

const PATHS = {
  registry: path.join(REPO, "frontend/src/routes/route-registry.ts"),
  app: path.join(REPO, "frontend/src/App.tsx"),
  sidebar: path.join(REPO, "frontend/src/components/app-sidebar.tsx"),
  routeAccess: path.join(REPO, "frontend/src/lib/route-access.ts"),
  routeProtection: path.join(REPO, "frontend/src/hooks/useRouteProtection.ts"),
  backendRoutes: path.join(REPO, "backend/src/server/routes.ts"),
};

/** Proposed owners — pending Talha confirmation per migration plan v2. */
const PROPOSED_OWNER_BY_MODULE = {
  Dashboard: "habib-proposed",
  Reports: "habib-proposed",
  Accounts: "habib-proposed",
  "Office Accounts": "habib-proposed",
  "DRM/DD": "habib-proposed",
  "Target System": "habib-proposed",
  Settings: "habib-proposed",
  Users: "habib-proposed",
  Customer: "talha-proposed-pending-confirmation",
  Lead: "talha-proposed-pending-confirmation",
  Service: "talha-proposed-pending-confirmation",
  PMS: "talha-proposed-pending-confirmation",
  "Product Posting": "talha-proposed-pending-confirmation",
};

function read(name) {
  return fs.readFileSync(PATHS[name], "utf8");
}

function parseRegistry(content) {
  const entries = [];
  const blocks = content.split(/\n\s*\{ path:/).slice(1);
  for (const block of blocks) {
    const chunk = `{ path:${block}`;
    const pathM = chunk.match(/path:\s*"([^"]+)"/);
    if (!pathM) continue;
    const routePath = pathM[1];
    const get = (re) => {
      const m = chunk.match(re);
      return m ? m[1] : undefined;
    };
    entries.push({
      path: routePath,
      component: get(/component:\s*"([^"]+)"/),
      module: get(/module:\s*"([^"]+)"/) ?? "Unknown",
      title: get(/title:\s*"([^"]+)"/),
      sidebarVisible: /sidebarVisible:\s*true/.test(chunk),
      sidebarGroup: get(/sidebarGroup:\s*"([^"]+)"/),
      permissionKey: get(/permissionKey:\s*"([^"]+)"/),
      redirectTo: get(/redirectTo:\s*"([^"]+)"/),
      allowedRolesRaw: (() => {
        if (/allowedRoles:\s*ALL_STAFF/.test(chunk)) return "inherit";
        if (/allowedRoles:\s*"\*"/.test(chunk)) return "*";
        if (/allowedRoles:\s*POSTING/.test(chunk)) return "POSTING";
        if (/allowedRoles:\s*ADMIN_ONLY/.test(chunk)) return "ADMIN_ONLY";
        const arr = chunk.match(/allowedRoles:\s*\[([^\]]+)\]/);
        if (arr) {
          return arr[1]
            .split(",")
            .map((s) => s.trim().replace(/^"|"$/g, ""))
            .filter(Boolean);
        }
        return "unknown";
      })(),
      isDynamic: /isDynamic:\s*true/.test(chunk),
      notes: get(/notes:\s*"([^"]*)"/),
    });
  }
  return entries;
}

function parseAppRoutes(content) {
  const routes = [];
  const redirectRe =
    /<Route path="([^"]+)"(?:\s*\{[^}]*\})?\s*>\s*\{\(\)\s*=>\s*<Redirect to="([^"]+)" \/>/g;
  let m;
  while ((m = redirectRe.exec(content)) !== null) {
    routes.push({
      path: m[1],
      kind: "redirect",
      redirectTo: m[2],
      component: "Redirect",
    });
  }
  const compRe = /<Route path="([^"]+)" component=\{([^}]+)\}/g;
  while ((m = compRe.exec(content)) !== null) {
    routes.push({
      path: m[1],
      kind: "component",
      component: m[2].trim(),
      redirectTo: undefined,
    });
  }
  const fallback = content.match(/<Route component=\{([^}]+)\}/);
  return { routes, notFoundComponent: fallback?.[1] };
}

function parseSidebarUrls(content) {
  const items = [];
  const re = /title:\s*"([^"]+)"[^}]*url:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[2];
    const u = new URL(raw, "http://local");
    items.push({
      title: m[1],
      urlRaw: raw,
      pathname: u.pathname,
      search: u.search || "",
    });
  }
  const topRe = /\{\s*title:\s*"([^"]+)"[^}]*url:\s*"([^"]+)"/g;
  return items;
}

function parseRouteProtection(content) {
  const perms = {};
  const permBlock = content.match(
    /const ROUTE_PERMISSIONS:[^=]*=\s*\{([\s\S]*?)\n\};/,
  );
  if (permBlock) {
    const lineRe = /"([^"]+)":\s*\[([^\]]+)\]/g;
    let m;
    while ((m = lineRe.exec(permBlock[1])) !== null) {
      perms[m[1]] = m[2]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
  }
  const dashboards = {};
  const dashBlock = content.match(
    /const ROLE_DASHBOARDS:[^=]*=\s*\{([\s\S]*?)\n\};/,
  );
  if (dashBlock) {
    const lineRe = /(\w+):\s*"([^"]+)"/g;
    let m;
    while ((m = lineRe.exec(dashBlock[1])) !== null) {
      dashboards[m[1]] = m[2];
    }
  }
  return { prefixPermissions: perms, roleDashboards: dashboards };
}

function parseBackendApiMounts(content) {
  const mounts = [];
  const re = /app\.use\(\s*"(\/api[^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) mounts.push(m[1]);
  return [...new Set(mounts)].sort();
}

function normalizePathForMatch(p) {
  return p.replace(/\/$/, "") || "/";
}

function sidebarPathMatchesRoute(sidebarPath, routePath) {
  if (sidebarPath === routePath) return true;
  if (routePath.includes(":")) {
    const re = new RegExp(
      "^" +
        routePath
          .split("/")
          .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
          .join("/") +
        "$",
    );
    return re.test(sidebarPath);
  }
  return false;
}

function clientGuardPrefix(routePath) {
  const p = normalizePathForMatch(routePath);
  const prefixes = Object.keys(
    parseRouteProtection(read("routeAccess")).prefixPermissions,
  );
  const matches = prefixes.filter((pref) => p === pref || p.startsWith(pref + "/"));
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

function inferApiPrefix(routePath) {
  const seg = routePath.split("/").filter(Boolean)[0];
  const map = {
    sales: "/api/sales",
    customers: "/api/customers",
    customer: "/api/customers",
    reports: "/api/reports",
    pms: "/api/pms",
    service: "/api/service",
    account: "/api/account",
    office: "/api/office",
    drm: "/api/drm",
    hr: "/api/hr",
    events: "/api/events",
    "posting-data": "/api/posting-data",
    "target-system": "/api/target-system",
    it: "/api/it",
    support: "/api/support",
    analytics: "/api/analytics",
    training: "/api/training",
    auth: "/api/auth",
  };
  return map[seg] ?? (seg ? `/api/${seg} (heuristic — verify)` : "/api (JWT global)");
}

function toNextAppPath(routePath) {
  if (routePath === "/") return "src/app/(app)/page.tsx";
  const clean = routePath.replace(/^\//, "");
  const nextSeg = clean
    .split("/")
    .map((s) => (s.startsWith(":") ? `[${s.slice(1)}]` : s))
    .join("/");
  return `src/app/(app)/${nextSeg}/page.tsx`;
}

function stableId(routePath) {
  return (
    "route-" +
    routePath
      .replace(/^\//, "")
      .replace(/\//g, "__")
      .replace(/:/g, "param-")
      .replace(/[^a-zA-Z0-9_-]/g, "-") || "root"
  );
}

function csvEscape(val) {
  const s = val == null ? "" : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function loadAuthBacklog() {
  const p = path.join(OUT_DIR, "auth-mapping-backlog.json");
  if (!fs.existsSync(p)) return { entries: [], meta: {} };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function discrepancyStatus(discrepancies) {
  if (discrepancies.includes("app-without-registry-entry")) return "open";
  if (discrepancies.includes("registry-without-app-route")) return "open";
  if (discrepancies.length === 0) return "aligned";
  return "review";
}

function main() {
  const generatedAt = new Date().toISOString();
  const authBacklog = loadAuthBacklog();
  const authByUiPath = new Map(
    (authBacklog.entries ?? []).map((e) => [e.uiPath, e]),
  );
  const registry = parseRegistry(read("registry"));
  const appParsed = parseAppRoutes(read("app"));
  const sidebar = parseSidebarUrls(read("sidebar"));
  const accessParsed = parseRouteProtection(read("routeAccess"));
  const hookParsed = parseRouteProtection(read("routeProtection"));
  const protection = {
    prefixPermissions: accessParsed.prefixPermissions,
    roleDashboards: hookParsed.roleDashboards,
  };
  const apiMounts = parseBackendApiMounts(read("backendRoutes"));

  const registryByPath = new Map(registry.map((r) => [r.path, r]));
  const appByPath = new Map();
  for (const r of appParsed.routes) {
    if (!appByPath.has(r.path)) appByPath.set(r.path, r);
  }

  const allPaths = new Set([
    ...registry.map((r) => r.path),
    ...appParsed.routes.map((r) => r.path),
  ]);

  const sidebarByPathname = new Map();
  for (const s of sidebar) {
    const key = s.pathname;
    if (!sidebarByPathname.has(key)) sidebarByPathname.set(key, []);
    sidebarByPathname.get(key).push(s);
  }

  const records = [];
  for (const routePath of [...allPaths].sort()) {
    const reg = registryByPath.get(routePath);
    const app = appByPath.get(routePath);
    const isAlias =
      Boolean(reg?.redirectTo) ||
      app?.kind === "redirect" ||
      Boolean(app?.redirectTo);
    const canonicalPath = reg?.redirectTo || app?.redirectTo || routePath;

    const sidebarHits = sidebar.filter((s) =>
      sidebarPathMatchesRoute(s.pathname, routePath),
    );
    const guardPrefix = clientGuardPrefix(routePath);
    const guardRoles = guardPrefix
      ? protection.prefixPermissions[guardPrefix]
      : undefined;

    const routeModule = reg?.module ?? "Unknown";
    const proposedOwner =
      PROPOSED_OWNER_BY_MODULE[routeModule] ?? "unassigned";

    const discrepancies = [];
    if (reg && !app) discrepancies.push("registry-without-app-route");
    if (!reg && app) discrepancies.push("app-without-registry-entry");
    if (reg && app && reg.component && app.component) {
      const rc = reg.component.replace(/\s/g, "");
      const ac = app.component.replace(/\s/g, "");
      if (rc !== ac && !ac.includes(rc) && rc !== "Redirect") {
        discrepancies.push("component-name-mismatch");
      }
    }
    if (sidebarHits.length === 0 && reg?.sidebarVisible) {
      discrepancies.push("registry-sidebar-visible-but-no-sidebar-url");
    }

    let allowedRolesEvidence = [];
    if (reg?.allowedRolesRaw) {
      allowedRolesEvidence.push({
        source: "route-registry.ts",
        value: reg.allowedRolesRaw,
        confidence: reg.allowedRolesRaw === "inherit" ? "medium" : "high",
      });
    }
    if (guardPrefix && guardRoles) {
      allowedRolesEvidence.push({
        source: "route-access.ts",
        prefix: guardPrefix,
        value: guardRoles,
        confidence: "medium",
        note: "Prefix guard only; not per-route. Express is authoritative.",
      });
    }
    if (reg?.permissionKey) {
      allowedRolesEvidence.push({
        source: "sidebar-permKey",
        value: reg.permissionKey,
        confidence: "low",
        note: "Menu permission label; not backend proof.",
      });
    }

    const authEvidence = authByUiPath.get(routePath) ?? null;

    records.push({
      id: stableId(routePath),
      canonicalPath: routePath,
      routeKind: isAlias ? "alias-or-redirect" : reg?.isDynamic ? "dynamic" : "static",
      aliasRedirectTo: reg?.redirectTo || app?.redirectTo || null,
      canonicalTargetPath:
        isAlias && (reg?.redirectTo || app?.redirectTo)
          ? reg?.redirectTo || app?.redirectTo
          : routePath,
      module: routeModule,
      title: reg?.title ?? null,
      legacy: {
        registry: Boolean(reg),
        appTsx: Boolean(app),
        appComponent: app?.component ?? null,
        registryComponent: reg?.component ?? null,
        sourceFiles: [
          reg ? "frontend/src/routes/route-registry.ts" : null,
          app ? "frontend/src/App.tsx" : null,
        ].filter(Boolean),
      },
      navigation: {
        sidebarVisibleRegistry: reg?.sidebarVisible ?? null,
        sidebarGroup: reg?.sidebarGroup ?? null,
        sidebarEntries: sidebarHits.map((s) => ({
          title: s.title,
          urlRaw: s.urlRaw,
        })),
      },
      authorization: {
        allowedRolesEvidence,
        clientGuardPrefix: guardPrefix ?? null,
        backendEvidence:
          authEvidence?.backendEvidence ??
          "Global JWT on /api (routes.ts); see auth-mapping-backlog.json for partial maps",
        backendApiEndpoints: authEvidence?.apiEndpoints ?? null,
        authMappingGap: authEvidence?.gap ?? null,
        backendApiMountHeuristic: inferApiPrefix(routePath),
      },
      discrepancyStatus: discrepancyStatus(discrepancies),
      phase0b: {
        registryGapResolved:
          !discrepancies.includes("app-without-registry-entry"),
      },
      next: {
        proposedAppRouterPath: toNextAppPath(routePath),
        migrationStatus: "legacy",
      },
      ownership: {
        proposedOwner,
        confirmed: false,
      },
      discrepancies,
      confidenceNotes:
        discrepancies.length > 0
          ? discrepancies.join("; ")
          : reg && app
            ? "registry and app aligned"
            : "partial sources only",
    });
  }

  // Sidebar URLs without matching app route (pathname only)
  const sidebarOrphans = [];
  for (const s of sidebar) {
    const hasApp = [...allPaths].some((p) =>
      sidebarPathMatchesRoute(s.pathname, p),
    );
    if (!hasApp) {
      sidebarOrphans.push({
        ...s,
        resolutionStatus: "open",
        resolutionNote:
          "Phase 0B: no App.tsx route — see phase-0b-resolution.md (dead nav link)",
      });
    }
  }

  const aliasRecords = records.filter((r) => r.routeKind === "alias-or-redirect");
  const uniqueCanonical = new Set(
    records.map((r) =>
      r.aliasRedirectTo ? r.aliasRedirectTo : r.canonicalPath,
    ),
  );

  const payload = {
    meta: {
      generatedAt,
      branch: "fix/upgrade_frontend_habib",
      phase: "0A",
      sources: Object.fromEntries(
        Object.entries(PATHS).map(([k, v]) => [k, path.relative(REPO, v)]),
      ),
      counts: {
        registryEntries: registry.length,
        appRouteDeclarations: appParsed.routes.length,
        sidebarUrlEntries: sidebar.length,
        unionUniquePaths: records.length,
        aliasOrRedirectRecords: aliasRecords.length,
        estimatedUniqueBusinessPaths: uniqueCanonical.size,
        sidebarPathnamesWithoutAppRoute: sidebarOrphans.length,
        backendApiMountsSampled: apiMounts.length,
      },
      backendApiMounts: apiMounts,
      roleDashboards: protection.roleDashboards,
      sidebarOrphans,
      phase0b: {
        registryEntriesAdded: 12,
        authMappingBacklog: "auth-mapping-backlog.json",
        resolutionLog: "phase-0b-resolution.md",
      },
      authBacklogMeta: authBacklog.meta ?? {},
    },
    routes: records,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "route-matrix.json"),
    JSON.stringify(payload, null, 2),
  );

  const csvHeaders = [
    "id",
    "canonicalPath",
    "routeKind",
    "aliasRedirectTo",
    "module",
    "title",
    "inRegistry",
    "inAppTsx",
    "appComponent",
    "sidebarVisible",
    "sidebarUrls",
    "clientGuardPrefix",
    "allowedRolesRegistry",
    "proposedNextPath",
    "migrationStatus",
    "proposedOwner",
    "discrepancies",
    "discrepancyStatus",
  ];
  const csvLines = [csvHeaders.join(",")];
  for (const r of records) {
    const reg = registryByPath.get(r.canonicalPath);
    const roles =
      reg?.allowedRolesRaw != null
        ? JSON.stringify(reg.allowedRolesRaw)
        : "";
    csvLines.push(
      [
        r.id,
        r.canonicalPath,
        r.routeKind,
        r.aliasRedirectTo ?? "",
        r.module,
        r.title ?? "",
        r.legacy.registry,
        r.legacy.appTsx,
        r.legacy.appComponent ?? "",
        r.navigation.sidebarVisibleRegistry ?? "",
        r.navigation.sidebarEntries.map((e) => e.urlRaw).join("|"),
        r.authorization.clientGuardPrefix ?? "",
        roles,
        r.next.proposedAppRouterPath,
        r.next.migrationStatus,
        r.ownership.proposedOwner,
        r.discrepancies.join("|"),
        r.discrepancyStatus,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "route-matrix.csv"), csvLines.join("\n"));

  const migrationRoutes = records.map((r) => ({
    path: r.canonicalPath,
    module: r.module,
    legacySource: r.legacy.sourceFiles.join("; "),
    nextPath: r.next.proposedAppRouterPath,
    aliasRedirectTo: r.aliasRedirectTo,
    migrationStatus: r.next.migrationStatus,
    proposedOwner: r.ownership.proposedOwner,
    ownerConfirmed: false,
    discrepancies: r.discrepancies,
    testStatus: "not-started",
  }));
  const migrationPath = path.resolve(
    __dirname,
    "../src/config/routes/migration-routes.json",
  );
  fs.writeFileSync(
    migrationPath,
    JSON.stringify(
      { generatedAt, routeCount: migrationRoutes.length, routes: migrationRoutes },
      null,
      2,
    ),
  );

  // Summary for stdout
  console.log(JSON.stringify(payload.meta.counts, null, 2));
  console.log("Wrote", path.join(OUT_DIR, "route-matrix.json"));
  console.log("Wrote", path.join(OUT_DIR, "route-matrix.csv"));
  console.log("Wrote", migrationPath);
  return payload;
}

main();
