"use client";

import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import type { FlatProduct } from "./sales-product-catalog";
import { isDepartmentAllowed } from "./sales-product-catalog";

type Props = {
  value: string;
  flatProducts: FlatProduct[];
  onSelect: (product: FlatProduct) => void;
  disabled?: boolean;
  className?: string;
  followedUpProductIds?: Set<string>;
  checkRoleGate?: boolean;
  userRole?: string;
};

export function ProductSelectField({
  value,
  flatProducts,
  onSelect,
  disabled,
  className,
  followedUpProductIds,
  checkRoleGate,
  userRole = "sales_executive",
}: Props) {
  return (
    <Select
      className={className}
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) return;
        const product = flatProducts.find((p) => p.id === id);
        if (!product) return;
        const hasFollowedUp = followedUpProductIds?.has(product.id);
        if (checkRoleGate && !hasFollowedUp) {
          const allowed = product.routeDepartments || [];
          if (!isDepartmentAllowed(userRole, allowed)) {
            toast.error("You cannot quote/invoice this service until your department is allowed.");
            return;
          }
        }
        onSelect(product);
      }}
    >
      <option value="">Select product…</option>
      {flatProducts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.parentName && p.parentName !== p.name ? `${p.parentName} — ${p.name}` : p.name}
        </option>
      ))}
    </Select>
  );
}
