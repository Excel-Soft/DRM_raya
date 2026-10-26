import { z } from "zod";

export const TEMP_CONTACT_SERVICE_TYPE_COLUMNS = [
  [
    "Mobile Responsive Website",
    "Domain Registration / Hosting",
    "Facebook Fan Page Design",
    "Graphic Designing & Logo Desig",
    "Product mockups design service",
    "Amazon Store / Posting",
    "Amazon Product Hunting",
    "Instagram Page Design Manage",
    "Social Media followers",
    "VM",
    "Alibaba VA",
  ],
  [
    "E-Commerce Store",
    "Photo Shooting & Video Documen",
    "EBay Store / Posting",
    "Daraz Store & Product Posting",
    "Designing Services",
    "Alibaba listing page",
    "Amazon Product Listing",
    "Instagram Ads",
    "Minisite professional",
    "Etsy Store Creation or Posting",
  ],
  [
    "Alibaba Services",
    "SEO & SEM Services",
    "Web Design & Development",
    "Digital Marketing",
    "CONSULTANCY & CERTIFICATION",
    "Videography Service",
    "Amazon Account Creation",
    "Facebook Ads",
    "Android App",
    "Social Media Account Handling",
  ],
] as const;

export const TEMP_CONTACT_FALLBACK_META = {
  titles: ["Mr", "Mrs", "Miss", "Ms", "Dr"],
  grades: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"],
  serviceTypes: TEMP_CONTACT_SERVICE_TYPE_COLUMNS.flat(),
};

export const tempContactFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  fullName: z.string().min(3, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  mobile: z
    .string()
    .min(7, "Mobile number is required")
    .max(11, "Mobile number cannot exceed 11 digits")
    .regex(/^[0-9+\-\s()]+$/, "Use digits and + - ( ) only")
    .refine((value) => value.replace(/\D/g, "").length >= 7, "Enter a valid mobile number"),
  comment: z.string().optional(),
  source: z.string().min(1, "Source is required"),
  grade: z.string().min(1, "Grade is required"),
  serviceTypes: z.array(z.string()).default([]),
});

export type TempContactFormValues = z.infer<typeof tempContactFormSchema>;

export type TemporaryContactMeta = {
  titles: string[];
  sources: string[];
  grades: string[];
  serviceTypes: string[];
};

export type DuplicateContact = {
  id: string;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  grade?: string | null;
  source?: string | null;
  status?: string | null;
  recordType?: "customer" | "temporary_contact";
};

export type DuplicateConflicts = {
  customers: DuplicateContact[];
  tempContacts: DuplicateContact[];
};

export function buildTempContactServiceColumns(availableList: string[]): string[][] {
  const fallbackFlat = TEMP_CONTACT_FALLBACK_META.serviceTypes as string[];
  return TEMP_CONTACT_SERVICE_TYPE_COLUMNS.map((column, index) => {
    const known = column.filter((item) => availableList.includes(item as string));
    const extras =
      index === TEMP_CONTACT_SERVICE_TYPE_COLUMNS.length - 1
        ? availableList.filter((item) => !fallbackFlat.includes(item))
        : [];
    return [...known, ...extras];
  });
}

export const EMPTY_TEMP_CONTACT_FORM: TempContactFormValues = {
  title: "",
  fullName: "",
  email: "",
  mobile: "",
  comment: "",
  source: "",
  grade: "",
  serviceTypes: [],
};
