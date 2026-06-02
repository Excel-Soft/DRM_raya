import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Building, Wallet, TrendingUp, Receipt, CreditCard, Edit, Save } from "lucide-react";
import type { AccountHead } from "@shared/schema";

const CATEGORIES = [
  { value: "Assets", label: "Assets", range: "10000-14999", icon: Building, color: "text-blue-500" },
  { value: "Liabilities", label: "Liabilities", range: "20000-24999", icon: CreditCard, color: "text-red-500" },
  { value: "OwnerEquity", label: "Owner Equity", range: "30000-34999", icon: Wallet, color: "text-purple-500" },
  { value: "Revenue", label: "Revenue", range: "40000-44999", icon: TrendingUp, color: "text-green-500" },
  { value: "Expenses", label: "Expenses", range: "50000-54999", icon: Receipt, color: "text-orange-500" },
];

const ACCOUNT_TYPES: Record<string, string[]> = {
  Assets: ["Current Asset", "Fixed Asset", "Intangible Asset", "Investment"],
  Liabilities: ["Current Liability", "Long-term Liability", "Contingent Liability"],
  OwnerEquity: ["Capital", "Retained Earnings", "Reserves"],
  Revenue: ["Operating Revenue", "Non-operating Revenue", "Other Income"],
  Expenses: ["Operating Expense", "Administrative Expense", "Financial Expense"],
};

const ASSETS_DATA = [
  {
    sno: "1", code: "10100", head: "Current Assets", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "10101", head: "→ Cash & Cash Equivalents", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "10101-1", head: "↳ Petty Cash", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10101-2", head: "↳ Cash on Hand", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10101-3", head: "↳ Cash at Bank - Checking", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10101-4", head: "↳ Cash in Bank - Savings", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10101-5", head: "↳ Foreign Currency Accounts", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      },
      {
        code: "10102", head: "→ Accounts Receivable", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "10103", head: "→ Advances to Employees", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "10103-1", head: "↳ Advance Salary Paid to Employee", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "2", code: "10200", head: "Non-Current Assets", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "10201", head: "→ Property, Plant & Equipment (PP&E)", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "10201-1", head: "↳ Land", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-2", head: "↳ Buildings", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-3", head: "↳ Machinery and Equipment", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-4", head: "↳ Leasehold Improvements", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-5", head: "↳ Vehicles", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-6", head: "↳ Computer & Laptops", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10201-7", head: "↳ Mobile and Headsets", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      },
      {
        code: "10202", head: "→ Office Furniture & Fixtures", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "10202-1", head: "↳ Furniture & Fixtures", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "10202-2", head: "↳ Solar System", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      }
    ]
  }
];

const LIABILITIES_DATA = [
  {
    sno: "1", code: "15100", head: "Current Liabilities", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "15101", head: "→ Accounts Payable", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "15102", head: "→ Accrued Liabilities", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "15102-1", head: "↳ Accrued Salaries", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "15102-2", head: "↳ Accrued Interest", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "15102-3", head: "↳ Accrued Professional Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "15102-4", head: "↳ Accrued Payroll Taxes", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      }
    ]
  },
  {
    sno: "2", code: "15200", head: "Non-Current Liabilities", badge: "bg-[#20c997]", isMain: true,
    children: []
  }
];

const OWNER_EQUITY_DATA = [
  {
    sno: "1", code: "20100", head: "Owner's Equity", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "20101", head: "→ Owner's Withdrawals", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "20101-1", head: "↳ School Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-10", head: "↳ CEO's Home Sui Gas Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-11", head: "↳ CEO's Home Water/WASA Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-12", head: "↳ CEO's Home Internet Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-13", head: "↳ CEO Home Maintenance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-14", head: "↳ CEO's Credit Cards Payments", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-15", head: "↳ Other Buying for CEO Home", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-16", head: "↳ Withheld Tax on CEO Home Rent", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-2", head: "↳ Funds Issued for CEO/Director's Instructions", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-3", head: "↳ CEO Home Grocery Bills", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-4", head: "↳ CEO Home Rent", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-5", head: "↳ Online Parcel Payments", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-6", head: "↳ Fuel for CEO's Car", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-7", head: "↳ CEO's Car Maintenance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-8", head: "↳ Askari Colony Management Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20101-9", head: "↳ CEO's Home Electricity Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      },
      {
        code: "20102", head: "→ Owner's Contributions", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "20103", head: "→ Common Stock", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "20104", head: "→ Preferred Stock", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "20105", head: "→ Reserves", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "20105-1", head: "↳ General Reserve", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20105-2", head: "↳ Revaluation Reserve", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20105-3", head: "↳ Spare Head 1", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      },
      {
        code: "20106", head: "→ Retained Earnings", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "20106-1", head: "↳ Prior Year Retained Earnings", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "20106-2", head: "↳ Current Year Retained Earnings", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
        ]
      },
      {
        code: "20107", head: "→ TEST HEAD", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      }
    ]
  }
];

