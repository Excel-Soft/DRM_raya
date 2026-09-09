/**
 * Shared helper for the Service department's "VM / KWA / PSA / Sponsor Brand"
 * KPI buckets.
 *
 * Source of truth: `customers.service_types` (a text[] column populated when a
 * lead/customer is tagged with the service interests it was sold/interested
 * in — the exact same field `dashboard-routes.ts` already uses for the
 * Sales-side "vm/kwa/psa/sponsorBrand" KPIs via `pickService()`). Service
 * customers (`service_customers`) are always created from a parent
 * `customers` row (`service_customers.customer_id -> customers.id`), so this
 * is a real, defensible signal — not an invented number — even though the
 * service_customers table itself has no such column.
 *
 * A row can land in more than one bucket if its service types match more
 * than one keyword (mirrors the Sales-side behavior).
 */

export interface ServiceKpiRowInput {
  /** `customers.serviceTypes` for the underlying customer, if joined. */
  serviceTypes?: string[] | null;
  /** Optional revenue amount to accumulate for this row (defaults to 0). */
  amount?: number | null;
}

export interface ServiceKpiBucket {
  count: number;
  amount: number;
}

export interface ServiceKpiBuckets {
  vm: ServiceKpiBucket;
  kwa: ServiceKpiBucket;
  psa: ServiceKpiBucket;
  sponsor: ServiceKpiBucket;
}

function emptyBuckets(): ServiceKpiBuckets {
  return {
    vm: { count: 0, amount: 0 },
    kwa: { count: 0, amount: 0 },
    psa: { count: 0, amount: 0 },
    sponsor: { count: 0, amount: 0 },
  };
}

export function bucketServiceKpis(rows: ServiceKpiRowInput[]): ServiceKpiBuckets {
  const buckets = emptyBuckets();

  for (const row of rows) {
    const types = (row.serviceTypes ?? [])
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .map((t) => t.toLowerCase());
    if (types.length === 0) continue;

    const amount = Number(row.amount ?? 0) || 0;

    if (types.some((t) => t.includes("vm"))) {
      buckets.vm.count += 1;
      buckets.vm.amount += amount;
    }
    if (types.some((t) => t.includes("kwa"))) {
      buckets.kwa.count += 1;
      buckets.kwa.amount += amount;
    }
    if (types.some((t) => t.includes("psa"))) {
      buckets.psa.count += 1;
      buckets.psa.amount += amount;
    }
    if (types.some((t) => t.includes("sponsor") || t.includes("brand"))) {
      buckets.sponsor.count += 1;
      buckets.sponsor.amount += amount;
    }
  }

  return buckets;
}
