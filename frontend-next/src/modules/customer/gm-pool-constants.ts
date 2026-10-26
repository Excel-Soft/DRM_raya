export type GmPackage = {
  id: string;
  name: string;
  priceUsd: number;
  orderDollar?: number;
};

export const GM_FALLBACK_PACKAGES: GmPackage[] = [
  { id: "basic", name: "Basic", priceUsd: 1399, orderDollar: 1399 },
  { id: "basic-plus", name: "Basic Plus", priceUsd: 1999, orderDollar: 1999 },
  { id: "standard", name: "Standard", priceUsd: 2999, orderDollar: 2999 },
  { id: "premium", name: "Premium", priceUsd: 4999, orderDollar: 4999 },
  { id: "verified-supplier", name: "Verified Supplier", priceUsd: 9999, orderDollar: 9999 },
  { id: "ggs-pro", name: "GGS Pro", priceUsd: 2799, orderDollar: 2799 },
];

export type GmPoolRow = {
  id: string;
  drmId?: string;
  memberId?: string;
  orderId?: string;
  company?: string;
  customerName?: string;
  salesPersonName?: string;
  package?: string;
  dollarRate?: number | string;
  orderDollar?: number | string;
  customerDollar?: number | string;
  status?: string;
  rawStatus?: string;
  finalStatus?: string;
  hodStatus?: string;
  approvalStatus?: string;
  withdrawalStatus?: string;
  updateRequestStatus?: string;
  paymentStatus?: string;
  createdAt?: string;
  pkr?: number | string;
  abDiscount?: number | string;
  extraDiscount?: number | string;
  isLoan?: boolean;
  isPartialPayment?: boolean;
  installments?: Array<Record<string, unknown>>;
  dropout?: string;
  extension?: string;
  type?: string;
  packagePrice?: number | string;
  extraPkrDiscount?: number | string;
  accountManagerStatus?: string;
  paymentProofUrl?: string | null;
  updateRequest?: string;
  bvDate?: string | null;
  alibaba?: string | null;
  installmentsTotal?: number;
  installmentsCollected?: number;
};

export type GmFormState = {
  companyId: string;
  companyName: string;
  memberId: string;
  orderId: string;
  packageId: string;
  pkrAmount: string;
  dollarRate: string;
  alibabaDiscount: string;
  paymentStatus: string;
  type: string;
  dropout: string;
  extension: string;
  detail: string;
  loanMode: "none" | "loan" | "installment";
};

export const EMPTY_GM_FORM: GmFormState = {
  companyId: "",
  companyName: "",
  memberId: "",
  orderId: "",
  packageId: "",
  pkrAmount: "",
  dollarRate: "",
  alibabaDiscount: "0",
  paymentStatus: "",
  type: "New",
  dropout: "",
  extension: "",
  detail: "",
  loanMode: "none",
};

export const GM_PAYMENT_STATUSES = ["Cash Received", "Customer Paid", "Online Paid"] as const;
export const GM_TYPES = ["New", "Renewal", "EC", "Rc-Up", "Kwa", "Upgrade"] as const;

export const GM_DROPOUT_OPTIONS = [
  "Basic Drop",
  "Basic Plus Drop",
  "Basic P/D",
  "Basic Plus P/D",
  "Pkg Update",
] as const;

export const GM_EXTENSION_OPTIONS = ["Apply", "No-Need", "Late"] as const;