const REVENUE_DATA = [
  {
    sno: "1", code: "25100", head: "Yes Head", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "25101", head: "→ Test HEad1", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "25101-1", head: "↳ Test HEad112", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "25102", head: "→ DRM TEst HEad", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "25102-1", head: "↳ tranction head", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "2", code: "25200", head: "DRM MAin", badge: "bg-[#20c997]", isMain: true,
    children: []
  }
];

const EXPENSES_DATA = [
  {
    sno: "1", code: "30100", head: "Administrative Expenses", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30101", head: "→ Printing and Stationary", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30101-1", head: "↳ Printing and Stationary", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30101-2", head: "↳ Photocopiers & Printers", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30101-3", head: "↳ Printer Ink & Toner", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30102", head: "→ Rent Expense", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30102-1", head: "↳ Office Rent", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30102-2", head: "↳ Withheld Tax on Office Rent", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30103", head: "→ Electrical and Plumbing Repair", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30103-1", head: "↳ Electrical Repair Work", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30103-2", head: "↳ Plumbing Repair Work", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30104", head: "→ General Repair and Maintenance", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30104-1", head: "↳ General Repair and Maintenance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30105", head: "→ Miscellaneous Office Equipment", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30105-1", head: "↳ Small Office Equipment", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30106", head: "→ Office Repairs", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30106-1", head: "↳ Office Maintenance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30107", head: "→ Office Security", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30107-1", head: "↳ Security Guards", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30107-2", head: "↳ Fire Safety Equipment", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30108", head: "→ Office Supplies", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30108-1", head: "↳ Newspapers", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30108-2", head: "↳ Office Grocery", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30109", head: "→ Subscriptions & Dues", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30109-1", head: "↳ Magazines & Industry Subscriptions", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30110", head: "→ Utilities (Electricity, Water, Sui Gas)", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30110-1", head: "↳ Electricity Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30110-2", head: "↳ Sui Gas Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30110-3", head: "↳ Water/WASA Bill", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30111", head: "→ Cleaning Services", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30111-1", head: "↳ Cleaning Services", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30112", head: "→ Diesel for Generator", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30112-1", head: "↳ Diesel for Generator", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30113", head: "→ Government Fees", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30113-1", head: "↳ Government Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30114", head: "→ Medical Expenses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30114-1", head: "↳ Medical Expenses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30115", head: "→ Business Development", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30115-1", head: "↳ Business Development Expenses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "2", code: "30200", head: "Marketing & Advertising", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30201", head: "→ Media Printing", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: []
      },
      {
        code: "30202", head: "→ Social Media Marketing", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30202-1", head: "↳ Social Media Marketing", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30202-2", head: "↳ Website Development", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30202-3", head: "↳ Influencer Marketing", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30202-4", head: "↳ Pay-per-Click Advertising", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30203", head: "→ Printing of Marketing Material", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30203-1", head: "↳ Printing of Marketing Material", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30203-2", head: "↳ Media Printing", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30204", head: "→ Trade Shows", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30204-1", head: "↳ Trade Shows", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30205", head: "→ Outdoor Media Expenses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30205-1", head: "↳ Outdoor Media Expenses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "3", code: "30300", head: "Travel & Entertainment", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30301", head: "→ Travel Expenses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30301-1", head: "↳ Local Travel Expenses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30301-2", head: "↳ Int. Travel Expenses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30302", head: "→ Clients Entertainment", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30302-1", head: "↳ Refreshments for Clients/Vendors", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30303", head: "→ Conferences & Seminars", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30303-1", head: "↳ Indoor Office Events", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30304", head: "→ Hotel Accommodations", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30304-1", head: "↳ Local Hotel Accommodations", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30304-2", head: "↳ Int. Hotel Accommodations", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30305", head: "→ Employees Entertainment", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30305-1", head: "↳ Refreshments for Employees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "4", code: "30400", head: "Communication", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30401", head: "→ Internet", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30401-1", head: "↳ Internet", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30402", head: "→ Mobile Phone", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30402-1", head: "↳ Mobile Phone", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30403", head: "→ Telephone/PTCL", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30403-1", head: "↳ Telephone/PTCL", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30404", head: "→ Postage & Courier", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30404-1", head: "↳ Postage & Courier", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "5", code: "30500", head: "Employee Salaries & Benefits", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30501", head: "→ Commissions and Rewards", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30501-1", head: "↳ Commission by Sales Target", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-2", head: "↳ Commission by Sales Volume", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-3", head: "↳ Commission for Special Sales", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-4", head: "↳ Monthly Target Incentive", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-5", head: "↳ Referral Sales Commission", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-6", head: "↳ Quarterly Target Incentive", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30501-7", head: "↳ Service Sales Commission", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30502", head: "→ Employee Bonuses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30502-1", head: "↳ Annual Bonuses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30502-2", head: "↳ Other Incentives", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30502-3", head: "↳ Performance Bonuses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30503", head: "→ Employee Insurance", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30503-1", head: "↳ Healthcare & Insurance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30504", head: "→ Employee Provident Fund", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30504-1", head: "↳ Employee Provident Fund (EPF)", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30505", head: "→ Leaves Encashment", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30505-1", head: "↳ Attendance Bonuses", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30506", head: "→ Medical Allowance for Employees", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30506-1", head: "↳ Medical Allowance", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30507", head: "→ PESSI", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30507-1", head: "↳ Social Security Contributions", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30508", head: "→ Salaries & Wages", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30508-1", head: "↳ Holiday Overtime", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30508-2", head: "↳ Salaries & Wages", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30508-3", head: "↳ Weekday Overtime", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30509", head: "→ Staff Training And Development", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30509-1", head: "↳ Training & Development", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30510", head: "→ TA / DA for Employees", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30510-1", head: "↳ TA/DA Paid", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "6", code: "30600", head: "Technology Expenses", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30601", head: "→ Cloud Services", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30601-1", head: "↳ Cloud Based Services (i.e. Google, Microsoft 365)", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30601-2", head: "↳ Software Subscription", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30602", head: "→ Software Licenses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30602-1", head: "↳ License & Application", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30603", head: "→ IT Support Services", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30603-1", head: "↳ IT Support Services", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30604", head: "→ Website Hosting", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30604-1", head: "↳ Website Hosting", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "7", code: "30700", head: "Other Expenses", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30701", head: "→ Miscellaneous Expenses", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30701-1", head: "↳ Donations", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30701-2", head: "↳ Fines and Penalties", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30701-3", head: "↳ Loss on Foreign Currency Transactions", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30701-4", head: "↳ Cash back to subscribers/clients", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30701-5", head: "↳ Other Payments", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "8", code: "30800", head: "Professional Services", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30801", head: "→ Accounting Fees", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30801-1", head: "↳ Accounting & Audit Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30802", head: "→ Consulting Services", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30802-1", head: "↳ Attorneys", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" },
          { code: "30802-2", head: "↳ Tax & Consultancy Fees", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "9", code: "30900", head: "Depreciation & Amortization", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "30901", head: "→ Depreciation - Office Furniture", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30901-1", head: "↳ Depreciation - Office Furniture", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30902", head: "→ Depreciation - Equipment", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30902-1", head: "↳ Depreciation - Equipment", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30903", head: "→ Depreciation - Machinery", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30903-1", head: "↳ Depreciation - Machinery", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      },
      {
        code: "30904", head: "→ Depreciation - Computer", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "30904-1", head: "↳ Depreciation - Computer", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  },
  {
    sno: "10", code: "31000", head: "Financial Expenses", badge: "bg-[#20c997]", isMain: true,
    children: [
      {
        code: "31001", head: "→ Bank Service Charges", badge: "bg-[#66b3ff]", lineColor: "border-[#66b3ff]",
        children: [
          { code: "31001-1", head: "↳ Charges for Cash Withdrawal", badge: "bg-[#20c997]", lineColor: "border-[#20c997]" }
        ]
      }
    ]
  }
];

function getSuggestedRange(parentCode: string) {
  if (parentCode.includes('-')) {
    return `${parentCode}-1 - ${parentCode}-99`;
  }
  if (parentCode.endsWith("00")) {
    const base = parseInt(parentCode, 10);
    return `${base + 1} - ${base + 99}`;
  }
  return `${parentCode}-1 - ${parentCode}-99`;
}

function AccountTreeRenderer({ data, onAddChild }: { data: any[], onAddChild?: (parentName: string, range: string) => void }) {
  return (
    <div className="w-full text-xs">
      <div className="grid grid-cols-[30px_60px_1fr_50px] gap-2 font-semibold text-slate-600 dark:text-slate-300 py-2 border-b bg-slate-50 dark:bg-zinc-800 px-2 mb-2">
        <div className="text-center">#</div>
        <div>Code</div>
        <div>Head</div>
        <div className="text-right pr-2">Action</div>
      </div>
      <div className="space-y-4 px-2 pb-2">
        {data.map((mainItem: any) => (
          <div key={mainItem.code} className="border-b border-dashed border-slate-200 dark:border-zinc-800 pb-4 last:border-0 last:pb-0">
            <div className="grid grid-cols-[30px_60px_1fr_50px] gap-2 items-start mb-2">
              <div className="flex justify-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-500 text-white text-[10px] font-bold shadow-sm">
                  {mainItem.sno}
                </span>
              </div>
              <div>
                <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[10px] font-bold ${mainItem.badge}`}>
                  {mainItem.code}
                </span>
              </div>
              <div className="font-bold text-slate-800 dark:text-rose-100 text-[12px] leading-tight mt-0.5">
                {mainItem.head}
              </div>
              <div className="flex justify-end gap-1">
                <Button size="icon" className="h-5 w-5 bg-[#00a65a] hover:bg-[#008d4c] text-white rounded shrink-0" onClick={(e) => { e.stopPropagation(); onAddChild?.(`${mainItem.code} → ${mainItem.head}`, getSuggestedRange(mainItem.code)); }}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button size="icon" className="h-5 w-5 bg-[#f0ad4e] hover:bg-[#ec971f] text-white rounded shrink-0">
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {mainItem.children && mainItem.children.length > 0 && (
              <div className="ml-[98px] pl-2 border-l border-[#66b3ff] space-y-2 relative mt-1 py-1">
                {mainItem.children.map((subItem: any) => (
                  <div key={subItem.code} className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 pt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[9px] font-bold ${subItem.badge} shrink-0`}>
                          {subItem.code}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px] leading-tight">
                          {subItem.head}
                        </span>
                      </div>
                      <div className="flex justify-end gap-1 shrink-0">
                        <Button size="icon" className="h-5 w-5 bg-[#00a65a] hover:bg-[#008d4c] text-white rounded shrink-0" onClick={(e) => { e.stopPropagation(); onAddChild?.(`${subItem.code} → ${subItem.head.replace('→ ', '')}`, getSuggestedRange(subItem.code)); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" className="h-5 w-5 bg-[#f0ad4e] hover:bg-[#ec971f] text-white rounded shrink-0">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {subItem.children && subItem.children.length > 0 && (
                      <div className="ml-4 pl-2 border-l border-[#20c997] space-y-1 mt-1 pt-1 pb-1 relative">
                        {subItem.children.map((childItem: any) => (
                          <div key={childItem.code} className="flex items-start justify-between gap-2 relative">
                            <div className="flex items-start gap-1.5 pt-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[9px] font-bold ${childItem.badge} shrink-0`}>
                                {childItem.code}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-[10px] leading-tight mt-0.5">
                                {childItem.head}
                              </span>
                            </div>
                            <div className="flex justify-end gap-1 shrink-0">
                              <Button size="icon" className="h-4 w-4 bg-[#f0ad4e] hover:bg-[#ec971f] text-white rounded-[3px] shrink-0">
                                <Edit className="h-[10px] w-[10px]" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "",
    type: "",
    description: "",
  });

  const [childFormData, setChildFormData] = useState({
    parentHead: "",
    name: "",
    description: "",
    codeRange: ""
  });

  const openChildDialog = (parentHead: string, codeRange: string) => {
    setChildFormData({
      parentHead,
      name: "",
      description: "",
      codeRange
    });
    setChildDialogOpen(true);
  };

  const { data: accountHeads = [], isLoading } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/office/account-heads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Account head added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add account head", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/office/account-heads/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      toast({ title: "Deleted", description: "Account head deleted" });
    },
  });

  const resetForm = () => {
    setFormData({ code: "", name: "", category: "", type: "", description: "" });
  };

  const openAddDialog = (category: string) => {
    setSelectedCategory(category);
    setFormData({ code: "", name: "", category, type: "", description: "" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name || !formData.category || !formData.type) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const accountHeadsList = Array.isArray(accountHeads) ? accountHeads : [];
  const getAccountsByCategory = (category: string) => {
    return accountHeadsList.filter((a) => a.category === category);
  };

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide" data-testid="text-page-title">
            Chart of Account
          </h1>
          <Button 
            onClick={() => setDialogOpen(true)} 
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            data-testid="button-add-account"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Account Head
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <Card className="border-none shadow-sm shadow-slate-200 dark:shadow-none dark:bg-zinc-900 mt-4">
            <CardContent className="p-6">
              <Accordion type="multiple" defaultValue={[]} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CATEGORIES.map((cat) => {
                  const accounts = getAccountsByCategory(cat.value);
                  return (
                    <AccordionItem key={cat.value} value={cat.value} className="border border-rose-200 shadow-sm bg-rose-100 dark:bg-rose-950 dark:border-rose-900 h-fit rounded-sm overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline relative group" data-testid={`accordion-${cat.value}`}>
                        <div className="flex items-center w-full justify-between pr-4">
                          <span className="font-bold text-sm text-slate-800 dark:text-rose-100">
                            ({cat.range}) {cat.label}
                          </span>
                          <Button
                            size="icon"
                            className="h-6 w-6 bg-[#00a65a] hover:bg-[#008d4c] text-white rounded shrink-0 mr-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openChildDialog(`(${cat.range}) ${cat.label}`, cat.range);
                            }}
                            data-testid={`button-add-${cat.value}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </AccordionTrigger>
                  <AccordionContent className="bg-white dark:bg-zinc-950 mt-2 border-t pt-2">
                    {cat.value === "Assets" ? (
                      <div className="w-full overflow-x-auto">
                        <AccountTreeRenderer 
                          data={[
                            ...ASSETS_DATA,
                            ...accountHeadsList.filter(a => a.category === "Assets").map((a, i) => ({ sno: `*`, code: a.code, head: a.name, badge: "bg-[#00a65a]", isMain: true, children: [] }))
                          ]} 
                          onAddChild={openChildDialog} 
                        />
                      </div>
                    ) : cat.value === "Liabilities" ? (
                      <div className="w-full overflow-x-auto">
                        <AccountTreeRenderer 
                          data={[
                            ...LIABILITIES_DATA,
                            ...accountHeadsList.filter(a => a.category === "Liabilities").map((a, i) => ({ sno: `*`, code: a.code, head: a.name, badge: "bg-[#00a65a]", isMain: true, children: [] }))
                          ]} 
                          onAddChild={openChildDialog} 
                        />
                      </div>
                    ) : cat.value === "OwnerEquity" ? (
                      <div className="w-full overflow-x-auto">
                        <AccountTreeRenderer 
                          data={[
                            ...OWNER_EQUITY_DATA,
                            ...accountHeadsList.filter(a => a.category === "OwnerEquity").map((a, i) => ({ sno: `*`, code: a.code, head: a.name, badge: "bg-[#00a65a]", isMain: true, children: [] }))
                          ]} 
                          onAddChild={openChildDialog} 
                        />
                      </div>
                    ) : cat.value === "Revenue" ? (
                      <div className="w-full overflow-x-auto">
                        <AccountTreeRenderer 
                          data={[
                            ...REVENUE_DATA,
                            ...accountHeadsList.filter(a => a.category === "Revenue").map((a, i) => ({ sno: `*`, code: a.code, head: a.name, badge: "bg-[#00a65a]", isMain: true, children: [] }))
                          ]} 
                          onAddChild={openChildDialog} 
                        />
                      </div>
                    ) : cat.value === "Expenses" ? (
                      <div className="w-full overflow-x-auto">
                        <AccountTreeRenderer 
                          data={[
                            ...EXPENSES_DATA,
                            ...accountHeadsList.filter(a => a.category === "Expenses").map((a, i) => ({ sno: `*`, code: a.code, head: a.name, badge: "bg-[#00a65a]", isMain: true, children: [] }))
                          ]} 
                          onAddChild={openChildDialog} 
                        />
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 px-6 pt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAddDialog(cat.value)}
                            data-testid={`button-add-${cat.value}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add to {cat.label}
                          </Button>
                        </div>
                        {accounts.length === 0 ? (
                          <p className="text-muted-foreground text-sm px-6">No accounts in this category</p>
                        ) : (
                          <div className="px-6">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16">S.No</TableHead>
                                  <TableHead className="w-32">Code</TableHead>
                                  <TableHead>Account Head</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead className="w-20">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {accounts.map((account, index) => (
                                  <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-mono">{account.code}</TableCell>
                                    <TableCell className="font-medium">{account.name}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{account.type}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteMutation.mutate(account.id)}
                                        data-testid={`button-delete-${account.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-600">Add Parent Account Head</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Category <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => {
                    // Auto-generate a dummy next code based on category for UI purposes
                    const catMap: Record<string, string> = { Assets: "10001", Liabilities: "20001", OwnerEquity: "30001", Revenue: "40001", Expenses: "50001" };
                    setFormData(prev => ({ ...prev, category: v, type: "", code: catMap[v] || "" }));
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Head Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter parent head name"
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Code</Label>
                <div className="bg-[#e6f4fd] text-[#20c997] font-bold py-2.5 px-4 rounded-md border border-[#bce8f1]">
                  {formData.category ? `Next Account Code: ${formData.code}` : "Select a category first"}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Type <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                  disabled={!formData.category}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.category && ACCOUNT_TYPES[formData.category]?.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none h-24"
                  data-testid="input-description"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" className="bg-[#787f97] hover:bg-[#6b7188] text-white border-0" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={handleSubmit} disabled={createMutation.isPending || !formData.code} data-testid="button-submit">
                <Save className="h-4 w-4 mr-1.5" />
                {createMutation.isPending ? "Saving..." : "Save Parent Head"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={childDialogOpen} onOpenChange={setChildDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-600">Add Child Head</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Parent Head</Label>
                <Input 
                  disabled 
                  value={childFormData.parentHead} 
                  className="bg-slate-50 text-slate-500 font-medium border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Child Head Name <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="Enter child head name"
                  value={childFormData.name}
                  onChange={(e) => setChildFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Code Range</Label>
                <div className="bg-[#e6f4fd] text-[#20c997] font-bold py-2.5 px-4 rounded-md border border-[#bce8f1]">
                  ({childFormData.codeRange})
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Description</Label>
                <textarea 
                  placeholder="Enter description (optional)" 
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none h-24"
                  value={childFormData.description}
                  onChange={(e) => setChildFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" className="bg-[#787f97] hover:bg-[#6b7188] text-white border-0" onClick={() => setChildDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={() => {
                toast({ title: "Success", description: "Child head saved (UI only)" });
                setChildDialogOpen(false);
              }}>
                <Save className="h-4 w-4 mr-2" /> Save Child Head
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
