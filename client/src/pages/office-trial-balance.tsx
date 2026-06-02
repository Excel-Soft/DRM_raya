import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function MultiSelect({ options, selected, onChange }: { options: {label: string, value: string}[], selected: string[], onChange: (vals: string[]) => void }) {
  const toggle = (val: string) => {
    if (val === "all") {
      onChange([]);
    } else {
      const isSelected = selected.includes(val);
      if (isSelected) {
        onChange(selected.filter(v => v !== val));
      } else {
        onChange([...selected, val]);
      }
    }
  };

  const remove = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== val));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex min-h-[38px] w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer">
          <div className="flex flex-wrap gap-1.5 items-center flex-1">
            {selected.length === 0 ? (
              <span className="text-slate-500">All</span>
            ) : (
              selected.map(val => {
                const opt = options.find(o => o.value === val);
                return (
                  <span key={val} className="flex items-center gap-1 bg-[#f1f5f9] text-slate-700 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">
                    <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-900 transition-colors" onClick={(e) => remove(e, val)} />
                    {opt?.label || val}
                  </span>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {selected.length > 0 && (
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-900 cursor-pointer transition-colors" onClick={clearAll} />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto" align="start">
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onCheckedChange={() => toggle("all")}
          className="font-medium"
        >
          All
        </DropdownMenuCheckboxItem>
        {options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OfficeTrialBalance() {
  const [accountingHeads, setAccountingHeads] = useState<string[]>([]);
  const [parentHeads, setParentHeads] = useState<string[]>([]);
  const [childHeads, setChildHeads] = useState<string[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: dbAccountHeads = [] } = useQuery<any[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const handleGenerate = () => {
    console.log("Generating report with filters:", {
      accountingHeads, parentHeads, childHeads, offices, startDate, endDate
    });
  };

  const ACCOUNTING_HEAD_OPTIONS = [
    { label: "10000 - Assets", value: "Assets" },
    { label: "15000 - Liabilities", value: "Liabilities" },
    { label: "20000 - Owner Equity", value: "OwnerEquity" },
    { label: "25000 - Revenue", value: "Revenue" },
    { label: "30000 - Expenses", value: "Expenses" }
  ];

  const filteredParents = dbAccountHeads.filter(a => accountingHeads.length === 0 || accountingHeads.includes(a.category));
  const PARENT_HEAD_OPTIONS = filteredParents.map(a => ({ label: `${a.code} - ${a.name}`, value: a.id }));

  const CHILD_HEAD_OPTIONS = [
    { label: "10101 - Cash & Cash Equivalents", value: "10101" },
    { label: "10102 - Accounts Receivable", value: "10102" },
    { label: "10103 - Advances to Employees", value: "10103" },
    { label: "10201 - Property, Plant & Equipment (PP&E)", value: "10201" },
    { label: "10202 - Office Furniture & Fixtures", value: "10202" },
    { label: "15101 - Accounts Payable", value: "15101" },
  ];

  const OFFICE_OPTIONS = [
    { label: "Karachi", value: "karachi" },
    { label: "Lahore-Raya", value: "lahore-raya" },
    { label: "Lahore-GulBerg", value: "lahore-gulberg" },
    { label: "Sialkot-Welc", value: "sialkot-welc" },
    { label: "Sialkot-Webexcels", value: "sialkot-webexcels" },
    { label: "Gujranwala branch", value: "gujranwala" }
  ];

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-zinc-950 min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        <h1 className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
          Trial Balance Report
        </h1>

        <Card className="border-none shadow-sm shadow-slate-200 dark:shadow-none dark:bg-zinc-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Accounting Head <span className="text-rose-500">*</span>
                </Label>
                <MultiSelect 
                  options={ACCOUNTING_HEAD_OPTIONS} 
                  selected={accountingHeads} 
                  onChange={(vals) => {
                    setAccountingHeads(vals);
                    setParentHeads([]); // Reset parent heads when parent category changes
                  }} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Parent Head <span className="text-rose-500">*</span>
                </Label>
                <MultiSelect 
                  options={PARENT_HEAD_OPTIONS} 
                  selected={parentHeads} 
                  onChange={setParentHeads} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Child Head <span className="text-rose-500">*</span>
                </Label>
                <MultiSelect 
                  options={CHILD_HEAD_OPTIONS} 
                  selected={childHeads} 
                  onChange={setChildHeads} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Office <span className="text-rose-500">*</span>
                </Label>
                <MultiSelect 
                  options={OFFICE_OPTIONS} 
                  selected={offices} 
                  onChange={setOffices} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Start Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  End Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div className="lg:col-span-1">
                <Button 
                  onClick={handleGenerate}
                  className="w-full bg-[#00a65a] hover:bg-[#008d4c] text-white transition-colors gap-2 font-medium"
                >
                  <Search className="w-4 h-4" />
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
