import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BusinessLineTreeSelect } from "@/components/business-line-tree-select";
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
  Sparkles,
  File as FileIcon,
  X,
  Plus,
  Minus,
} from "lucide-react";

const customerFormSchema = z.object({
  companyName: z.string().min(2, "Company name is required").trim(),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional(),
  address: z.string().optional(),
  crmId: z.string().optional(),
  crmDate: z.string().optional(),
  phone: z.string().regex(/^\d*$/, "Digits only").max(11, "Max 11 digits").optional(),
  companyType: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  personName: z.string().optional(),
  accountName: z.string().min(1, "Account holder name is required"),
  cnic: z.string().regex(/^\d*$/, "Digits only").max(13, "Max 13 digits").optional(),
  ntn: z.string().regex(/^\d*$/, "Digits only").max(13, "Max 13 digits").optional(),
  website: z.string().optional(),
  email: z.string().email("Valid email is required").trim().toLowerCase(),
  emails: z.array(z.string()).default([]),
  mobile: z.string().min(1, "Mobile number is required").regex(/^\d+$/, "Digits only").max(11, "Max 11 digits"),
  mobiles: z.array(z.string()).default([]),
  designation: z.string().optional(),
  comment: z.string().optional(),
  rcLink: z.string().optional(),
  source: z.string().optional(),
  grade: z.string().optional(),
  status: z.string().default("New"),
  serviceTypes: z.array(z.string()).default([]),
  businessLine: z.string().optional(),
  abType: z.string().optional(),
  region: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof"];
const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const STATUSES = ["New", "Renew", "Expire"];
const COMPANY_TYPES = ["Private Limited", "Public Limited", "Partnership", "Sole Proprietorship", "LLC", "Other"];
const SOURCES = ["Website", "Alibaba", "WebExcels", "Referral", "Cold Call", "Social Media", "Trade Show", "Advertisement", "Email Campaign", "Other"];

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
  const search = useSearch();
  const fromTempContactId = new URLSearchParams(search).get("fromTempContact") || undefined;
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number; headers: string[]; errors: string[] } | null>(null);
  const [companyCheck, setCompanyCheck] = useState<{ available: boolean; message: string }>({ available: true, message: "" });
  const [fieldChecks, setFieldChecks] = useState<Record<string, { available: boolean; message: string }>>({});
  const [emailsList, setEmailsList] = useState<string[]>([""]);
  const [mobilesList, setMobilesList] = useState<string[]>([""]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEmailField = () => {
    if (emailsList.length < 5) {
      setEmailsList(prev => [...prev, ""]);
    }
  };

  const removeEmailField = (index: number) => {
    if (emailsList.length > 1) {
      const next = emailsList.filter((_, i) => i !== index);
      setEmailsList(next);
      form.setValue("email", next[0] || "");
      form.setValue("emails", next);
      setFieldChecks(prev => {
        const copy = { ...prev };
        delete copy[`email_${index}`];
        return copy;
      });
    }
  };

  const updateEmailValue = (index: number, value: string) => {
    const next = [...emailsList];
    next[index] = value;
    setEmailsList(next);
    form.setValue("email", next[0] || "");
    form.setValue("emails", next);
  };

  const addMobileField = () => {
    if (mobilesList.length < 5) {
      setMobilesList(prev => [...prev, ""]);
    }
  };

  const removeMobileField = (index: number) => {
    const next = mobilesList.filter((_, i) => i !== index);
    setMobilesList(next);
    form.setValue("mobile", next[0] || "");
    form.setValue("mobiles", next);
    setFieldChecks(prev => {
      const copy = { ...prev };
      delete copy[`mobile_${index}`];
      return copy;
    });
  };

  const updateMobileValue = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, "").slice(0, 11);
    const next = [...mobilesList];
    next[index] = cleanVal;
    setMobilesList(next);
    form.setValue("mobile", next[0] || "");
    form.setValue("mobiles", next);
  };

  const { data: products } = useQuery<{ id: string, name: string }[]>({
    queryKey: ["/api/posting/products"],
  });

  // The temp contact's own captured data is handed off via sessionStorage by
  // the "Convert to Customer" button (client/src/pages/temp-contact.tsx),
  // not re-fetched here: GET /api/customer/temporary-contact/:id is scoped to
  // the contact's original creator, so a manager converting someone else's
  // pending lead would get a 404 and an empty form.
  const [sourceTempContact] = useState<any>(() => {
    if (!fromTempContactId) return null;
    try {
      const raw = sessionStorage.getItem("convertTempContact");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.id === fromTempContactId ? parsed : null;
    } catch {
      return null;
    }
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
      emails: [],
      mobile: "",
      mobiles: [],
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

  // Prefill from the temp contact's own captured fields once it loads.
  // Title, Person Name, Account Holder Name, and Mobile are deliberately
  // left blank — the converting user fills those in themselves.
  useEffect(() => {
    if (!sourceTempContact) return;
    const region = REGIONS.includes(sourceTempContact.country) ? sourceTempContact.country : "";
    if (sourceTempContact.email) {
      setEmailsList([sourceTempContact.email]);
    }
    if (sourceTempContact.mobile) {
      setMobilesList([sourceTempContact.mobile]);
    }
    form.reset({
      ...form.getValues(),
      // The temp contact's captured name goes into Company Name only.
      companyName: sourceTempContact.personName || "",
      email: sourceTempContact.email || "",
      emails: sourceTempContact.email ? [sourceTempContact.email] : [],
      phone: sourceTempContact.mobile || "",
      source: sourceTempContact.source || "",
      grade: sourceTempContact.grade || "",
      comment: sourceTempContact.comment || "",
      country: region,
      region,
      serviceTypes: sourceTempContact.serviceTypes || [],
    });
    setSelectedServices(sourceTempContact.serviceTypes || []);
    sessionStorage.removeItem("convertTempContact");
  }, [sourceTempContact]);

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const validEmails = emailsList.map(e => e.trim().toLowerCase()).filter(Boolean);
      const validMobiles = mobilesList.map(m => m.trim()).filter(Boolean);

      const response = await apiRequest("POST", "/api/sales/customers", {
        company: data.companyName,
        accountHolder: data.accountName,
        email: validEmails[0] || data.email,
        emails: validEmails,
        phone: data.phone,
        ntn: data.ntn,
        cnic: data.cnic,
        mobile: validMobiles[0] || data.mobile,
        mobiles: validMobiles,
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
    onSuccess: async (result) => {
      if (result?.success === false) {
        throw new Error(result?.message || "Failed to add customer");
      }

      if (fromTempContactId) {
        try {
          await apiRequest("POST", `/api/customer/temporary-contact/${fromTempContactId}/convert`, {
            customerId: result?.data?.id,
          });
        } catch (err) {
          console.error("Failed to mark temporary contact as converted", err);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/customer/temporary-contact"] });
      }

      toast({
        title: fromTempContactId ? "Converted to Customer" : "Customer Added",
        description: fromTempContactId
          ? "The lead is now a customer in your Private Pool."
          : "The customer has been successfully added to the system.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers/stats"] });
      if (fromTempContactId) {
        setLocation("/customers/private-pool");
      } else {
        // Reset the form to stay on the page and allow adding another customer
        form.reset({
          companyName: "", country: "", city: "", address: "", crmId: "", crmDate: "", phone: "", companyType: "", title: "", personName: "", accountName: "", cnic: "", ntn: "", website: "", email: "", emails: [], mobile: "", mobiles: [], designation: "", comment: "", rcLink: "", source: "", grade: "", status: "New", serviceTypes: [], businessLine: "", abType: "", region: "",
        });
        setEmailsList([""]);
        setMobilesList([""]);
        setSelectedServices([]);
      }
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

    const isEmail = fieldPath.startsWith("email");
    const isMobile = fieldPath.startsWith("mobile");
    const checkField = isEmail ? "email" : isMobile ? "mobile" : fieldPath;

    // Check local duplicate inputs on the current form
    if (isEmail) {
      const count = emailsList.filter(e => e.trim().toLowerCase() === val.toLowerCase()).length;
      if (count > 1) {
        setFieldChecks(prev => ({
          ...prev,
          [fieldPath]: { available: false, message: "Duplicate email on this form" },
        }));
        return;
      }
    }

    if (isMobile) {
      const count = mobilesList.filter(m => m.trim() === val.trim()).length;
      if (count > 1) {
        setFieldChecks(prev => ({
          ...prev,
          [fieldPath]: { available: false, message: "Duplicate mobile number on this form" },
        }));
        return;
      }

      const phoneVal = (form.getValues("phone") || "").replace(/\D/g, "");
      const thisVal = val.replace(/\D/g, "");
      if (phoneVal && thisVal && phoneVal === thisVal) {
        setFieldChecks(prev => ({
          ...prev,
          [fieldPath]: { available: false, message: "Same as Contact No — already exists on this form" },
        }));
        return;
      }
    }

    if (fieldPath === "phone") {
      const thisVal = val.replace(/\D/g, "");
      const firstMobile = (mobilesList[0] || "").replace(/\D/g, "");
      if (firstMobile && thisVal && firstMobile === thisVal) {
        setFieldChecks(prev => ({
          ...prev,
          [fieldPath]: { available: false, message: "Same as Mobile — already exists on this form" },
        }));
        return;
      }
    }

    try {
      const res = await apiRequest("GET", `/api/sales/customers/check-field?field=${encodeURIComponent(checkField)}&value=${encodeURIComponent(val)}`);
      const result = await res.json();
      if (result.available === false) {
        let displayLabel = isEmail ? 'Email Address' : isMobile ? 'Mobile Number' : fieldPath.toUpperCase().replace("_", " ");
        if (fieldPath === 'phone') displayLabel = 'Contact Number';
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
    setIsImportDialogOpen(true);
  };

  const handleChooseImportFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedImportFile(file);
    event.target.value = ''; // allow re-selecting the same file later
  };

  const closeImportDialog = () => {
    setIsImportDialogOpen(false);
    setSelectedImportFile(null);
  };

  const processImportFile = async (file: File) => {
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
      closeImportDialog();
      setImportResult({ successCount, failCount, headers, errors });

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/sales/customers"] });
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (selectedImportFile) processImportFile(selectedImportFile);
  };

  const handleAutoFill = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const testCompanyName = `Testing Enterprise ${randomNum}`;
    const testPhone = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmail = `info${randomNum}@testenterprise.com`;
    const testMobile = `0321${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testCnic = `35201${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testNtn = `1234${Math.floor(100000 + Math.random() * 900000)}`;

    const autoValues: CustomerFormData = {
      companyName: testCompanyName,
      country: "Pakistan",
      city: "Lahore",
      address: "Suite 404, Business Complex, Gulberg III",
      crmId: `CRM-${randomNum}`,
      crmDate: new Date().toISOString().split('T')[0],
      phone: testPhone,
      companyType: "Private Limited",
      title: "Mr",
      personName: "Hanan Raza",
      accountName: "Hanan Textiles",
      cnic: testCnic,
      ntn: testNtn,
      website: `https://www.testenterprise${randomNum}.com`,
      email: testEmail,
      emails: [testEmail],
      mobile: testMobile,
      mobiles: [testMobile],
      designation: "Managing Director",
      comment: "Auto-filled test customer record for rapid validation testing.",
      rcLink: `https://rc.webexcels.com/lead/${randomNum}`,
      source: "WebExcels",
      grade: "A",
      status: "New",
      serviceTypes: ["Mobile Responsive Website", "Alibaba Services"],
      businessLine: "Manufacturing",
      abType: "GS",
      region: "Pakistan",
    };

    setEmailsList([testEmail]);
    setMobilesList([testMobile]);
    form.reset(autoValues);
    setSelectedServices(["Mobile Responsive Website", "Alibaba Services"]);
    setCompanyCheck({ available: true, message: "" });
    setFieldChecks({});

    toast({
      title: "Auto Fill Applied",
      description: "All customer fields have been populated with valid test data.",
    });
  };

  return (
    <div className="p-1 space-y-6 wide-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(fromTempContactId ? "/customer/temporary-contact" : "/sales/customers")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              {fromTempContactId ? "Convert to Customer" : "Add Customer"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {fromTempContactId
                ? "Review the captured lead details and complete the remaining fields to create the customer."
                : "Enter complete company, lead, and business details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoFill}
            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 font-semibold dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
            data-testid="button-auto-fill"
          >
            <Sparkles className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
            Auto Fill Test Data
          </Button>
          <Button variant="outline" onClick={handleCheckDuplicates} data-testid="button-check-duplicates">
            <Search className="w-4 h-4 mr-2" />
            Check Duplicates
          </Button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelected}
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

        <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!open) closeImportDialog(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Customers from CSV</DialogTitle>
              <DialogDescription>
                Choose a CSV file to import. You'll see the file name here before anything is uploaded.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {selectedImportFile ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium truncate dark:text-zinc-200">{selectedImportFile.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      ({(selectedImportFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImportFile(null)}
                    disabled={isImporting}
                    className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                    aria-label="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleChooseImportFile}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-200 dark:border-zinc-800 py-8 text-slate-500 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">Choose a file</span>
                  <span className="text-xs text-slate-400">CSV files only</span>
                </button>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeImportDialog} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={!selectedImportFile || isImporting}>
                {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importResult !== null} onOpenChange={(open) => { if (!open) setImportResult(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Completed</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm text-slate-600 dark:text-zinc-300">
                  <p>
                    Successfully imported <strong className="text-emerald-600 dark:text-emerald-400">{importResult?.successCount ?? 0}</strong> customers.{" "}
                    <strong className={importResult && importResult.failCount > 0 ? "text-red-600 dark:text-red-400" : ""}>{importResult?.failCount ?? 0}</strong> failed.
                  </p>
                  {importResult && importResult.failCount > 0 ? (
                    <p>Potential header mismatch? Detected headers: {importResult.headers.join(", ")}</p>
                  ) : (
                    <p>All data is visible in Business Customers and Tracing List.</p>
                  )}
                  {importResult && importResult.errors.length > 0 && (
                    <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-2 text-red-700 dark:text-red-400 text-xs space-y-0.5">
                      {importResult.errors.slice(0, 5).map((err, i) => <p key={i}>{err}</p>)}
                      {importResult.errors.length > 5 && <p>...</p>}
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setImportResult(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                      <FormLabel>Company Name <span className="text-red-500">*</span></FormLabel>
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
                      <FormLabel>Contact No</FormLabel>
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

                <div className="space-y-2">
                  <FormLabel>Business Line (Posting Products)</FormLabel>
                  {!products ? (
                    <p className="text-sm text-slate-400 border rounded-md p-3 dark:border-zinc-800">Loading products...</p>
                  ) : (
                    <BusinessLineTreeSelect
                      options={products.map((p: any) => p.name)}
                      value={form.watch("businessLine") ? form.watch("businessLine")!.split("\n").filter(Boolean) : []}
                      onChange={(vals) => form.setValue("businessLine", vals.join("\n"))}
                    />
                  )}
                  <FormMessage />
                </div>
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
                        <FormLabel>Title <span className="text-red-500">*</span></FormLabel>
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
                      <FormLabel>Account Holder Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Account holder name" autoComplete="off" {...field} data-testid="input-account-name" />
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

                {/* Dynamic Emails Field (Max 5) */}
                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium flex items-center gap-1">
                    Email <span className="text-red-500">*</span> <span className="text-xs text-muted-foreground font-normal">({emailsList.length}/5 max)</span>
                  </FormLabel>
                  {emailsList.map((emailVal, index) => {
                    const isLast = index === emailsList.length - 1;
                    const showAdd = isLast && emailsList.length < 5;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            placeholder={index === 0 ? "Enter Company E-mail" : "Enter additional email"}
                            value={emailVal}
                            onChange={(e) => updateEmailValue(index, e.target.value)}
                            onBlur={(e) => {
                              if (index === 0) form.setValue("email", e.target.value);
                              handleFieldBlur(`email_${index}`, e.target.value);
                            }}
                            data-testid={`input-email-${index}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            className={`h-9 w-10 shrink-0 text-white ${showAdd ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600"}`}
                            onClick={() => (showAdd ? addEmailField() : removeEmailField(index))}
                            title={showAdd ? "Add email" : "Remove email"}
                          >
                            {showAdd ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          </Button>
                        </div>
                        {fieldChecks[`email_${index}`]?.message && (
                          <p className="text-xs font-medium text-destructive mt-1">
                            {fieldChecks[`email_${index}`].message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Mobile Field (Max 5) */}
                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium flex items-center gap-1">
                    Mobile <span className="text-red-500">*</span> <span className="text-xs text-muted-foreground font-normal">({mobilesList.length}/5 max)</span>
                  </FormLabel>
                  {mobilesList.map((mobileVal, index) => {
                    const isLast = index === mobilesList.length - 1;
                    const showAdd = isLast && mobilesList.length < 5;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder={index === 0 ? "Enter company mobile no" : "Enter additional mobile no"}
                            autoComplete="off"
                            value={mobileVal}
                            maxLength={11}
                            onChange={(e) => updateMobileValue(index, e.target.value)}
                            onBlur={(e) => {
                              if (index === 0) form.setValue("mobile", e.target.value);
                              handleFieldBlur(`mobile_${index}`, e.target.value);
                            }}
                            data-testid={`input-mobile-${index}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            className={`h-9 w-10 shrink-0 text-white ${showAdd ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600"}`}
                            onClick={() => (showAdd ? addMobileField() : removeMobileField(index))}
                            title={showAdd ? "Add mobile" : "Remove mobile"}
                          >
                            {showAdd ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          </Button>
                        </div>
                        {fieldChecks[`mobile_${index}`]?.message && (
                          <p className="text-xs font-medium text-destructive mt-1">
                            {fieldChecks[`mobile_${index}`].message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

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
                      <FormLabel>Grade</FormLabel>
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
                      <FormLabel>Region</FormLabel>
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
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(fromTempContactId ? "/customer/temporary-contact" : "/sales/customers")}
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
                  {fromTempContactId ? "Convert & Save" : "Save Customer"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
