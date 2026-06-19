import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Read-only UI projection of the GM/Sales workflow config (Patch 5 Stage 7).
 * Drives config-aware labels (verification lifecycle) and hides actions the
 * server would reject anyway. The server remains the source of truth for
 * enforcement — this only affects presentation.
 */
export interface UiWorkflowConfig {
  verificationManagerRequiredAfterQa: boolean;
  serviceExecutiveCanCreateGM: boolean;
  serviceExecutiveCanCreateManualInvoice: boolean;
}

const DEFAULT_UI_CONFIG: UiWorkflowConfig = {
  verificationManagerRequiredAfterQa: true,
  serviceExecutiveCanCreateGM: false,
  serviceExecutiveCanCreateManualInvoice: false,
};

export function useUiWorkflowConfig() {
  const query = useQuery<UiWorkflowConfig>({
    queryKey: ["ui-workflow-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gm-sales-workflow/ui-config");
      if (!res.ok) throw new Error("Failed to fetch workflow config");
      const body = await res.json();
      return (body?.data ?? DEFAULT_UI_CONFIG) as UiWorkflowConfig;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    config: query.data ?? DEFAULT_UI_CONFIG,
  };
}

function normalizeRole(raw: string | null | undefined): string {
  return (raw || "").toLowerCase().trim().replace(/\s+/g, "_");
}

/** The viewer's active + assigned roles, normalized, read from sessionStorage
 *  (populated by the app after /api/auth/me). */
function readViewerRoles(): Set<string> {
  const active = normalizeRole(sessionStorage.getItem("userRole"));
  let all: string[] = [];
  try {
    all = (JSON.parse(sessionStorage.getItem("userRoles") || "[]") as string[]).map(normalizeRole);
  } catch {
    all = [];
  }
  return new Set<string>([active, ...all].filter(Boolean));
}

/**
 * Service-Executive create gates (Patch 5 Stage 7, Part E). Mirrors the server
 * policy for presentation only: when the viewer is a Service Executive (and not
 * also an always-allowed creator role) the GM / manual-invoice create actions are
 * hidden unless the corresponding config flag is enabled. The server still
 * enforces the real policy via resolveAllowedRoles / requireManualInvoiceCreator.
 */
export function useServiceExecutiveCreateGates() {
  const { config } = useUiWorkflowConfig();
  const roles = readViewerRoles();
  // Roles that may create regardless of the Service-Executive config flags, so a
  // multi-role user (e.g. admin who also holds service_executive) is never hidden.
  const alwaysAllowed = ["admin", "super_admin", "administrator", "sales_executive", "sales_manager", "account_manager"];
  const isPrivileged = alwaysAllowed.some((r) => roles.has(r));
  const isServiceExecutive = roles.has("service_executive");
  const gatedServiceExec = isServiceExecutive && !isPrivileged;
  return {
    isServiceExecutive: gatedServiceExec,
    canCreateGm: !gatedServiceExec || config.serviceExecutiveCanCreateGM,
    canCreateManualInvoice: !gatedServiceExec || config.serviceExecutiveCanCreateManualInvoice,
  };
}
