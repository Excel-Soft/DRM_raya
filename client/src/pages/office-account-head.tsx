import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, PlusCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock data to match the user's screenshot
const CATEGORIES_DATA = [
  {
    title: "() OFFICE EXPENSES",
    data: [
      {
        sno: "1", code: "0", head: "Rent & Utilities", type: "Expenses",
        children: [
          { code: "5001", name: "Office Rent" },
          { code: "5002", name: "Electricity Bill" },
          { code: "5003", name: "Water & Gas Charges" },
          { code: "5004", name: "Security Services" },
          { code: "5005", name: "Credit card fee" },
          { code: "5006", name: "Sign Board" },
          { code: "5007", name: "Home Rent" },
        ]
      },
      {
        sno: "2", code: "5010", head: "Office Supplies", type: "Expenses",
        children: [
          { code: "5011", name: "Stationery (Pens, Paper, Files)" },
          { code: "5012", name: "Printer Ink & Toner" },
          { code: "5013", name: "Cleaning & Sanitary Supplies" },
          { code: "5014", name: "Generator Diesel" },
        ]
      },
      {
        sno: "3", code: "5020", head: "Communication & Internet", type: "Expenses",
        children: [
          { code: "5021", name: "Telephone & Mobile Bills" },
          { code: "5022", name: "Internet Subscription" },
          { code: "5023", name: "Postage & Courier" },
          { code: "5024", name: "UAN Bill payment" },
          { code: "5025", name: "U phone Bill payment" },
        ]
      },
      {
        sno: "4", code: "5030", head: "Equipment & Furniture", type: "Expenses",
        children: [
          { code: "5031", name: "Computers & Accessories" },
          { code: "5032", name: "Office Furniture (Chairs, Desks)" },
          { code: "5033", name: "Photocopiers & Printers" },
          { code: "5034", name: "Other Equipment" },
        ]
      },
    ]
  },
  {
    title: "(6000-6999) SALARIES & WAGES",
    data: [
      {
        sno: "1", code: "6000", head: "Regular Salaries",
        children: [
          { code: "6001", name: "Permanent Employees" },
          { code: "6002", name: "Contract Employees" },
          { code: "6003", name: "Temporary Staff" },
          { code: "6004", name: "Advance Loan" },
          { code: "6005", name: "Staff Salaries" },
        ]
      },
      {
        sno: "2", code: "6010", head: "Bonuses & Incentives",
        children: [
          { code: "6011", name: "Performance Bonuses" },
          { code: "6012", name: "Year-End Bonuses" },
          { code: "6013", name: "Festival Allowances" },
        ]
      },
      {
        sno: "3", code: "6020", head: "Deductions",
        children: [
          { code: "6021", name: "Employee Provident Fund (EPF)" },
          { code: "6022", name: "Social Security Contributions" },
          { code: "6023", name: "Tax Deductions" },
        ]
      },
      {
        sno: "4", code: "6030", head: "Employee Benefits",
        children: [
          { code: "6031", name: "Health & Life Insurance" },
          { code: "6032", name: "Pension Contributions" },
          { code: "6033", name: "Training & Development" },
        ]
      },
    ]
  },
  {
    title: "(7000-7999) OVERTIME PAYMENTS",
    data: [
      {
        sno: "1", code: "7000", head: "Regular Overtime",
        children: [
          { code: "7001", name: "Weekday Overtime" },
          { code: "7002", name: "Weekend Overtime" },
        ]
      },
      {
        sno: "2", code: "7010", head: "Special Overtime Rates",
        children: [
          { code: "7011", name: "Holiday Overtime" },
          { code: "7012", name: "Emergency Overtime" },
        ]
      },
    ]
  },
  {
    title: "(8000-8999) SALES COMMISSIONS",
    data: [
      {
        sno: "1", code: "8000", head: "Commission by Sales Volume",
        children: [
          { code: "8001", name: "Product Sales Commission" },
          { code: "8002", name: "Service Sales Commission" },
        ]
      },
      {
        sno: "2", code: "8010", head: "Commission by Sales Target",
        children: [
          { code: "8011", name: "Monthly Target Bonus" },
          { code: "8012", name: "Quarterly Target Bonus" },
        ]
      },
      {
        sno: "3", code: "8020", head: "Commission for Special Sales",
        children: [
          { code: "8021", name: "High-Value Deals" },
          { code: "8022", name: "Referral Sales" },
        ]
      },
    ]
  },
  {
    title: "(0000) TEST",
    data: [
      {
        sno: "1", code: "NaN", head: "Under test 1", type: "Expenses",
        children: []
      }
    ]
  },
  {
    title: "() TRAVEL & ENTERTAINMENT",
    data: []
  },
  {
    title: "() TEST2",
    data: []
  }
];

