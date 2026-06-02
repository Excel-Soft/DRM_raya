import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Cheque } from "@shared/schema";

function numberToWords(num: number): string {
  if (!num || isNaN(num) || num === 0) return "";
  const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " million" + (n % 1000000 !== 0 ? " " + convert(n % 1000000) : "");
    return "";
  };
  return convert(num);
}

export default function ChequeSystem() {
  const { toast } = useToast();

  const [chequeDigits, setChequeDigits] = useState<string[]>(Array(8).fill(""));
  const [formData, setFormData] = useState({
    companyName: "",
    amount: "",
    chequeDate: "",
    notes: "",
    chequeType: "",
  });

  const { data: cheques = [], isLoading } = useQuery<Cheque[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: () => fetch(`/api/office/cheques`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/office/cheques", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/cheques"] });
      setFormData({
        companyName: "",
        amount: "",
        chequeDate: "",
        notes: "",
        chequeType: "",
      });
      setChequeDigits(Array(8).fill(""));
      toast({ title: "Success", description: "Cheque added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add cheque", variant: "destructive" });
    },
  });

  const handleDigitChange = (index: number, value: string) => {
    const newDigits = [...chequeDigits];
    newDigits[index] = value.slice(-1); // Only keep the last character
    setChequeDigits(newDigits);

    // Auto focus next input
    if (value && index < 7) {
      const nextInput = document.getElementById(`cheque-digit-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
  };

  const handleSubmit = () => {
    const chequeNumber = chequeDigits.join("");
    if (!chequeNumber || !formData.amount || !formData.companyName || !formData.chequeDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    
    // We add bankName as Askari Bank explicitly since it's an Askari Cheque UI
    createMutation.mutate({
      ...formData,
      chequeNumber,
      bankName: "Askari Bank",
      currency: "PKR",
    });
  };

  const chequesList = Array.isArray(cheques) ? cheques : [];
  
  // Calculate real unused/used totals
  const unusedPkr = chequesList
    .filter(c => c.status === "Pending")
    .reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0)
    .toLocaleString("en-US", { minimumFractionDigits: 2 });

  const usedPkr = chequesList
    .filter(c => c.status !== "Pending")
    .reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0)
    .toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950 h-full">
      <div className="p-6">
        {/* Header summary */}
        <div className="mb-6 font-bold text-sm tracking-wide">
          <span className="text-gray-600 dark:text-gray-300">CREATE CHEQUE UN-USED PKR: </span>
          <span className="text-red-500">{unusedPkr}</span>
          <span className="text-gray-600 dark:text-gray-300 ml-4">CHEQUE USED PKR: </span>
          <span className="text-emerald-500">{usedPkr}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel: Form */}
          <div className="w-full lg:w-[400px] flex-shrink-0">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-md p-5 shadow-sm">
              <h2 className="text-md font-semibold mb-5 text-gray-700 dark:text-gray-200">Askari Bank Cheque</h2>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Payee Name:</Label>
                  <Input 
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Amount:</Label>
                  <Input 
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Cheque Number:</Label>
                  <div className="flex justify-between gap-1">
                    {chequeDigits.map((digit, i) => (
                      <Input
                        key={i}
                        id={`cheque-digit-${i}`}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        className="h-10 w-full text-center p-0 text-lg font-medium focus-visible:ring-1 focus-visible:ring-emerald-500"
                        maxLength={1}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Cheque Date:</Label>
                  <Input 
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Cheque Type:</Label>
                  <Select value={formData.chequeType} onValueChange={(v) => setFormData({ ...formData, chequeType: v })}>
                    <SelectTrigger className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cross">Cross</SelectItem>
                      <SelectItem value="Bearer">Bearer</SelectItem>
                      <SelectItem value="Order">Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-normal">Comments:</Label>
                  <Textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter comment"
                    className="resize-none h-20 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <Button 
                  onClick={handleSubmit} 
                  disabled={createMutation.isPending}
                  className="w-full bg-[#00a65a] hover:bg-[#008d4c] text-white h-10 mt-2"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel: Cheque List */}
          <div className="flex-1 flex flex-col gap-6">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading cheques...</div>
            ) : chequesList.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-white border border-gray-100 rounded-md">
                No cheques generated yet.
              </div>
            ) : (
              chequesList.map((cheque) => (
                <div key={cheque.id} className="relative w-full max-w-[850px] bg-white border border-gray-300 shadow-sm overflow-hidden flex flex-col font-sans" style={{ minHeight: '320px' }}>
                  
                  {/* Ribbon FOR DOLLAR */}
                  <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden z-10 pointer-events-none">
                    <div className="absolute top-5 -left-12 w-48 bg-[#d0eaf9] border-y border-blue-200 text-[#0f5c9c] text-[10px] font-bold py-1 text-center -rotate-45 shadow-sm">
                      FOR DOLLAR
                    </div>
                  </div>

                  {/* Top Half (White Background) */}
                  <div className="p-6 pb-2 relative z-0 flex-1">
                    <div className="flex justify-between items-start mb-6 pl-14">
                      {/* Logo Area */}
                      <div className="flex items-center">
                        <div className="flex flex-col">
                          <div className="flex items-baseline">
                            <span className="text-[#005a9c] font-bold text-[28px] tracking-tight leading-none">askari</span>
                            <span className="text-gray-500 font-normal text-[28px] tracking-tight leading-none">bank</span>
                          </div>
                          <span className="text-gray-400 text-[8px] font-bold self-end mr-1 uppercase tracking-widest leading-none mt-0.5">Limited</span>
                        </div>
                        {/* Logo Diamond */}
                        <div className="ml-2 w-6 h-6 bg-[#005a9c] transform rotate-45 flex items-center justify-center relative overflow-hidden">
                           <div className="w-3 h-3 border border-white transform rotate-45 absolute -top-1 -left-1"></div>
                           <div className="w-3 h-3 border border-white transform rotate-45 absolute -bottom-1 -right-1"></div>
                        </div>
                      </div>
                      
                      {/* Cheque No */}
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-bold text-sm leading-tight text-right">Cheque<br/>No</span>
                        <div className="flex bg-[#d0eaf9] p-1.5 gap-0.5">
                          {(cheque.chequeNumber || "").padEnd(8, "0").split("").map((digit: string, i: number) => (
                            <div key={i} className="w-[18px] text-center font-mono text-[17px] font-semibold text-gray-800">
                              {digit}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mt-8 mb-2">
                      {/* Branch Info */}
                      <div className="text-[13px] text-gray-700 font-medium uppercase leading-[1.3]">
                        <strong>ASKARI BANK LIMITED</strong><br/>
                        IBB DHA KARACHI JAMI COMMERCIAL PHASE VII DHA KHI
                      </div>
                      
                      {/* Date */}
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-bold text-sm">Date</span>
                        <div className="flex gap-0.5 bg-white">
                          {format(new Date(cheque.chequeDate), "yyyyMMdd").split("").map((digit: string, i: number) => (
                            <div key={i} className="w-[18px] h-7 flex items-center justify-center border border-gray-300 font-mono text-[16px] text-gray-800">
                              {digit}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Half (Light Blue Background) */}
                  <div className="bg-[#d0eaf9] px-6 pt-5 pb-4 flex flex-col justify-between flex-1 relative z-0">
                    
                    <div>
                      {/* Pay */}
                      <div className="flex items-end mb-4">
                        <span className="text-gray-400 w-16 text-sm font-bold">Pay</span>
                        <div className="flex-1 border-b border-gray-400 pb-0.5 relative">
                          <span className="text-gray-700 text-[15px] pl-2 block truncate pr-4">
                            {cheque.companyName}
                          </span>
                        </div>
                      </div>
                      
                      {/* Rupees */}
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-end mb-4">
                            <span className="text-gray-400 w-16 text-sm font-bold">Rupess</span>
                            <div className="flex-1 border-b border-gray-400 pb-0.5">
                              <span className="text-gray-700 text-[15px] pl-2 capitalize block truncate">
                                {numberToWords(parseFloat(cheque.amount || "0"))}
                              </span>
                            </div>
                          </div>
                          {/* Extra empty line */}
                          <div className="flex items-end mb-4">
                             <span className="text-transparent w-16 text-sm font-bold">-</span>
                             <div className="flex-1 border-b border-gray-400"></div>
                          </div>
                        </div>
                        
                        {/* PKR Box */}
                        <div className="w-[240px] border border-gray-400 bg-transparent flex items-center h-[38px] px-3 gap-2 mt-[-10px]">
                          <span className="text-gray-400 text-sm font-bold">PKR</span>
                          <span className="text-gray-800 font-semibold text-[17px]">
                            {parseFloat(cheque.amount || "0").toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer text */}
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-gray-400 text-[13px] font-bold">Please do not write bellow this line</span>
                      <div className="w-56 text-center pt-1 relative">
                        <span className="text-gray-600 text-[11px] absolute -top-3.5 left-0 right-0">
                          {cheque.status === 'Pending' ? 'not used' : 'used'}
                        </span>
                        <div className="border-t border-gray-400"></div>
                        <span className="text-gray-400 text-[13px] mt-0.5 block">Signature</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

