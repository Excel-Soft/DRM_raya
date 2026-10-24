export type FlatProduct = {
  id: string;
  name: string;
  parentName?: string;
  price?: number;
  description?: string | null;
  routeDepartments?: string[];
  projectDepartment?: string | null;
  minDay?: number;
  maxDay?: number;
  minTime?: number;
  maxTime?: number;
};

export type ServiceTreeNode = {
  id: string;
  name: string;
  price?: number;
  description?: string | null;
  routeDepartments?: string[];
  projectDepartment?: string | null;
  subServices?: Array<
    ServiceTreeNode & {
      subSubservices?: ServiceTreeNode[];
    }
  >;
};

export function flattenSalesProducts(products: ServiceTreeNode[], includeSubSub = false): FlatProduct[] {
  const list: FlatProduct[] = [];
  for (const p of products) {
    if (p.subServices?.length) {
      for (const sub of p.subServices) {
        list.push({
          ...sub,
          parentName: p.name,
          price: sub.price ?? p.price,
          description: sub.description ?? p.description ?? sub.name,
          routeDepartments:
            sub.routeDepartments && sub.routeDepartments.length > 0 ? sub.routeDepartments : p.routeDepartments || [],
          projectDepartment: sub.projectDepartment || p.projectDepartment,
        });
        if (includeSubSub && sub.subSubservices?.length) {
          for (const subSub of sub.subSubservices) {
            list.push({
              ...subSub,
              parentName: `${p.name} > ${sub.name}`,
              price: subSub.price ?? sub.price ?? p.price,
              description: subSub.description ?? sub.description ?? subSub.name,
              routeDepartments:
                subSub.routeDepartments && subSub.routeDepartments.length > 0
                  ? subSub.routeDepartments
                  : sub.routeDepartments?.length
                    ? sub.routeDepartments
                    : p.routeDepartments || [],
              projectDepartment: subSub.projectDepartment || sub.projectDepartment || p.projectDepartment,
            });
          }
        }
      }
    } else {
      list.push({
        ...p,
        parentName: p.name,
        routeDepartments: p.routeDepartments || [],
        projectDepartment: p.projectDepartment || null,
      });
    }
  }
  return list;
}

export function normalizeRole(raw: string | null | undefined): string {
  return (raw || "").toLowerCase().trim().replace(/\s+/g, "_");
}

export function isDepartmentAllowed(userRole: string, allowedDeps: string[]): boolean {
  const normalizedRole = normalizeRole(userRole);
  if (normalizedRole.includes("admin") || normalizedRole.includes("super_hod")) return true;
  if (!allowedDeps?.length) return false;
  return allowedDeps.some((dep) => {
    const d = dep.toLowerCase();
    if (d === "sales") return normalizedRole.includes("sales");
    if (d === "support") return normalizedRole.includes("support");
    if (d === "product posting") return normalizedRole.includes("product_posting");
    if (d === "dnd") return normalizedRole.includes("dnd");
    if (d === "marketing") return normalizedRole.includes("marketing");
    if (d === "accounts") return normalizedRole.includes("account");
    if (d === "qa") return normalizedRole.includes("qa");
    if (d === "manager") return normalizedRole.includes("manager");
    if (d === "human resource" || d === "hr") return normalizedRole.includes("hr");
    if (d === "training") return normalizedRole.includes("training");
    return normalizedRole.includes(d);
  });
}

export function isDomainHostingSslProduct(productId: string, flatProducts: FlatProduct[]): boolean {
  if (!productId) return false;
  const product = flatProducts.find((p) => p.id === productId);
  if (!product) return false;
  const name = (product.name || "").toLowerCase();
  const parentName = (product.parentName || "").toLowerCase();
  return (
    name.includes("domain") ||
    name.includes("hosting") ||
    name.includes("ssl") ||
    parentName.includes("domain") ||
    parentName.includes("hosting") ||
    parentName.includes("ssl")
  );
}

export function quotationLineUsd(
  productId: string,
  unitPrice: number,
  quantity: number,
  flatProducts: FlatProduct[],
): number {
  const isXlserp = flatProducts.find((p) => p.id === productId)?.name === "Xlserp - Free Website";
  if (isXlserp) return (Number(quantity) / 90) * (25600 / 280);
  return Number(unitPrice || 0) * Number(quantity || 0);
}

export function invoiceLinePkr(
  productId: string,
  unitPrice: number,
  quantity: number,
  dollarRate: number,
  flatProducts: FlatProduct[],
): number {
  const isXlserp = flatProducts.find((p) => p.id === productId)?.name === "Xlserp - Free Website";
  if (isXlserp) return (Number(quantity) / 90) * 25600;
  return Number(unitPrice) * Number(quantity) * dollarRate;
}
