import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/queryClient";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

const SERVICE_TYPE_COLUMNS = [
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

const FALLBACK_META = {
  titles: ["Mr", "Mrs", "Miss", "Ms", "Dr"],
  sources: [
    "Website",
    "Referral",
    "Cold Call",
    "Social Media",
    "Trade Show",
    "Advertisement",
    "Email Campaign",
    "Walk-in",
    "Other",
  ],
  grades: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"],
  serviceTypes: SERVICE_TYPE_COLUMNS.flat(),
};

const tempContactSchema = z.object({
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

type TempContactFormValues = z.infer<typeof tempContactSchema>;

type TemporaryContactMeta = {
  titles: string[];
  sources: string[];
  grades: string[];
  serviceTypes: string[];
};

type DuplicateContact = {
  id: string;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  grade?: string | null;
  source?: string | null;
  status?: string | null;
  recordType?: "customer" | "temporary_contact";
};

type DuplicateConflicts = {
  customers: DuplicateContact[];
  tempContacts: DuplicateContact[];
};

class DuplicateError extends Error {
  conflicts: DuplicateConflicts;

  constructor(message: string, conflicts: Partial<DuplicateConflicts>) {
    super(message);
    this.conflicts = {
      customers: conflicts.customers ?? [],
      tempContacts: conflicts.tempContacts ?? [],
    };
  }
}

async function fetchMeta(): Promise<TemporaryContactMeta> {
  const res = await fetch("/api/customer/temporary-contact/meta", {
    headers: getAuthHeader(),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load options");
  }

  return res.json();
}

export default function TemporaryAccountPage() {
  const { toast } = useToast();
  const [conflicts, setConflicts] = useState<DuplicateConflicts | null>(null);

  const { data: meta, isLoading: metaLoading } = useQuery<TemporaryContactMeta>({
    queryKey: ["/api/customer/temporary-contact/meta"],
    queryFn: fetchMeta,
  });

  const form = useForm<TempContactFormValues>({
    resolver: zodResolver(tempContactSchema),
    defaultValues: {
      title: "",
      fullName: "",
      email: "",
      mobile: "",
      comment: "",
      source: "",
      grade: "",
      serviceTypes: [],
    },
  });

  const availableMeta = {
    titles: meta?.titles?.length ? meta.titles : FALLBACK_META.titles,
    sources: meta?.sources?.length ? meta.sources : FALLBACK_META.sources,
    grades: meta?.grades?.length ? meta.grades : FALLBACK_META.grades,
    serviceTypes: meta?.serviceTypes?.length ? meta.serviceTypes : FALLBACK_META.serviceTypes,
  };

  const serviceTypeColumns = useMemo(() => {
    const fallbackFlat = FALLBACK_META.serviceTypes as string[];
    const availableList = availableMeta.serviceTypes as string[];
    return SERVICE_TYPE_COLUMNS.map((column, index) => {
      const known = column.filter((item) => availableList.includes(item as string));
      const extras =
        index === SERVICE_TYPE_COLUMNS.length - 1
          ? availableList.filter((item) => !fallbackFlat.includes(item))
          : [];
      return [...known, ...extras];
    });
  }, [availableMeta.serviceTypes]);

  const createMutation = useMutation({
    mutationFn: async (values: TempContactFormValues) => {
      setConflicts(null);
      const res = await fetch("/api/customer/temporary-contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(values),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        throw new DuplicateError(
          data?.message || "We found matching records with this email or mobile.",
          data?.conflicts || {},
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit temporary account");
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Temporary account saved",
        description: "Contact has been added successfully.",
      });
      setConflicts(null);
      form.reset({
        title: "",
        fullName: "",
        email: "",
        mobile: "",
        comment: "",
        source: "",
        grade: "",
        serviceTypes: [],
      });
    },
    onError: (error) => {
      if (error instanceof DuplicateError) {
        setConflicts(error.conflicts);
        toast({
          title: "Possible duplicate found",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Unable to save",
        description: error instanceof Error ? error.message : "Failed to submit temporary account.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: TempContactFormValues) => {
    createMutation.mutate(values);
  };

  const hasConflicts =
    !!conflicts &&
    ((conflicts.customers?.length ?? 0) > 0 || (conflicts.tempContacts?.length ?? 0) > 0);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Customer" }, { label: "Temporary Account" }]} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Temporary Account
          </p>
          <h1 className="text-3xl font-semibold leading-tight">TEMPORARY ACCOUNT</h1>
          <p className="text-muted-foreground mt-1">
            Capture quick lead details that can be promoted later.
          </p>
        </div>
        {createMutation.isSuccess && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {hasConflicts && (
            <Alert
              variant="destructive"
              className="border-amber-300 bg-amber-50 text-amber-900"
              data-testid="alert-duplicate"
            >
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>We found matching records</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="text-sm">
                    Email or mobile already exists in customers or temporary contacts. Please review
                    before proceeding.
                  </p>
                  {conflicts?.customers?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Customers
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {conflicts.customers.map((item) => (
                          <li key={`customer-${item.id}`} className="leading-tight">
                            <span className="font-medium">{item.name || "Unknown"}</span>{" "}
                            <span className="text-muted-foreground">
                              {item.email ? `• ${item.email}` : ""}{" "}
                              {item.mobile ? `• ${item.mobile}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {conflicts?.tempContacts?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Temporary Contacts
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {conflicts.tempContacts.map((item) => (
                          <li key={`temp-${item.id}`} className="leading-tight">
                            <span className="font-medium">{item.name || "Unknown"}</span>{" "}
                            <span className="text-muted-foreground">
                              {item.email ? `• ${item.email}` : ""}{" "}
                              {item.mobile ? `• ${item.mobile}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Primary Detail</CardTitle>
              <CardDescription>Who are you capturing this request for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Title <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        disabled={metaLoading}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableMeta.titles.map((title) => (
                            <SelectItem key={title} value={title}>
                              {title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Person Full Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="name@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Mobile <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter company mobile no"
                          maxLength={11}
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Comment</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any context for this lead" className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Lead Detail</CardTitle>
              <CardDescription>Source, grade, and services of interest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Source <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        disabled={metaLoading}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableMeta.sources.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Grade <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        disabled={metaLoading}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableMeta.grades.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="serviceTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {serviceTypeColumns.map((column, columnIndex) => (
                        <div key={`service-column-${columnIndex}`} className="space-y-2">
                          {column.map((service) => (
                            <label
                              key={service}
                              className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm"
                            >
                              <Checkbox
                                checked={field.value?.includes(service)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(field.value || []);
                                  if (checked) {
                                    next.add(service);
                                  } else {
                                    next.delete(service);
                                  }
                                  field.onChange(Array.from(next));
                                }}
                              />
                              <span className="text-sm leading-snug">{service}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Select at least one service (recommended).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end">
                <Button
                  type="submit"
                  className="bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit form"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
