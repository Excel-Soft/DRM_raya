export interface AccountHead {
  id: string;
  code: string;
  name: string;
  category: string | null;
  type: "Parent" | "Child" | "Transactional" | "Sub-Transactional" | string;
  parentAccountId: string | null;
  openingBalance: string | null;
  normalBalance: string | null;
  branch: string | null;
  /** Integer flag from the DB (0 | 1), not a boolean. */
  isActive: number;
  description: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