export default function OfficeAccountHead() {
  const [selectedCategory, setSelectedCategory] = useState<{title: string, code?: string} | null>(null);
  const [isAddMainOpen, setIsAddMainOpen] = useState(false);
  const [isEditCodeOpen, setIsEditCodeOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  const openAddMain = (catTitle: string) => {
    const category = CATEGORIES_DATA.find(c => c.title === catTitle);
    let nextCode = "";
    if (category && category.data.length > 0) {
      const codes = category.data.map(d => parseInt(d.code, 10)).filter(n => !isNaN(n));
      if (codes.length > 0) {
        const maxCode = Math.max(...codes);
        nextCode = (maxCode + 10).toString();
      }
    } else {
      const match = catTitle.match(/^\((\d+)-/);
      if (match) nextCode = match[1];
    }
    setSelectedCategory({ title: catTitle.replace(/^\(.*\)\s*/, ''), code: nextCode });
    setIsAddMainOpen(true);
  };

  const openAddSub = (row: any) => {
    let nextCode = "";
    if (row.children && row.children.length > 0) {
      const codes = row.children.map((c: any) => parseInt(c.code, 10)).filter((n: number) => !isNaN(n));
      if (codes.length > 0) {
        const maxCode = Math.max(...codes);
        nextCode = (maxCode + 1).toString();
      }
    } else {
      const baseCode = parseInt(row.code, 10);
      if (!isNaN(baseCode)) {
        nextCode = (baseCode + 1).toString();
      }
    }
    setSelectedCategory({ title: row.head, code: nextCode });
    setIsAddSubOpen(true);
  };

  const openEditCode = (catTitle: string) => {
    const match = catTitle.match(/^\((.*?)\)/);
    const code = match ? match[1] : "";
    setSelectedCategory({ title: catTitle.replace(/^\(.*\)\s*/, ''), code });
    setIsEditCodeOpen(true);
  };

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-6 space-y-6 min-h-screen">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
            ACCOUNT HEADS
          </h1>
        </div>

        <div>
          <Button 
            className="bg-[#787f97] hover:bg-[#6b7188] text-white"
            onClick={() => setIsAddAccountOpen(true)}
          >
            Add Account Head
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-2 gap-4 items-start">
          {CATEGORIES_DATA.map((cat, i) => (
            <Card key={i} className="border border-slate-200 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
              <CardHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {cat.title}
                </CardTitle>
                <div className="flex gap-2">
                  <Edit 
                    className="h-4 w-4 text-[#f0ad4e] cursor-pointer hover:text-[#ec971f]" 
                    onClick={() => openEditCode(cat.title)}
                  />
                  <PlusCircle 
                    className="h-[18px] w-[18px] text-[#00a65a] cursor-pointer hover:text-[#008d4c]" 
                    strokeWidth={1.5}
                    onClick={() => openAddMain(cat.title)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px] w-full">
                  <div className="min-w-[400px]">
                    <Table>
                      <TableHeader className="bg-[#f8d7da] dark:bg-red-900/20">
                        <TableRow className="hover:bg-[#f8d7da] border-b-0">
                          <TableHead className="w-12 text-slate-800 font-bold py-2 h-auto text-xs">S.No</TableHead>
                          <TableHead className="w-16 text-slate-800 font-bold py-2 h-auto text-xs">Code</TableHead>
                          <TableHead className="text-slate-800 font-bold py-2 h-auto text-xs">Head</TableHead>
                          <TableHead className="w-16 text-slate-800 font-bold py-2 h-auto text-xs">Type</TableHead>
                          <TableHead className="w-16 text-slate-800 font-bold py-2 h-auto text-xs text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.data.map((row, rIdx) => (
                          <React.Fragment key={rIdx}>
                            <TableRow className="border-b-0 hover:bg-transparent">
                              <TableCell className="py-1.5 align-top text-xs text-slate-500">{row.sno}</TableCell>
                              <TableCell className="py-1.5 align-top text-xs text-slate-500">{row.code}</TableCell>
                              <TableCell className="py-1.5 align-top text-xs font-semibold text-slate-700">
                                {row.head}
                              </TableCell>
                              <TableCell className="py-1.5 align-top text-xs text-slate-500 text-center font-medium">
                                {(row as any).type || ""}
                              </TableCell>
                              <TableCell className="py-1.5 align-top text-right pr-6">
                                <PlusCircle 
                                  className="h-[18px] w-[18px] text-[#00a65a] inline-block cursor-pointer hover:text-[#008d4c]" 
                                  strokeWidth={1.5} 
                                  onClick={() => openAddSub(row)}
                                />
                              </TableCell>
                            </TableRow>
                            {row.children.map((child, cIdx) => (
                              <TableRow key={`${rIdx}-${cIdx}`} className="border-b-0 hover:bg-slate-50">
                                <TableCell className="py-1"></TableCell>
                                <TableCell className="py-1"></TableCell>
                                <TableCell className="py-1 text-xs">
                                  <div className="flex items-center gap-1 pl-4">
                                    <span className="text-[#00a65a] font-medium">{child.code}</span>
                                    <span className="text-[#00a65a] text-[10px]">↳</span>
                                    <span className="text-slate-500 font-medium">{child.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1"></TableCell>
                                <TableCell className="py-1"></TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between mt-12 text-[12px] text-slate-400 font-sans">
          <div>2026 © Web Excels.</div>
          <div>Design & Develop by Webb</div>
        </div>

        {/* Modals */}
        <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium text-slate-700">Add Account Head</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Head:</Label>
                <Input placeholder="Account Head" className="text-slate-600" />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="secondary" onClick={() => setIsAddAccountOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">
                Close
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={() => setIsAddAccountOpen(false)}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddMainOpen} onOpenChange={setIsAddMainOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium text-slate-700">Add Main Heads</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Head:</Label>
                <Input value={selectedCategory?.title || ""} readOnly className="bg-slate-50 text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Main Head:</Label>
                <Input placeholder="Add Main head" className="text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Code:</Label>
                <Input value={selectedCategory?.code || ""} readOnly className="bg-slate-50 text-slate-600" />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="secondary" onClick={() => setIsAddMainOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">
                Close
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={() => setIsAddMainOpen(false)}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddSubOpen} onOpenChange={setIsAddSubOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium text-slate-700">Add Sub Head</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Head:</Label>
                <Input value={selectedCategory?.title || ""} readOnly className="bg-slate-50 text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Main Head:</Label>
                <Input placeholder="Add Main head" className="text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Code:</Label>
                <Input value={selectedCategory?.code || ""} readOnly className="bg-slate-50 text-slate-600" />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="secondary" onClick={() => setIsAddSubOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">
                Close
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={() => setIsAddSubOpen(false)}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditCodeOpen} onOpenChange={setIsEditCodeOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium text-slate-700">Add Head Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Account Head:</Label>
                <Input value={selectedCategory?.title || ""} readOnly className="bg-slate-50 text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Main Head Code:</Label>
                <Input value={selectedCategory?.code || ""} className="text-slate-600" readOnly={false} onChange={(e) => setSelectedCategory(prev => prev ? {...prev, code: e.target.value} : null)} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-medium">Type:</Label>
                <Select defaultValue="select">
                  <SelectTrigger className="w-full text-slate-600">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="assets">Assets</SelectItem>
                    <SelectItem value="liabilities">Liabilities</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expenses">Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="secondary" onClick={() => setIsEditCodeOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">
                Close
              </Button>
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white" onClick={() => setIsEditCodeOpen(false)}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </ScrollArea>
  );
}
