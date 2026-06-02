import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  User,
  Target,
  Save,
  Upload,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  Loader2,
} from "lucide-react";

const customerFormSchema = z.object({
  companyName: z.string().min(2, "Company name is required").trim(),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional(),
  address: z.string().optional(),
  crmId: z.string().optional(),
  crmDate: z.string().optional(),
  phone: z.string().min(1, "Contact number is required").regex(/^\d+$/, "Digits only").max(11, "Max 11 digits"),
  companyType: z.string().optional(),
  title: z.string().optional(),
  personName: z.string().optional(),
  accountName: z.string().min(1, "Account holder name is required"),
  cnic: z.string().regex(/^\d*$/, "Digits only").max(13, "Max 13 digits").optional(),
  ntn: z.string().regex(/^\d*$/, "Digits only").max(13, "Max 13 digits").optional(),
  website: z.string().optional(),
  email: z.string().email("Valid email is required").trim().toLowerCase(),
  mobile: z.string().regex(/^\d*$/, "Digits only").max(11, "Max 11 digits").optional(),
  designation: z.string().optional(),
  comment: z.string().optional(),
  rcLink: z.string().optional(),
  source: z.string().optional(),
  grade: z.string().min(1, "Grade is required"),
  status: z.string().default("New"),
  serviceTypes: z.array(z.string()).default([]),
  businessLine: z.string().optional(),
  abType: z.string().optional(),
  region: z.string().min(1, "Region is required"),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof"];
const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const STATUSES = ["New", "Renew", "Expire"];
const COMPANY_TYPES = ["Private Limited", "Public Limited", "Partnership", "Sole Proprietorship", "LLC", "Other"];
const SOURCES = ["Website", "Referral", "Cold Call", "Social Media", "Trade Show", "Advertisement", "Email Campaign", "Other"];

const AB_TYPES = ["GS", "FM"];

const SERVICE_TYPES = [
  "Mobile Responsive Website",
  "E-Commerce Store",
  "Alibaba Services",
  "Domain Registration / Hosting",
  "Photo Shooting & Video Documentation",
  "SEO & SEM Services",
  "Facebook Fan Page Design",
  "EBay Store / Posting",
  "Web Design & Development",
  "Graphic Designing & Logo Design",
  "Daraz Store & Product Posting",
  "Digital Marketing",
  "Product mockups design service",
  "Designing Services",
  "CONSULTANCY & CERTIFICATION",
  "Amazon Store / Posting",
  "Alibaba listing page",
  "Videography Service",
  "Amazon Product Hunting",
  "Amazon Product Listing",
  "Amazon Account Creation",
  "Instagram Page Design Manage",
  "Instagram ADs",
  "Facebook ADs",
  "Social Media followers",
  "Minisite professional",
  "Android App",
  "VM",
  "Etsy Store Creation or Posting",
  "Social Media Account Handling",
  "AliBaba VA",
];

const BUSINESS_LINES = {
  "Manufacturing": [
    "Textiles",
    "Electronics",
    "Machinery",
    "Chemicals",
    "Food Processing",
    "Automotive",
    "Pharmaceuticals",
  ],
  "Trading": [
    "Import/Export",
    "Wholesale",
    "Retail",
    "E-commerce",
  ],
  "Services": [
    "IT Services",
    "Consulting",
    "Financial Services",
    "Logistics",
    "Healthcare",
    "Education",
  ],
  "Agriculture": [
    "Farming",
    "Livestock",
    "Fisheries",
    "Forestry",
  ],
};

const REGIONS = ["UAE", "USA", "Pakistan"];

export default function AddCustomer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [companyCheck, setCompanyCheck] = useState<{ available: boolean; message: string }>({ available: true, message: "" });
  const [fieldChecks, setFieldChecks] = useState<Record<string, { available: boolean; message: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products } = useQuery<{ id: string, name: string }[]>({
    queryKey: ["/api/posting/products"],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      companyName: "",
      country: "",
      city: "",
      address: "",
      crmId: "",
      crmDate: "",
      phone: "",
      companyType: "",
      title: "",
      personName: "",
      accountName: "",
      cnic: "",
      ntn: "",
      website: "",
      email: "",
      mobile: "",
      designation: "",
      comment: "",
      rcLink: "",
      source: "",
      grade: "",
      status: "New",
      serviceTypes: [],
      businessLine: "",
      abType: "",
      region: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const response = await apiRequest("POST", "/api/sales/customers", {
        company: data.companyName,
        accountHolder: data.accountName,
        email: data.email,
        phone: data.phone,
        ntn: data.ntn,
        cnic: data.cnic,
        mobile: data.mobile,
        crmId: data.crmId,
        crmDate: data.crmDate,
        grade: data.grade,
        stage: data.status || "New",
        lastNote: data.comment,
        serviceTypes: selectedServices,
        region: data.region,
        source: data.source,
        companyType: data.companyType,
        personName: data.personName,
        designation: data.designation,
        rcLink: data.rcLink,
        businessLine: data.businessLine,
        title: data.title,
        website: data.website,
        address: data.address,
        city: data.city,
        country: data.country,
        abType: data.abType,
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result?.success === false) {
        throw new Error(result?.message || "Failed to add customer");
      }
      toast({
        title: "Customer Added",
        description: "The customer has been successfully added to the system.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers/stats"] });
      setLocation("/sales/customers");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    // Check if there are any existing errors flagged by our API checks
    if (companyCheck.available === false) {
      toast({
        title: "Validation Error",
        description: "Company name already exists in the system. Cannot proceed.",
        variant: "destructive",
      });
      return;
    }

    const failedFields = Object.entries(fieldChecks)
      .filter(([_, check]) => check.available === false)
      .map(([field, _]) => field.toUpperCase().replace("_", " "));

    if (failedFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Duplicates found! ${failedFields.join(", ")} already exists.`,
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(data);
  };

  const handleServiceToggle = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const handleCompanyNameBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const name = e.target.value.trim();
    if (name.length < 2) return;

    try {
      const res = await apiRequest("GET", `/api/sales/customers/check-company?name=${encodeURIComponent(name)}`);
      const result = await res.json();
      if (result.available === false) {
        setCompanyCheck({ available: false, message: "Company name already exists!" });
      } else {
        setCompanyCheck({ available: true, message: "" });
      }
    } catch (err) {
      console.error("Check company error", err);
    }
  };

  const handleFieldBlur = async (fieldPath: string, value: string) => {
    const val = value?.trim();
    if (!val || val.length < 2) {
      setFieldChecks(prev => ({ ...prev, [fieldPath]: { available: true, message: "" } }));
      return;
    }

    try {
      const res = await apiRequest("GET", `/api/sales/customers/check-field?field=${encodeURIComponent(fieldPath)}&value=${encodeURIComponent(val)}`);
      const result = await res.json();
      if (result.available === false) {
        let displayLabel = fieldPath.toUpperCase().replace("_", " ");
        if (fieldPath === 'email') displayLabel = 'Email Address';
        if (fieldPath === 'phone' || fieldPath === 'mobile') displayLabel = 'Number';
        setFieldChecks(prev => ({ ...prev, [fieldPath]: { available: false, message: `${displayLabel} already exists!` } }));
      } else {
        setFieldChecks(prev => ({ ...prev, [fieldPath]: { available: true, message: "" } }));
      }
    } catch (err) {
      console.error(`Check ${fieldPath} error`, err);
    }
  };

  const handleCheckDuplicates = () => {
    const companyName = form.getValues("companyName");
    const email = form.getValues("email");
    setLocation(`/sales/duplicate-checker?company=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}`);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Company Name", "Country", "City", "Address", "Contact No",
      "Account Holder Name", "Email", "Grade", "Region", "CNIC", "NTN", "Mobile",
      "Company Type", "Person Name", "Source", "Status", "AB Type"
    ];
    const csvContent = headers.join(",") + "\n" +
      "Example Company,Pakistan,Lahore,123 Main St,12345678901,John Doe,john@example.com,C,Pakistan,1234512345671,1234567123451,12345123456,Private Limited,Jane Doe,Website,New,GS";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "customer_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;

      // Robust CSV parsing that handles quotes, multiple delimiters and carriage returns
      const parseCSV = (str: string) => {
        // Remove BOM if present
        str = str.replace(/^\uFEFF/, "");

        // Detect delimiter: check if semicolon is used more than comma in the first line
        const firstLine = str.split(/[\r\n]+/)[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ";" : ",";

        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = "";
        let inQuotes = false;

        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const nextChar = str[i + 1];

          if (char === '"' && inQuotes && nextChar === '"') {
            currentField += '"';
            i++;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = "";
          } else if ((char === "\r" || char === "\n") && !inQuotes) {
            if (currentField !== "" || currentRow.length > 0) {
              currentRow.push(currentField.trim());
              rows.push(currentRow);
              currentField = "";
              currentRow = [];
            }
            if (char === "\r" && nextChar === "\n") i++;
          } else {
            currentField += char;
          }
        }
        if (currentField !== "" || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          rows.push(currentRow);
        }
        return rows;
      };

      const rows = parseCSV(text);
      if (rows.length < 1) {
        setIsImporting(false);
        toast({ title: "Import Error", description: "The file is empty", variant: "destructive" });
        return;
      }

      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1).filter(row => row.some(cell => cell.length > 0));

      let successCount = 0;
      let failCount = 0;
      let errors: string[] = [];
      const detectedHeaders: string[] = [];

      for (const row of dataRows) {
        const rowData: any = {};
        headers.forEach((header, index) => {
          const value = row[index] || "";
          // Normalize header: lowercase and strip everything except alphanumeric
          const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!detectedHeaders.includes(header)) detectedHeaders.push(header);

          if (h === "companyname" || h === "company" || h === "client" || h === "business") rowData.company = value;
          else if (h === "accountholdername" || h === "accountholder" || h === "account" || h === "name") rowData.accountHolder = value;
          else if (h === "email" || h === "mail" || h === "emailaddress") rowData.email = value;
          else if (h === "contactno" || h === "contact" || h === "phone" || h === "mobile") rowData.phone = value;
          else if (h === "grade" || h === "clientgrade") rowData.grade = value;
          else if (h === "region" || h === "location") rowData.region = value;
          else if (h === "cnic") rowData.cnic = value;
          else if (h === "ntn") rowData.ntn = value;
          else if (h === "mobile") rowData.mobile = value;
          else if (h === "companytype" || h === "type") rowData.companyType = value;
          else if (h === "personname") rowData.personName = value;
          else if (h === "source") rowData.source = value;
          else if (h === "status" || h === "stage") rowData.stage = value;
          else if (h === "country") rowData.country = value;
          else if (h === "city") rowData.city = value;
          else if (h === "address") rowData.address = value;
          else if (h === "abtype" || h === "ab") rowData.abType = value;
        });

        // Set defaults
        if (!rowData.stage) rowData.stage = "New";
        if (!rowData.serviceTypes) rowData.serviceTypes = [];

        try {
          // Validation for required fields
          const missing = [];
          if (!rowData.company) missing.push("Company");
          if (!rowData.email) missing.push("Email");
          if (!rowData.phone) missing.push("Phone");
          if (!rowData.accountHolder) missing.push("Account Holder");
          if (!rowData.grade) missing.push("Grade");
          if (!rowData.region) missing.push("Region");

          if (missing.length > 0) {
            failCount++;
            errors.push(`Row ${dataRows.indexOf(row) + 2}: Missing ${missing.join(", ")}`);
            continue;
          }

          const response = await apiRequest("POST", "/api/sales/customers", { ...rowData, upsert: true });
          const result = await response.json();
          if (result.success !== false) {
            successCount++;
          } else {
            failCount++;
            errors.push(`Row ${dataRows.indexOf(row) + 2}: ${result.message || "Unknown error"}`);
          }
        } catch (error: any) {
          console.error("Import error", error);
          failCount++;
          errors.push(`Row ${dataRows.indexOf(row) + 2}: ${error.message || "Network error"}`);
        }
      }

      setIsImporting(false);
      event.target.value = ''; // Reset input

      toast({
        title: "Import Completed",
        description: `Successfully imported ${successCount} customers. ${failCount} failed. ${failCount > 0 ? "Potential header mismatch? Detected headers: " + headers.join(", ") : "All data is visible in Business Customers and Tracing List."}${errors.length > 0 ? "\n\nErrors:\n" + errors.slice(0, 3).join("\n") + (errors.length > 3 ? "\n..." : "") : ""}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/sales/customers"] });
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="p-1 space-y-6 wide-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/sales/customers")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Add Customer</h1>
            <p className="text-muted-foreground mt-1">Enter complete company, lead, and business details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCheckDuplicates} data-testid="button-check-duplicates">
            <Search className="w-4 h-4 mr-2" />
            Check Duplicates
          </Button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={handleImportCSV}
            disabled={isImporting}
            data-testid="button-upload-csv"
          >
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Template
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Detail
                </CardTitle>
                <CardDescription>Basic company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter company name"
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            handleCompanyNameBlur(e);
                          }}
                          data-testid="input-company-name"
                        />
                      </FormControl>
                      {companyCheck.message && (
                        <p className="text-xs font-medium text-destructive mt-1">{companyCheck.message}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REGIONS.map(region => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter full address" {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="crmId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CRM ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="CRM ID" 
                            {...field} 
                            onBlur={(e) => {
                              field.onBlur();
                              handleFieldBlur("crm_id", e.target.value);
                            }}
                            data-testid="input-crm-id" 
                          />
                        </FormControl>
                        {fieldChecks["crm_id"]?.message && (
                          <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["crm_id"].message}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="crmDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CRM Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-crm-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact No *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter contact number" 
                          {...field} 
                          maxLength={11} 
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur("phone", e.target.value);
                          }}
                          data-testid="input-phone" 
                        />
                      </FormControl>
                      {fieldChecks["phone"]?.message && (
                        <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["phone"].message}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="abType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AB Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ab-type">
                            <SelectValue placeholder="Select AB type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AB_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Primary Detail
                </CardTitle>
                <CardDescription>Primary contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-title">
                              <SelectValue placeholder="Title" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TITLES.map(title => (
                              <SelectItem key={title} value={title}>{title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="personName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Person Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" {...field} data-testid="input-person-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Account holder name" {...field} data-testid="input-account-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cnic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNIC</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="CNIC number" 
                            {...field} 
                            maxLength={13} 
                            onBlur={(e) => {
                              field.onBlur();
                              handleFieldBlur("cnic", e.target.value);
                            }}
                            data-testid="input-cnic" 
                          />
                        </FormControl>
                        {fieldChecks["cnic"]?.message && (
                          <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["cnic"].message}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ntn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NTN</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="NTN number" 
                            {...field} 
                            maxLength={13} 
                            onBlur={(e) => {
                              field.onBlur();
                              handleFieldBlur("ntn", e.target.value);
                            }}
                            data-testid="input-ntn" 
                          />
                        </FormControl>
                        {fieldChecks["ntn"]?.message && (
                          <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["ntn"].message}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="email@company.com" 
                          {...field} 
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur("email", e.target.value);
                          }}
                          data-testid="input-email" 
                        />
                      </FormControl>
                      {fieldChecks["email"]?.message && (
                        <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["email"].message}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Mobile number" 
                          {...field} 
                          maxLength={11} 
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur("mobile", e.target.value);
                          }}
                          data-testid="input-mobile" 
                        />
                      </FormControl>
                      {fieldChecks["mobile"]?.message && (
                        <p className="text-xs font-medium text-destructive mt-1">{fieldChecks["mobile"].message}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="Job title" {...field} data-testid="input-designation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Comment</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add notes or comments" {...field} data-testid="input-comment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Lead Detail
                </CardTitle>
                <CardDescription>Lead source and classification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="rcLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RC Link</FormLabel>
                      <FormControl>
                        <Input placeholder="Resource center link" {...field} data-testid="input-rc-link" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue placeholder="Lead source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCES.map(source => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
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
                      <FormLabel>Grade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-grade">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GRADES.map(grade => (
                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUSES.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-region">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REGIONS.map(region => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Service Type</FormLabel>
                  <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto overflow-x-hidden">
                    {SERVICE_TYPES.map((service: string) => (
                      <div key={service} className="flex items-start space-x-2">
                        <Checkbox
                          id={service}
                          checked={selectedServices.includes(service)}
                          onCheckedChange={() => handleServiceToggle(service)}
                          data-testid={`checkbox-service-${service.toLowerCase().replace(/\s/g, '-')}`}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={service}
                          className="text-sm font-medium leading-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer break-words flex-1"
                        >
                          {service}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Business Line (Posting Products)</FormLabel>
                  <Select
                    onValueChange={(val) => form.setValue("businessLine", val)}
                    value={form.watch("businessLine")}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-business-line" className="w-full">
                        <SelectValue placeholder={!products ? "Loading products..." : "Select product"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products && products.length > 0 ? (
                        products.map((p: any) => (
                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          {!products ? "Loading..." : "No products found in database"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/sales/customers")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Customer
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
