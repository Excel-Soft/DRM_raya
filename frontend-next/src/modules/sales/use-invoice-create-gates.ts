"use client";

import { useMemo } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { normalizeRole } from "./sales-product-catalog";

type UiWorkflowConfig = {
  serviceExecutiveCanCreateManualInvoice?: boolean;
};

function readViewerRoles(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const active = normalizeRole(sessionStorage.getItem("userRole"));
  let all: string[] = [];
  try {
    all = (JSON.parse(sessionStorage.getItem("userRoles") || "[]") as string[]).map(normalizeRole);
  } catch {
    all = [];
  }
  return new Set([active, ...all].filter(Boolean));
}

export function useInvoiceCreateGates() {
  const { data: configRes } = useApiResource<{ data?: UiWorkflowConfig }>("/api/gm-sales-workflow/ui-config");
  const config = configRes?.data ?? {};

  return useMemo(() => {
    const roles = readViewerRoles();
    const isSalesExecutive = roles.has("sales_executive");
    const isServiceExecutive = roles.has("service_executive");
    const canCreateManualInvoice = config.serviceExecutiveCanCreateManualInvoice ?? false;
    const canCreateInvoice = isSalesExecutive || (isServiceExecutive && canCreateManualInvoice);
    return { canCreateInvoice, isSalesExecutive, isServiceExecutive };
  }, [config.serviceExecutiveCanCreateManualInvoice]);
}
