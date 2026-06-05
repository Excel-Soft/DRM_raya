import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  ArrowRightLeft, 
  Tag, 
  Search, 
  Plus, 
  Download, 
  ChevronRight, 
  Calendar,
  Clock,
  FileText,
  PlusCircle,
  BarChart3,
  ChevronDown,
  FolderOpen,
  Info,
  X
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


export default function LeadManagerDashboard() {
  const [currentView, setCurrentView] = useState<"dashboard" | "duplication" | "add-customer" | "temporary" | "view-uae" | "add-uae" | "followup-report" | "project-report">("dashboard");
  const [followActiveTab, setFollowActiveTab] = useState<"follow" | "distribute">("follow");
  const [tagSearch, setTagSearch] = useState("");
  const [topSellingFilter, setTopSellingFilter] = useState("TD");
  const [leadSearch, setLeadSearch] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [, setLocation] = useLocation();
  
  const [dupCompany, setDupCompany] = useState("");
  const [dupEmail, setDupEmail] = useState("");
  const [hasStartedCheck, setHasStartedCheck] = useState(false);
  
  const [assigningUserId, setAssigningUserId] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignLeadMutation = useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string, userId: string }) => {
      const res = await apiRequest("PATCH", `/api/sales/leads/${leadId}`, { ownerUserId: userId });
      if (!res.ok) throw new Error("Failed to assign lead");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead distributed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/customers?pageSize=1000"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const [transferModalLeadId, setTransferModalLeadId] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<"user" | "city" | "country">("user");
  const [transferTarget, setTransferTarget] = useState<string>("");

  const transferLeadMutation = useMutation({
    mutationFn: async ({ leadId, type, target }: { leadId: string, type: string, target: string }) => {
      const payload: any = {};
      if (type === "user") payload.ownerUserId = target;
      if (type === "city") Object.assign(payload, { city: target, ownerUserId: null }); 
      if (type === "country") Object.assign(payload, { country: target, ownerUserId: null });

      const res = await apiRequest("PATCH", `/api/sales/leads/${leadId}`, payload);
      if (!res.ok) throw new Error("Failed to transfer lead");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead transferred successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/customers?pageSize=1000"] });
      setTransferModalLeadId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleAssign = (leadId: string) => {
    const userId = assigningUserId[leadId];
    if (!userId) {
       toast({ title: "Please select an executive", variant: "destructive" });
       return;
    }
    assignLeadMutation.mutate({ leadId, userId });
  };

  // --- REAL DATA QUERIES ---
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["/api/customers?pageSize=1000"],
  });
  const allLeads = customersData?.customers || [];
  const filteredLeads = allLeads.filter((lead) => 
    !leadSearch || 
    lead.companyName?.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.country?.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.city?.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.createdBy?.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.ownerUserId?.toLowerCase().includes(leadSearch.toLowerCase())
  );
  
  const { data: activitiesData, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["/api/dashboard/activities"],
  });
  const teamActivities = activitiesData?.data?.rows || [];

  const { data: followupsRes, isLoading: isLoadingFollowups } = useQuery({
    queryKey: ["/api/dashboard/followups?pageSize=50"],
  });
  const expectedClients = followupsRes?.data?.items || [];

  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
  });
  const systemUsers = usersData?.users || [];

  const { data: duplicateData, refetch: checkDuplicates, isFetching: isCheckingDuplicates } = useQuery({
    queryKey: ["/api/check-duplicate", dupCompany, dupEmail],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dupCompany) params.append("company", dupCompany);
      if (dupEmail) params.append("email", dupEmail);
      if (!dupCompany && !dupEmail) return { duplicates: [] };
      const res = await apiRequest("GET", `/api/check-duplicate?${params}`);
      return res.json();
    },
    enabled: false
  });

  const handleCheckDuplication = () => {
    setHasStartedCheck(true);
    checkDuplicates();
  };

  const [addCustomerData, setAddCustomerData] = useState<any>({
    companyName: "", ab: "", country: "", phone: "", city: "", address: "", companyType: "", crmId: "", crmDate: "",
    title: "", personName: "", cnic: "", ntn: "", website: "", email: "", mobile: "", designation: "", comment: "",
    rcLink: "", source: "", status: "", grade: "", businessLine: "", serviceTypes: [] as string[]
  });

  const addCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/customers/add", { ...data, accountName: data.personName, region: data.country || "Other" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Failed to add customer");
      return result;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Customer created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/customers?pageSize=1000"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
      setCurrentView("dashboard");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleAddSubmit = () => {
    addCustomerMutation.mutate(addCustomerData);
  };

  // Calculate Totals for Top Selling
  const totalLeadsCount = allLeads.length;
  const distributedLeadsCount = allLeads.filter((l: any) => l.ownerUserId).length;
  const distributeLeadsCount = allLeads.filter((l: any) => !l.ownerUserId).length;

  const services = [
    "Mobile Responsive Website", "E-Commerce Store", "Alibaba Services", 
    "Domain Registration / Hosting", "Photo Shooting & Video Documen", "SEO & SEM Services",
    "Facebook Fan Page Design", "eBay Store / Posting", "Web Design & Development",
    "Graphic Designing & Logo Desig", "Daraz Store & Product Posting", "Digital Marketing",
    "Product mockups design service", "Designing Services", "CONSULTANCY & CERTIFICATION",
    "Amazon Store / Posting", "Alibaba listing page", "Videography Service",
    "Amazon Product Hunting", "Amazon Product Listing", "Amazon Account Creation",
    "Instagram Page Design Manage", "Instagram ADs", "Facebook ADs",
    "Social Media followers", "Minisite professional", "Android App", "VM",
    "Etsy Store Creation or Posting", "Social Media Account Handling", "AliBaba VA"
  ];

  const businessLines = [
    "Apparel", "Health & Medical", "Sports Wear", "Casual Wear", "Fitness Wear", 
    "Martial Arts Wear", "Safety Wear", "Boxing Equipments", "Leather products", 
    "Weightlifting", "Beach Wear", "Band Uniform", "Gloves Range", "Accessories",
    "Embroidery Badges", "Masonic Regalia", "Horse Riding", "Footballs",
    "Surgical Instruments", "Dental Instruments", "Beauty Instruments"
  ];

  // --- DUPLICATION VIEW ---
  if (currentView === "duplication") {
    return (
      <div className="flex flex-col gap-8 p-8 min-h-screen bg-[#f8fafc] dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b pb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900 uppercase dark:text-zinc-100">Check Duplication</h1>
            <div className="flex items-center gap-2 text-sm text-slate-400">
               <button onClick={() => setCurrentView("dashboard")} className="hover:text-emerald-600">Dashboard</button>
               <ChevronRight className="w-4 h-4" />
               <span className="text-emerald-600 font-bold">Duplication Checker</span>
            </div>
          </div>
          <Button onClick={() => setCurrentView("dashboard")} variant="outline" className="rounded-xl font-bold">Back to Dashboard</Button>
        </div>
        <Card className="border-none shadow-xl rounded-2xl bg-white p-8 dark:bg-zinc-900">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-3"><label className="text-xs font-black text-slate-500 uppercase tracking-widest dark:text-zinc-400">Company Name</label><Input value={dupCompany} onChange={e => setDupCompany(e.target.value)} placeholder="Enter company name Or id" className="h-12 border-slate-200 rounded-xl dark:border-zinc-800" /></div>
             <div className="space-y-3"><label className="text-xs font-black text-slate-500 uppercase tracking-widest dark:text-zinc-400">Email / Contact</label><Input value={dupEmail} onChange={e => setDupEmail(e.target.value)} placeholder="Enter e-mail/mobile no" className="h-12 border-slate-200 rounded-xl dark:border-zinc-800" /></div>
           </div>
           <div className="mt-8 flex justify-end"><Button onClick={handleCheckDuplication} disabled={isCheckingDuplicates || (!dupCompany && !dupEmail)} className="bg-[#008d4c] hover:bg-[#00733e] text-white font-black px-8 h-12 rounded-xl">{isCheckingDuplicates ? "Checking..." : "Start Check"}</Button></div>
        </Card>

        {hasStartedCheck && (
          <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden mt-6 dark:bg-zinc-900">
            <div className="p-6 border-b">
               <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Results</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#f8fafc] dark:bg-zinc-900">
                   <TableRow>
                     <TableHead className="text-xs font-bold text-slate-700 h-12 px-6 dark:text-zinc-400">ID</TableHead>
                     <TableHead className="text-xs font-bold text-slate-700 h-12 px-6 dark:text-zinc-400">Company</TableHead>
                     <TableHead className="text-xs font-bold text-slate-700 h-12 px-6 dark:text-zinc-400">Account Name</TableHead>
                     <TableHead className="text-xs font-bold text-slate-700 h-12 px-6 dark:text-zinc-400">Email / Phone</TableHead>
                     <TableHead className="text-xs font-bold text-slate-700 h-12 px-6 dark:text-zinc-400">Created On</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {isCheckingDuplicates ? (
                     <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500 font-bold dark:text-zinc-400">Checking database...</TableCell></TableRow>
                  ) : duplicateData?.duplicates?.length > 0 ? (
                    duplicateData.duplicates.map((dup: any, i: number) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800">
                        <TableCell className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-zinc-100">{dup.id}</TableCell>
                        <TableCell className="px-6 py-4 text-sm font-bold text-emerald-600">{dup.companyName}</TableCell>
                        <TableCell className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-300">{dup.accountName || "N/A"}</TableCell>
                        <TableCell className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-300">{dup.email || "No Email"} <br/> <span className="text-xs text-slate-400">{dup.phone || "No Phone"}</span></TableCell>
                        <TableCell className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-300">{new Date(dup.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500 dark:text-zinc-400">No duplicates found in the system. Safe to add!</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // --- ADD CUSTOMER VIEW ---
  if (currentView === "add-customer") {
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">Add Customer</h1>
        <div className="flex items-center gap-2 mb-4">
          <Button size="sm" className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-9 px-4 rounded border-none shadow-sm">Import</Button>
          <Button size="sm" variant="outline" className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-9 px-4 rounded border-none shadow-sm flex items-center gap-2">Template <Download className="w-3.5 h-3.5" /></Button>
          <Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="text-slate-500 font-bold text-sm ml-auto dark:text-zinc-400">Cancel</Button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-4 space-y-6">
            <Card className="border-none shadow-md rounded-lg bg-white overflow-hidden dark:bg-zinc-900">
               <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-zinc-800"><CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Company Detail</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-5">
                 {[ 
                   ["Company name *", "Enter Company name", "companyName"], 
                   ["Ab *", "select", "ab"], 
                   ["Country /Region *", "select", "country"], 
                   ["Contact No (0521234567) *", "Enter phone number", "phone"], 
                   ["City *", "select", "city"], 
                   ["Address *", "Enter address", "address"], 
                   ["Company type *", "select", "companyType"], 
                   ["Crm Id *", "Enter Crm id", "crmId"], 
                   ["Crm Date *", "date", "crmDate"] 
                 ].map(([l, p, k], i) => (
                   <div key={i} className="space-y-1.5"><label className="text-xs font-bold text-slate-600 tracking-tight dark:text-zinc-300">{l}</label>{p === "select" ? ( <div className="relative"><select value={addCustomerData[k] || ""} onChange={e => setAddCustomerData({...addCustomerData, [k]: e.target.value})} className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none dark:border-zinc-800"><option value="">Choose...</option><option value="Option A">Option A</option><option value="Option B">Option B</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div> ) : ( <Input value={addCustomerData[k] || ""} onChange={e => setAddCustomerData({...addCustomerData, [k]: e.target.value})} type={p === "date" ? "date" : "text"} placeholder={p} className="h-10 border-slate-200 rounded px-3 text-sm dark:border-zinc-800" /> )}</div>
                 ))}
                 <div className="pt-6 border-t"><h3 className="text-sm font-bold text-slate-700 mb-4 dark:text-zinc-400">Business Line</h3><div className="space-y-2 max-h-[300px] overflow-y-auto px-2">{businessLines.map((line, i) => (<div key={i} onClick={() => setAddCustomerData({...addCustomerData, businessLine: line})} className={`flex items-center gap-2.5 py-1 group cursor-pointer ${addCustomerData.businessLine === line ? 'bg-emerald-50 text-emerald-600' : ''}`}><FolderOpen className="w-4 h-4 text-slate-500 dark:text-zinc-400" /><span className="text-sm font-bold text-slate-700 dark:text-zinc-400">{line}</span></div>))}</div></div>
               </CardContent>
            </Card>
          </div>
          <div className="xl:col-span-4"><Card className="border-none shadow-md rounded-lg bg-white overflow-hidden dark:bg-zinc-900"><CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-zinc-800"><CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Primary Detail</CardTitle></CardHeader><CardContent className="p-6 space-y-5">{[ ["Title *", "select", "title"], ["Person Full Name *", "Enter Person name", "personName"], ["CNIC *", "123456789", "cnic"], ["NTN *", "Enter NTN", "ntn"], ["Website *", "www.name.com", "website"], ["Email *", "Enter Company E-mail", "email"], ["Mobile No (03001234567) *", "Enter company mobile no", "mobile"], ["Designation *", "select", "designation"] ].map(([l, p, k], i) => ( <div key={i} className="space-y-1.5"><label className="text-xs font-bold text-slate-600 tracking-tight dark:text-zinc-300">{l}</label>{p === "select" ? ( <div className="relative"><select value={addCustomerData[k] || ""} onChange={e => setAddCustomerData({...addCustomerData, [k]: e.target.value})} className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none dark:border-zinc-800"><option value="">Choose...</option><option value="Option A">Option A</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div> ) : ( <Input value={addCustomerData[k] || ""} onChange={e => setAddCustomerData({...addCustomerData, [k]: e.target.value})} placeholder={p} className="h-10 border-slate-200 rounded px-3 text-sm dark:border-zinc-800" /> )}</div> ))}<div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 tracking-tight dark:text-zinc-300">Your Comment*</label><textarea value={addCustomerData.comment || ""} onChange={e => setAddCustomerData({...addCustomerData, comment: e.target.value})} className="w-full h-32 border border-slate-200 rounded p-3 text-sm outline-none resize-none focus:border-emerald-500 dark:border-zinc-800" /></div></CardContent></Card></div>
          <div className="xl:col-span-4 space-y-6"><Card className="border-none shadow-md rounded-lg bg-white overflow-hidden dark:bg-zinc-900"><CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-zinc-800"><CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Lead Detail</CardTitle></CardHeader><CardContent className="p-6 space-y-5">{[ ["RC Link*", "select", "rcLink"], ["Source *", "select", "source"], ["Status*", "select", "status"], ["Grade*", "select", "grade"] ].map(([l, p, k], i) => { 
            let options = <><option value="New">New</option><option value="A (Hot)">A (Hot)</option><option value="Facebook">Facebook</option></>;
            if (k === "source") options = <><option value="Facebook">Facebook</option><option value="Google">Google</option><option value="Direct">Direct</option><option value="Referral">Referral</option></>;
            else if (k === "status") options = <><option value="New">New</option><option value="Renew">Renew</option><option value="Expire">Expire</option></>;
            else if (k === "grade") options = <><option value="A (Hot)">A (Hot)</option><option value="B (Warm)">B (Warm)</option><option value="C (Cold)">C (Cold)</option></>;
            else if (k === "rcLink") options = <><option value="Yes">Yes</option><option value="No">No</option></>;
            return (<div key={i} className="space-y-1.5"><label className="text-xs font-bold text-slate-600 tracking-tight dark:text-zinc-300">{l}</label><div className="relative"><select value={addCustomerData[k] || ""} onChange={e => setAddCustomerData({...addCustomerData, [k]: e.target.value})} className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none dark:border-zinc-800"><option value="">Choose...</option>{options}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>); 
          })}<div className="pt-4"><h3 className="text-sm font-bold text-slate-700 mb-4 dark:text-zinc-400">Service Type*</h3><div className="space-y-3 max-h-[500px] overflow-y-auto px-1">{services.map((s, i) => { const isSel = addCustomerData.serviceTypes.includes(s); return ( <div key={i} onClick={() => setAddCustomerData({...addCustomerData, serviceTypes: isSel ? addCustomerData.serviceTypes.filter((x: string) => x !== s) : [...addCustomerData.serviceTypes, s]})} className="flex items-start gap-3 cursor-pointer"><div className={`w-4 h-4 border rounded mt-1 ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white dark:bg-zinc-900'}`} /><span className="text-sm font-medium text-slate-600 dark:text-zinc-300">{s}</span></div> ); })}</div></div><div className="pt-6"><Button onClick={handleAddSubmit} disabled={addCustomerMutation.isPending} className="w-full bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-11 rounded border-none shadow-sm">{addCustomerMutation.isPending ? "Submitting..." : "Submit form"}</Button></div></CardContent></Card></div>
        </div>
      </div>
    );
  }

  // --- TEMPORARY ACCOUNT VIEW ---
  if (currentView === "temporary") {
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
         <div className="flex items-center justify-between">
           <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">TEMPORARY ACCOUNT</h1>
           <Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="text-slate-500 font-bold text-sm dark:text-zinc-400">Cancel</Button>
         </div>
         <Card className="border-none shadow-sm rounded bg-white p-8 dark:bg-zinc-900">
           <div className="space-y-10">
             <div className="space-y-6"><h3 className="text-lg font-bold text-slate-700 dark:text-zinc-400">Primary Detail</h3><div className="grid grid-cols-1 md:grid-cols-4 gap-6">{[ ["Title*", "select"], ["Person Full Name*", "Enter Person name"], ["Email*", "Enter Company E-mail"], ["Mobile*", "Enter company mobile no"] ].map(([l, p], i) => ( <div key={i} className="space-y-1.5"><label className="text-sm font-bold text-slate-700 dark:text-zinc-400">{l}</label>{p === "select" ? ( <div className="relative"><select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none dark:border-zinc-800"><option>Choose...</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div> ) : ( <Input placeholder={p} className="h-10 border-slate-200 rounded px-3 text-sm dark:border-zinc-800" /> )}</div> ))}<div className="col-span-full space-y-1.5"><label className="text-sm font-bold text-slate-700 dark:text-zinc-400">Your Comment</label><textarea className="w-full h-32 border border-slate-200 rounded p-3 text-sm outline-none resize-none focus:border-emerald-500 dark:border-zinc-800" /></div></div></div>
             <div className="space-y-6"><h3 className="text-lg font-bold text-slate-700 dark:text-zinc-400">Lead Detail</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-8">{[ ["Source*", "select"], ["Grade*", "select"] ].map(([l, p], i) => ( <div key={i} className="space-y-1.5"><label className="text-sm font-bold text-slate-700 dark:text-zinc-400">{l}</label><div className="relative"><select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none dark:border-zinc-800"><option>Choose...</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div> ))}</div></div>
             <div className="space-y-6"><h3 className="text-lg font-bold text-slate-700 dark:text-zinc-400">Service Type</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-y-3">{services.map((s, i) => ( <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 border border-slate-300 rounded bg-white dark:bg-zinc-900 dark:border-zinc-800" /><span className="text-sm font-medium text-slate-600 dark:text-zinc-300">{s}</span></div> ))}</div></div>
             <div className="pt-4"><Button onClick={() => setCurrentView("dashboard")} className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8 h-10 rounded font-bold border-none shadow-sm">Submit form</Button></div>
           </div>
         </Card>
      </div>
    );
  }

  // --- CHECK PROJECT REPORTS ---
  if (currentView === "project-report") {
    const projectRows = [
      { id: "PKCapc2725", name: "Capcon International", pkg: "", status: "", person: "Muhammad Nadeem Zulfiqar", create: "26-03-2021", gmPay: "0", gmDoc: "0", bvDate: "01-01-1970", invoice: "09-04-2026", receipt: "09-04-2026", method: "cash", project: "Domain Registration", data: "09-04-2026", hod: "08-04-2026", dep: "Aproved", i5p: "0", assign: "0", finish: "0", rem: "0" },
      { id: "PKCapc2725", name: "Capcon International", pkg: "", status: "", person: "Muhammad Nadeem Zulfiqar", create: "26-03-2021", gmPay: "0", gmDoc: "0", bvDate: "01-01-1970", invoice: "09-04-2026", receipt: "09-04-2026", method: "cash", project: "Hosting Plan", data: "09-04-2026", hod: "08-04-2026", dep: "Aproved", i5p: "0", assign: "0", finish: "0", rem: "-1" },
      { id: "PKCapc2725", name: "Capcon International", pkg: "", status: "", person: "Muhammad Nadeem Zulfiqar", create: "26-03-2021", gmPay: "0", gmDoc: "0", bvDate: "01-01-1970", invoice: "09-04-2026", receipt: "09-04-2026", method: "cash", project: "SSL Certificate", data: "09-04-2026", hod: "08-04-2026", dep: "Aproved", i5p: "0", assign: "0", finish: "0", rem: "-1" },
      { id: "SK T120532", name: "SK TRENDSETTERS", pkg: "Basic", status: "Renewal", person: "ASIF JAHANSEER", create: "10-09-2024", gmPay: "20-11-2025", gmDoc: "0", bvDate: "26-11-2025", invoice: "08-04-2026", receipt: "09-04-2026", method: "Bank Transf", project: "Alibaba Product Posting / 38", data: "09-04-2026", hod: "23-09-2024", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
      { id: "PKSPOT23398", name: "SPOTLESS ENTERPRISES", pkg: "Basic", status: "", person: "Waqas Ahmed", create: "28-01-2023", gmPay: "26-02-2026", gmDoc: "0", bvDate: "28-08-2024", invoice: "08-04-2026", receipt: "09-04-2026", method: "Free", project: "Alibaba Product Posting / 100", data: "09-04-2026", hod: "22-10-2024", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
      { id: "SK T120532", name: "SK TRENDSETTERS", pkg: "Basic", status: "Renewal", person: "ASIF JAHANSEER", create: "10-09-2024", gmPay: "20-11-2025", gmDoc: "0", bvDate: "26-11-2025", invoice: "08-04-2026", receipt: "09-04-2026", method: "Bank Transf", project: "AliBaba VA with RFQs", data: "09-04-2026", hod: "23-09-2024", dep: "", i5p: "0", assign: "0", finish: "0", rem: "29" },
      { id: "PKASKA7734", name: "ASKAR WEAR IND", pkg: "Basic Plus", status: "New", person: "Hafsa Naseer", create: "18-04-2022", gmPay: "28-02-2026", gmDoc: "0", bvDate: "02-04-2028", invoice: "08-04-2026", receipt: "09-04-2026", method: "Free", project: "Alibaba Product Posting / 200", data: "09-04-2026", hod: "02-03-2026", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
      { id: "pkHili211733", name: "Hill Touch International", pkg: "Basic Plus", status: "New", person: "Rehman Faisal", create: "02-03-2026", gmPay: "04-03-2026", gmDoc: "0", bvDate: "02-04-2026", invoice: "07-04-2026", receipt: "09-04-2026", method: "Free", project: "Alibaba Product Posting / 200", data: "09-04-2026", hod: "04-03-2026", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
      { id: "PKAUGMI543", name: "AUGMENT INDUSTRY", pkg: "Basic Plus", status: "New", person: "Rehman Faisal", create: "18-12-2020", gmPay: "10-02-2026", gmDoc: "0", bvDate: "05-03-2026", invoice: "07-04-2026", receipt: "09-04-2026", method: "Free", project: "Alibaba Product Posting / 100", data: "09-04-2026", hod: "09-02-2026", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
      { id: "SYST131084", name: "SYSTEM OF QUALITY INTERNATIONAL CO", pkg: "Basic Plus", status: "New", person: "Rehman Faisal", create: "25-11-2024", gmPay: "27-02-2026", gmDoc: "0", bvDate: "27-03-2026", invoice: "07-04-2026", receipt: "09-04-2026", method: "Bank Transf", project: "Alibaba Product Posting / 100", data: "09-04-2026", hod: "04-03-2026", dep: "", i5p: "0", assign: "0", finish: "0", rem: "15" },
    ];
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">CHECK PROJECT REPORTS</h1>
        {/* Filter Bar */}
        <div className="flex items-end gap-4 bg-white rounded-lg shadow-sm p-5 dark:bg-zinc-900">
          <div className="flex-1 space-y-1.5">
            <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Company Name</label>
            <Input placeholder="Enter name" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Start Date</label>
            <Input type="date" className="h-10 border-slate-200 rounded text-sm w-44 dark:border-zinc-800" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">End Date</label>
            <Input type="date" className="h-10 border-slate-200 rounded text-sm w-44 dark:border-zinc-800" />
          </div>
          <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-10 px-8 rounded border-none">View</Button>
          <Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="text-slate-400 font-bold">Back</Button>
        </div>
        {/* Table */}
        <Card className="border-none shadow-sm rounded-lg bg-white overflow-hidden dark:bg-zinc-900">
          <div className="p-4 flex justify-end border-b">
            <div className="flex items-center gap-2 text-[12px]">Search: <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" /></div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                <TableRow className="h-10 hover:bg-transparent">
                  {["#","ID","Name","Package","Status","Person","Create","GM Pay","GM Doc","BV Date","Invoice","Receipt","Method","Project","Data","Hod","Dep","I5P","Assign","Finish","Remaining"].map(h => (
                    <TableHead key={h} className="font-bold text-slate-800 text-[11px] px-3 whitespace-nowrap h-10 dark:text-zinc-100">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-slate-50 text-[11px] dark:hover:bg-zinc-800">
                    <TableCell className="px-3 py-2.5">{i + 1}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[10px] text-slate-500 dark:text-zinc-400">{row.id}</TableCell>
                    <TableCell className="px-3 py-2.5 text-[#00a65a] font-bold whitespace-nowrap dark:text-zinc-400">{row.name}</TableCell>
                    <TableCell className="px-3 py-2.5">{row.pkg}</TableCell>
                    <TableCell className="px-3 py-2.5">{row.status && <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[10px] h-5">{row.status}</Badge>}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">{row.person}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-zinc-400">{row.create}</TableCell>
                    <TableCell className="px-3 py-2.5 text-slate-500 dark:text-zinc-400">{row.gmPay}</TableCell>
                    <TableCell className="px-3 py-2.5 text-slate-500 dark:text-zinc-400">{row.gmDoc}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-zinc-400">{row.bvDate}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-[#00a65a] dark:text-zinc-400">{row.invoice}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-[#00a65a] dark:text-zinc-400">{row.receipt}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">{row.method}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-zinc-300">{row.project}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-zinc-400">{row.data}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-zinc-400">{row.hod}</TableCell>
                    <TableCell className="px-3 py-2.5">{row.dep}</TableCell>
                    <TableCell className="px-3 py-2.5 text-center">{row.i5p}</TableCell>
                    <TableCell className="px-3 py-2.5 text-center">{row.assign}</TableCell>
                    <TableCell className="px-3 py-2.5 text-center">{row.finish}</TableCell>
                    <TableCell className={`px-3 py-2.5 text-center font-bold ${parseFloat(row.rem) < 0 ? "text-red-500" : parseFloat(row.rem) > 0 ? "text-[#00a65a]" : ""}`}>{row.rem}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 flex items-center justify-between border-t text-[12px]">
            <p className="text-slate-500 dark:text-zinc-400">Showing 1 to {projectRows.length} of {projectRows.length} entries</p>
            <div className="flex">
              <Button variant="outline" className="h-9 rounded-l px-4 text-xs font-bold text-slate-400">Previous</Button>
              <Button className="h-9 bg-[#008d4c] text-white border-none px-4 text-xs font-bold">1</Button>
              <Button variant="outline" className="h-9 rounded-r px-4 text-xs font-bold text-slate-400 border-l-0">Next</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- VIEW LEAD FOLLOWUP REPORT ---
  if (currentView === "followup-report") {
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">VIEW LEAD FOLLOWUP REPORT</h1>
        <Card className="border-none shadow-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Select User</label>
              <div className="relative"><select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800"><option>Choose...</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Select City</label>
              <div className="relative"><select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800"><option>Choose...</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Source</label>
              <div className="relative"><select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800"><option>All</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Start Date</label>
              <Input type="date" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">End Date</label>
              <Input type="date" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-10 px-8 rounded border-none">View</Button>
            <Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="text-slate-400 font-bold">Back</Button>
          </div>
        </Card>
        <Card className="border-none shadow-sm rounded-lg bg-white overflow-hidden dark:bg-zinc-900">
          <CardHeader className="py-2.5 px-4 border-b"><CardTitle className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">GM View</CardTitle></CardHeader>
          <CardContent className="p-4 pt-6 text-[12px]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                Show
                <div className="relative inline-block"><select className="h-7 border border-slate-200 rounded px-2 text-xs font-bold appearance-none outline-none w-14 dark:border-zinc-800"><option>10</option><option>25</option></select><ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" /></div>
                entries
              </div>
              <div className="flex items-center gap-2">Search: <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" /></div>
            </div>
            <Table>
              <TableHeader className="bg-[#e2f3ee] dark:bg-zinc-900">
                <TableRow className="h-10 hover:bg-transparent">
                  {["#", "Person", "City", "Leads", "Follow", "Not Follow", "Start Date", "End Date"].map(h => (
                    <TableHead key={h} className="font-bold text-slate-800 h-10 px-4 whitespace-nowrap dark:text-zinc-100">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <TableCell className="px-4 py-3">1</TableCell>
                  <TableCell className="px-4 py-3">Dumy</TableCell>
                  <TableCell className="px-4 py-3">Sialkot</TableCell>
                  <TableCell className="px-4 py-3">100</TableCell>
                  <TableCell className="px-4 py-3">50</TableCell>
                  <TableCell className="px-4 py-3">50</TableCell>
                  <TableCell className="px-4 py-3">01/01/2025</TableCell>
                  <TableCell className="px-4 py-3 text-[#00a65a] font-bold dark:text-zinc-400">01/01/2025</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t">
              <p className="text-[12px] text-slate-500 dark:text-zinc-400">Showing 1 to 1 of 1 entries</p>
              <div className="flex">
                <Button variant="outline" className="h-9 rounded-l px-4 text-xs font-bold text-slate-400">Previous</Button>
                <Button className="h-9 bg-[#008d4c] text-white border-none px-4 text-xs font-bold">1</Button>
                <Button variant="outline" className="h-9 rounded-r px-4 text-xs font-bold text-slate-400 border-l-0">Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- ADD UAE CUSTOMER ---
  const uaeTags = [
    "Expansion bolts", "Expansion anchors", "Drop in anchor & cut anchor", "Drop in anchor",
    "Curtain walling Contract manufacturing", "Continuity systems", "Channel", "Cast in channels",
    "Build forming parts", "Brickwork ties", "Brickwork supports", "Brickwork restraints",
    "Binu mathew", "Anker Anchoring systems Anchoring", "Sockets", "Fixing",
    "Fasteners", "Channels", "Angles", "Anchors", "Nails", "Bolts",
    "Manufacturer", "Ties", "Chains", "Building"
  ];
  const filteredTags = uaeTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));

  if (currentView === "add-uae") {
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">ADD CUSTOMER</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-9 px-5 rounded border-none">Import</Button>
          <Button size="sm" className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-9 px-5 rounded border-none flex items-center gap-1">Template <Download className="w-3.5 h-3.5" /></Button>
          <Button size="sm" className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-9 px-5 rounded border-none">Add Company Type</Button>
          <Button size="sm" className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-9 px-5 rounded border-none">Import Tag List</Button>
          <Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="ml-auto text-slate-500 font-bold text-sm dark:text-zinc-400">Cancel</Button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Company + Primary Detail */}
          <div className="xl:col-span-9 space-y-6">
            <Card className="border-none shadow-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
              <h3 className="text-sm font-bold text-[#e74c3c] mb-5">Company Detail</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Company name *</label>
                  <Input placeholder="Enter Company name" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Country /Region *</label>
                  <div className="relative">
                    <select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white font-bold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                      <option selected>UAE</option><option>PK</option><option>USA</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Company type</label>
                  <div className="relative">
                    <select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <option>Choose...</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">City *</label>
                  <div className="relative">
                    <select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <option>Choose...</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Landline No * (+971-X-XXXXXXX)</label>
                  <Input placeholder="Enter landline number" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Mobile No * (+971-XX-1234567)</label>
                  <Input placeholder="Enter company mobile no" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
              </div>
            </Card>
            <Card className="border-none shadow-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
              <h3 className="text-sm font-bold text-slate-700 mb-5 dark:text-zinc-400">Primary Detail</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Title</label>
                  <div className="relative">
                    <select className="w-full h-10 border border-slate-200 rounded px-3 text-sm appearance-none outline-none bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <option>Choose...</option><option>Mr</option><option>Ms</option><option>Dr</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Person Full Name</label>
                  <Input placeholder="Enter Person name" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Personal Mobile No</label>
                  <Input placeholder="123456789" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Website</label>
                  <Input placeholder="www.name.com" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Email *</label>
                  <Input placeholder="Enter Company E-mail" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Address</label>
                  <Input placeholder="" className="h-10 border-slate-200 rounded text-sm dark:border-zinc-800" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Google Map</label>
                <textarea className="w-full h-20 border border-slate-200 rounded p-3 text-sm outline-none resize-none dark:border-zinc-800" />
              </div>
              <div className="mt-6">
                <Button onClick={() => setCurrentView("dashboard")} className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-10 px-8 rounded border-none">Submit form</Button>
              </div>
            </Card>
          </div>
          {/* Right: Tags */}
          <div className="xl:col-span-3">
            <Card className="border-none shadow-sm rounded-lg bg-white overflow-hidden dark:bg-zinc-900">
              <div className="p-4 border-b">
                <h3 className="text-sm font-bold text-slate-700 mb-3 dark:text-zinc-400">Tags</h3>
                <Input
                  placeholder="Search"
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  className="h-9 border-slate-200 rounded text-sm dark:border-zinc-800"
                />
              </div>
              <div className="p-3 max-h-[500px] overflow-y-auto space-y-1">
                {filteredTags.map((tag, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer dark:hover:bg-zinc-800">
                    <div className="w-4 h-4 border border-slate-300 rounded bg-white flex-shrink-0 dark:bg-zinc-900 dark:border-zinc-800" />
                    <span className="text-[12px] font-medium text-slate-700 dark:text-zinc-400">{tag}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW UAE CUSTOMER ---
  if (currentView === "view-uae") {
    return (
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#f4f7f6] dark:bg-zinc-950">
         <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight dark:text-zinc-100">VIEW UAE CUSTOMER</h1>
            <Button size="sm" className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-9 px-4 rounded border-none shadow-sm flex items-center gap-2">Uae Customer Csv <Download className="w-3.5 h-3.5" /></Button>
         </div>
         <Card className="border-none shadow-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {[ ["Person", "All"], ["Country", "All"], ["Company Type", "All"], ["Tags", "All"], ["Start Date", "date"], ["End Date", "date"] ].map(([l, p], i) => (
                <div key={i} className="space-y-1.5 text-[12px]"><label className="font-bold text-slate-700 dark:text-zinc-400">{l}</label>{p === "date" ? ( <Input type="date" className="h-9 border-slate-200 text-xs rounded px-2 dark:border-zinc-800" /> ) : ( <div className="relative"><select className="w-full h-9 border border-slate-200 rounded px-2 text-xs font-bold text-slate-600 appearance-none bg-white outline-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"><option>{p}</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" /></div> )}</div>
              ))}
            </div>
            <div className="mt-4"><Button className="bg-[#008d4c] hover:bg-[#00733e] text-white font-bold h-10 px-8 rounded border-none shadow-sm text-sm">View</Button><Button onClick={() => setCurrentView("dashboard")} variant="ghost" className="text-slate-400 font-bold text-sm ml-2">Back</Button></div>
         </Card>
         <Card className="border-none shadow-sm rounded-lg bg-white overflow-hidden dark:bg-zinc-900">
            <CardHeader className="py-2.5 px-4 border-b"><CardTitle className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">GM View</CardTitle></CardHeader>
            <CardContent className="p-4 pt-6 text-[12px]"><div className="flex justify-between items-center mb-6"><div className="flex items-center gap-2">Show <span className="border px-2 rounded font-bold h-7 flex items-center bg-white cursor-pointer dark:bg-zinc-900">10 <ChevronDown className="w-3 h-3 ml-1" /></span> entries</div><div className="flex items-center gap-2">Search: <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" /></div></div><Table><TableHeader className="bg-[#e2f3ee] dark:bg-zinc-900"><TableRow className="h-10 hover:bg-transparent">{["#", "Company", "Package", "Method", "BV", "Person", "Rc/New", "Date"].map(h => ( <TableHead key={h} className="font-bold text-slate-800 h-10 px-4 dark:text-zinc-100">{h}</TableHead> ))}</TableRow></TableHeader><TableBody><TableRow><TableCell className="px-4 py-3">trusmile surgical</TableCell><TableCell className="px-4 py-3">1000</TableCell><TableCell className="px-4 py-3">364</TableCell><TableCell className="px-4 py-3">364</TableCell><TableCell className="px-4 py-3">364</TableCell><TableCell className="px-4 py-3">364</TableCell><TableCell className="px-4 py-3">364</TableCell><TableCell className="px-4 py-3 whitespace-nowrap">2021-07-13 17:08:25</TableCell></TableRow></TableBody></Table><div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-[12px] text-slate-500 dark:text-zinc-400">Showing 1 to 1 of 1 entries</p><div className="flex"><Button variant="outline" className="h-9 rounded-l px-4 text-xs font-bold text-slate-400">Previous</Button><Button className="h-9 bg-[#008d4c] text-white border-none px-4 text-xs font-bold">1</Button><Button variant="outline" className="h-9 rounded-r px-4 text-xs font-bold text-slate-400 border-l-0">Next</Button></div></div></CardContent>
         </Card>
      </div>
    );
  }

  // --- DASHBOARD HOME VIEW ---
  return (
    <div className="contents">
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f8f7_0%,#eef4f2_100%)] p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="rounded-[22px] border border-white/70 bg-white px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:bg-zinc-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
                <span className="text-[#334155] dark:text-zinc-100">DASHBOARD</span>
                <span className="text-[#00a65a] dark:text-zinc-400">/</span>
                <span className="text-[#00a65a] dark:text-zinc-400">LEAD DEPARTMENT</span>
                <span className="text-slate-400">/</span>
                <span className="text-[#64748b] font-semibold">LEAD MANAGER</span>
              </div>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-slate-800 dark:text-zinc-100">Lead Manager Dashboard</h1>
                <p className="text-[14px] text-slate-500 dark:text-zinc-400">Monitor branch activity, assign follow-up work, and keep daily lead operations visible.</p>
              </div>
            </div>
          </div>
        </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 space-y-6">
          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
             <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <div>
                <CardTitle className="text-[16px] font-bold text-[#243b53] dark:text-zinc-100">Top Selling</CardTitle>
                <p className="mt-1 text-[13px] text-slate-400">Fast summary of lead distribution activity.</p>
              </div>
              <select value={topSellingFilter} onChange={(e) => setTopSellingFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 outline-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                <option value="TD">TD</option>
                <option value="1W">1W</option>
                <option value="1M">1M</option>
              </select>
             </CardHeader>
             <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
              {([ ["Total Lead", Users, totalLeadsCount], ["Distribute", ArrowRightLeft, distributeLeadsCount], ["Distributed", Tag, distributedLeadsCount] ] as [string, React.ElementType, number][]).map(([l, Icon, count], i) => (
                <div key={i} className="group relative overflow-hidden rounded-[22px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfa_100%)] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:border-zinc-800">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00a65a] via-[#37c982] to-[#8be0b3] opacity-80" />
                  <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">{l}</p>
                    <p className="text-[42px] font-bold leading-none text-slate-800 dark:text-zinc-100">{count}</p>
                    <p className="text-[12px] text-slate-400">Updated {topSellingFilter === "TD" ? "for today" : topSellingFilter === "1W" ? "this week" : "this month"}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00a65a_0%,#0f9f73_100%)] text-white shadow-[0_12px_24px_rgba(0,166,90,0.25)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  </div>
                </div>
              ))}
             </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
             <CardHeader className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-[16px] font-bold text-[#243b53] dark:text-zinc-100">Follow Lead</CardTitle>
                <p className="mt-1 text-[13px] text-slate-400">Track today’s follow-up queue and lead distribution activity.</p>
              </div>
              <div className="flex items-center gap-3 rounded-[18px] bg-[#f6faf8] p-2 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setFollowActiveTab("follow")}
                  className={followActiveTab === "follow" ? "h-11 rounded-[14px] bg-[#00a65a] px-8 text-[14px] font-bold text-white shadow-[0_12px_24px_rgba(0,166,90,0.22)]" : "h-11 rounded-[14px] px-7 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:text-slate-800 dark:text-slate-200"}
                >
                  Today Follow
                </button>
                <button
                  type="button"
                  onClick={() => setFollowActiveTab("distribute")}
                  className={followActiveTab === "distribute" ? "h-11 rounded-[14px] bg-[#00a65a] px-8 text-[14px] font-bold text-white shadow-[0_12px_24px_rgba(0,166,90,0.22)]" : "h-11 rounded-[14px] px-7 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:text-slate-800 dark:text-slate-200"}
                >
                  Distribute
                </button>
              </div>
              </div>
             </CardHeader>
             <CardContent className="p-5 pt-4 text-[12px] text-slate-400">
              <div className="overflow-hidden rounded-[18px] border border-slate-100 dark:border-zinc-800">
              <Table>
                <TableHeader className="bg-[#f7faf9] dark:bg-zinc-900">
                  <TableRow className="h-12 hover:bg-transparent">{["No#", "Company", "Follow", "Method", "Time"].map(h => ( <TableHead key={h} className="h-12 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{h}</TableHead> ))}</TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCustomers ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-500 font-bold dark:text-zinc-400">Loading Queue...</TableCell>
                    </TableRow>
                  ) : (followActiveTab === "follow" ? allLeads.filter((l: any) => l.ownerUserId) : allLeads.filter((l: any) => !l.ownerUserId)).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-500 font-bold dark:text-zinc-400">No leads in queue.</TableCell>
                    </TableRow>
                  ) : (
                    (followActiveTab === "follow" ? allLeads.filter((l: any) => l.ownerUserId) : allLeads.filter((l: any) => !l.ownerUserId)).slice(0, 10).map((lead: any, i: number) => (
                      <TableRow key={lead.id} className="hover:bg-slate-50 border-b border-slate-100 text-slate-600 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                        <TableCell className="px-4 py-3 text-[13px]">{i + 1}</TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-[#00a65a] font-bold dark:text-zinc-400">{lead.companyName}</TableCell>
                        <TableCell className="px-4 py-3 text-[13px]">{followActiveTab === "follow" ? "Follow Up" : "Initial Contact"}</TableCell>
                        {followActiveTab === "distribute" ? (
                          <TableCell className="px-4 py-3 text-[13px]">
                            <div className="flex items-center gap-2">
                              <select 
                                  className="h-8 border border-slate-200 rounded text-xs px-2 w-[160px] outline-none dark:border-zinc-800"
                                  value={assigningUserId[lead.id] || ""}
                                  onChange={e => setAssigningUserId({ ...assigningUserId, [lead.id]: e.target.value })}
                                >
                                  <option value="">Select Exec</option>
                                  <optgroup label="Sales Executives">
                                    {systemUsers.filter((u: any) => u.role === "sales_executive").map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </optgroup>
                                  <optgroup label="Service Executives">
                                    {systemUsers.filter((u: any) => u.role === "service_executive").map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </optgroup>
                                </select>
                              <Button 
                                size="sm" 
                                className="h-8 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-bold"
                                onClick={() => handleAssign(lead.id)}
                                disabled={assignLeadMutation.isPending}
                              >
                                Assign
                              </Button>
                            </div>
                          </TableCell>
                        ) : (
                          <TableCell className="px-4 py-3 text-[13px]">{lead.phone ? "Phone Call" : "Email"}</TableCell>
                        )}
                        <TableCell className="px-4 py-3 text-[13px]">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
             </CardContent>
           </Card>

          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
             <CardHeader className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <CardTitle className="text-[16px] font-bold text-[#243b53] dark:text-zinc-100">Marketing Manager Leads <span className="text-[12px] font-medium text-slate-400">(Current Branch: Sialkot)</span></CardTitle>
             </CardHeader>
             <CardContent className="p-5 pt-4 text-[12px]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="text-sm text-slate-500 dark:text-zinc-400">
                  <div>Show</div>
                  <div className="mt-1 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">10</div>
                  <div className="mt-1">entries</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 ml-auto dark:text-zinc-400">Search: <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} className="h-10 w-52 rounded-xl border-slate-200 bg-slate-50/60 shadow-none dark:border-zinc-800" placeholder="Search leads..." /></div>
              </div>
              <div className="overflow-x-auto rounded-[18px] border border-slate-100 dark:border-zinc-800">
              <Table>
                <TableHeader className="bg-white dark:bg-zinc-900">
                  <TableRow className="h-12 hover:bg-transparent">{["#", "Company", "Created By", "Created Time", "Created Date", "Country", "City", "Status", "Assigned To", "Actions"].map(h => (<TableHead key={h} className="h-12 whitespace-nowrap text-[13px] font-bold text-slate-700 dark:text-zinc-400">{h}</TableHead>))}</TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCustomers ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500 font-bold dark:text-zinc-400">Loading leads...</TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500 font-bold dark:text-zinc-400">No leads found matching your search. Add some to get started!</TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead: any, idx: number) => {
                      const createDate = new Date(lead.createdAt);
                      const daysAgo = Math.floor((Date.now() - createDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <TableRow key={lead.id} className="h-16 hover:bg-[#f8fbfa] dark:hover:bg-zinc-800">
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="text-emerald-600 font-bold whitespace-nowrap">{lead.companyName}</TableCell>
                          <TableCell><Badge className="bg-blue-100 text-blue-700 border-none max-w-[100px] truncate">{lead.createdBy || "System"}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600 dark:text-zinc-300"><Clock className="inline w-3.5 h-3.5 mr-1" />{createDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                          <TableCell><Badge className="bg-emerald-100 text-emerald-700 border-none">{createDate.toLocaleDateString()}</Badge></TableCell>
                          <TableCell className="text-slate-500 dark:text-zinc-400">{lead.country || "-"}</TableCell>
                          <TableCell><Badge className="bg-emerald-700 border-none">{lead.city || lead.region || "Unknown"}</Badge></TableCell>
                          <TableCell><Badge className="bg-slate-50 border-none dark:bg-zinc-900">{daysAgo} days ago</Badge></TableCell>
                          <TableCell><Badge className={lead.ownerUserId ? "bg-amber-400 text-white border-none truncate max-w-[100px]" : "bg-slate-100 text-slate-500 dark:text-slate-400 border-none"}>{lead.ownerUserId ? "Assigned" : "Unassigned"}</Badge></TableCell>
                          <TableCell><Button onClick={() => setTransferModalLeadId(lead.id)} variant="outline" className="h-9 rounded-xl border-emerald-500 text-emerald-600 font-bold hover:bg-emerald-50 text-[11px] px-3">Transfer</Button></TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[13px] text-slate-500 dark:text-zinc-400">Showing 1 to {filteredLeads.length} of {filteredLeads.length} entries</p>
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <Button variant="ghost" className="h-10 rounded-none px-5 text-slate-400">Previous</Button>
                  <Button className="h-10 rounded-none bg-[#008d4c] px-4 text-white border-none hover:bg-[#00733e]">1</Button>
                  <Button variant="ghost" className="h-10 rounded-none px-5 text-slate-400">Next</Button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-[#00a65a] font-bold dark:text-zinc-400"><BarChart3 className="w-4 h-4" /><span className="text-[13px]">Total Leads <span className="text-slate-900 text-[28px] ml-1 dark:text-zinc-100">{filteredLeads.length}</span></span></div>
                <span className="text-[12px] text-slate-400">Last updated: Just now</span>
              </div>
              <div className="mt-5 rounded-[18px] border border-[#60a5fa] bg-[#eff6ff] p-5 flex gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-zinc-800 dark:bg-zinc-900">
                <Info className="w-4 h-4 text-[#2563eb] mt-0.5 dark:text-zinc-100" />
                <p className="text-[13px] text-[#1d4ed8] font-medium leading-relaxed pr-8 dark:text-zinc-100">Note: This table shows leads where company city matches your current branch (Sialkot). Role 55 users see filtered leads for their country and branch.</p>
              </div>
             </CardContent>
          </Card>

        </div>

        <div className="xl:col-span-4 space-y-6">
          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
            <CardHeader className="py-4 px-5 border-b border-slate-100 font-bold text-[16px] text-slate-800 dark:text-zinc-100 dark:border-zinc-800">Promotion Baners</CardHeader>
            <div className="p-4">
              <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#10203a_0%,#1f4f76_45%,#0ea5a4_100%)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white blur-2xl dark:bg-zinc-900" />
                <div className="absolute -bottom-14 left-24 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />
                <div className="relative flex min-h-[170px] flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-100/85">Lead Growth</p>
                      <h3 className="mt-3 max-w-[220px] text-[28px] font-bold leading-tight text-white">Expand branch pipeline with smarter follow-up.</h3>
                    </div>
                    <div className="rounded-full border border-white/15 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85 dark:bg-zinc-900">
                      Priority
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[13px] text-cyan-50/80">Track conversions, distribute leads faster, and keep daily actions visible.</p>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-white backdrop-blur-sm dark:bg-zinc-900">
                        Better coordination
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/80">
                      <span className="text-4xl leading-none">‹</span>
                      <span className="text-4xl leading-none">›</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
            <div className="py-4 px-5 border-b border-slate-100 font-bold text-[16px] text-slate-800 dark:text-zinc-100 dark:border-zinc-800">Projects Overview</div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {([
                ["Duplication", "duplication"],
                ["Add Customer", "add-customer"],
                ["Temporary", "temporary"],
                ["Over Time", ""],
                ["Leave Application", "leave-request"],
                ["Attendance", "attendance"],
                ["Add Uae Customer", "add-uae"],
                ["View Uae Customer", "view-uae"],
                ["Project Report", "project-report"],
                ["View Lead Followup Report", "followup-report"]
              ] as [string, string][]).map(([l, id], idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (id === "attendance") { setLocation("/hr/attendance"); } else if (id === "leave-request") { setLocation("/hr/leave-request"); } else if (id !== "") {
                      setCurrentView(id as "dashboard" | "duplication" | "add-customer" | "temporary" | "view-uae" | "add-uae" | "followup-report" | "project-report");
                    }
                  }}
                  className="flex items-center justify-between h-11 px-4 rounded-[14px] bg-[linear-gradient(180deg,#fafcfc_0%,#f2f6f5_100%)] hover:bg-emerald-50/60 group font-bold text-[13px] text-slate-700 transition-all border border-slate-100 outline-none cursor-pointer shadow-sm hover:-translate-y-0.5 hover:border-emerald-100 dark:border-zinc-800 dark:text-zinc-400"
                >
                  <span className="truncate">{l}</span>
                  <div className="w-1.5 h-2.5 border-r-2 border-b-2 border-slate-400 group-hover:border-[#00a65a] rotate-[-45deg] scale-x-50 translate-y-[-1px] dark:border-zinc-800" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
             <div className="py-4 px-5 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
               <span className="font-bold text-[16px] text-slate-800 dark:text-zinc-100">Upload Leads</span>
               <PlusCircle onClick={() => setShowUploadModal(true)} className="w-4 h-4 text-emerald-500 cursor-pointer hover:text-emerald-700 transition-colors" />
             </div>
             <CardContent className="p-5 flex items-center gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f8fbff_100%)]">
               <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center font-bold text-lg">X</div>
               <div className="flex-1 min-w-0"><p className="text-[14px] font-bold text-slate-800 dark:text-zinc-100">Template.xlsx</p><p className="text-[12px] text-slate-400">Size : 133 KB</p></div>
               <a href="/api/leads/template" download="Template.xlsx" title="Download Template">
                 <Download className="w-4 h-4 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors" />
               </a>
             </CardContent>
           </Card>

          <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
             <CardHeader className="py-4 px-5 border-b border-slate-100 font-bold text-[16px] text-slate-800 dark:text-zinc-100 dark:border-zinc-800">Important</CardHeader>
             <div className="grid grid-cols-2 gap-3 p-4">
              {[ ["Notice", "0"], ["Complaints", "30(5800)", "text-slate-700"], ["Event", "38"], ["Login Time", "05:29 PM"] ].map(([l, v, c], i) => (
                <div key={i} className="flex items-center justify-between rounded-[14px] bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f6_100%)] px-4 py-3 shadow-sm">
                  <span className="text-[14px] font-medium text-slate-500 dark:text-zinc-400">{l}</span>
                  <span className={`text-[14px] font-bold italic ${c || "text-slate-900"}`}>{v}</span>
                </div>
              ))}
             </div>
           </Card>
        </div>
      </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
              <CardHeader className="py-4 px-5 border-b border-slate-100 font-bold text-slate-800 text-[16px] truncate dark:text-zinc-100 dark:border-zinc-800">Daily Expected Client</CardHeader>
              <CardContent className="p-4">
                <Table>
                  <TableHeader className="bg-white dark:bg-zinc-900">
                    <TableRow className="h-10 hover:bg-transparent">
                      {["No#", "Company", "Meeting", "Method", "Note", "Next Contact"].map((head) => (
                        <TableHead key={head} className="font-bold text-[13px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{head}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingFollowups ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-slate-500 dark:text-zinc-400">Loading expected clients...</TableCell></TableRow>
                    ) : expectedClients.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-slate-500 dark:text-zinc-400">No expected clients today.</TableCell></TableRow>
                    ) : (
                      expectedClients.slice(0, 5).map((fc: any, i: number) => (
                        <TableRow key={fc.id} className="hover:bg-slate-50 border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{i + 1}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-[#00a65a] font-bold dark:text-zinc-400">{fc.company || fc.companyName}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{fc.purpose || "Follow up"}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{fc.method || "Call"}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 max-w-[150px] truncate dark:text-zinc-300">{fc.notes || "-"}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{new Date(fc.dueAt || fc.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
              <CardHeader className="py-4 px-5 border-b border-slate-100 font-bold text-slate-800 text-[16px] truncate dark:text-zinc-100 dark:border-zinc-800">Today Add Leads</CardHeader>
              <CardContent className="p-4">
                <Table>
                  <TableHeader className="bg-white dark:bg-zinc-900">
                    <TableRow className="h-10 hover:bg-transparent">
                      {["Company", "Added By", "Time", "Date", "Status"].map((head) => (
                        <TableHead key={head} className="font-bold text-[13px] text-slate-700 whitespace-nowrap dark:text-zinc-400">{head}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCustomers ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-slate-500 dark:text-zinc-400">Loading leads...</TableCell></TableRow>
                    ) : allLeads.slice(0, 5).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-slate-500 dark:text-zinc-400">No leads added today.</TableCell></TableRow>
                    ) : (
                      allLeads.slice(0, 5).map((lead: any) => (
                        <TableRow key={lead.id} className="hover:bg-slate-50 border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                           <TableCell className="px-4 py-3 text-[13px] text-[#00a65a] font-bold dark:text-zinc-400">{lead.companyName}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{lead.createdBy || "System"}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300">{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                           <TableCell className="px-4 py-3 text-[13px] text-slate-600 dark:text-zinc-300"><Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">New</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
        </div>

        <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-zinc-900">
          <CardHeader className="py-4 px-5 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
            <CardTitle className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">Team Work Performance</CardTitle>
            <div className="flex gap-2"><Input className="h-10 w-36 rounded-xl bg-slate-50/60 text-[12px] border-slate-200 dark:border-zinc-800" placeholder="Start Date" /><Input className="h-10 w-36 rounded-xl bg-slate-50/60 text-[12px] border-slate-200 dark:border-zinc-800" placeholder="End Date" /></div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <Badge className="bg-[#f0f1f4] text-slate-700 font-bold mb-4 rounded-full px-4 py-2 shadow-none dark:bg-zinc-900 dark:text-zinc-400">All Team</Badge>
            <div className="overflow-x-auto border-t border-slate-100 pt-4 dark:border-zinc-800">
              <Table>
                <TableHeader className="bg-[#dcf3ea] dark:bg-zinc-900">
                  <TableRow className="h-12">{["Name", "Leads", "Update Leads", "Follow", "Not Follow", "A- Customer", "B+ Customer", "B Customer", "B- Customer", "Call Connected", "Not Response", "Appointment", "Meeting"].map(h => (<TableHead key={h} className="font-bold text-slate-800 text-[11px] px-4 whitespace-nowrap dark:text-zinc-100">{h}</TableHead>))}</TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingActivities ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-6 text-slate-500 font-bold dark:text-zinc-400">Loading Performance Metrics...</TableCell>
                    </TableRow>
                  ) : teamActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-6 text-slate-500 font-bold dark:text-zinc-400">No activity recorded for this period.</TableCell>
                    </TableRow>
                  ) : (
                    teamActivities.map((row: any) => (
                      <TableRow key={row.userId} className="hover:bg-slate-50 border-b border-slate-100 text-slate-600 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                        <TableCell className="px-4 py-3 text-[12px] font-bold">{row.name}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.mobile?.done + row.methods?.whatsapp?.done + row.methods?.email?.done}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.email?.done}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.whatsapp?.done}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">0</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-bold text-red-500">{row.methods?.aMinus?.done || 0}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">{row.methods?.bPlus?.done || 0}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">0</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">0</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.mobile?.done || 0}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">0</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.appointment?.done || 0}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px]">{row.methods?.meeting?.done || 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- UPLOAD EXCEL MODAL ---- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">Upload Excel File</h2>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">Source</label>
                <div className="relative">
                  <select className="w-full h-11 border border-slate-200 rounded-lg px-3 text-sm appearance-none outline-none bg-white text-slate-500 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                    <option value="">Choose...</option>
                    <option>LinkedIn</option>
                    <option>Facebook</option>
                    <option>Walk-in</option>
                    <option>Cold Call</option>
                    <option>Referral</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">File</label>
                <input type="file" accept=".xlsx,.xls,.csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-slate-300 file:text-sm file:font-bold file:bg-white file:text-slate-700 hover:file:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer dark:text-zinc-400 dark:border-zinc-800" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50 dark:bg-zinc-900">
              <Button variant="outline" onClick={() => setShowUploadModal(false)} className="h-10 px-6 font-bold text-slate-600 border-slate-300 dark:text-zinc-300 dark:border-zinc-800">Close</Button>
              <Button onClick={() => { setShowUploadModal(false); toast({ title: "Success", description: "Leads uploaded successfully." }); }} className="h-10 px-6 bg-[#008d4c] hover:bg-[#00733e] text-white font-bold border-none">Save</Button>
            </div>
          </div>
        </div>
      )}
      {transferModalLeadId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 dark:bg-zinc-900">
            <Button variant="ghost" className="absolute right-4 top-4 h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-full" onClick={() => setTransferModalLeadId(null)}>
              <X className="h-4 w-4" />
            </Button>
            <h2 className="text-[20px] font-bold text-[#243b53] mb-6 dark:text-zinc-100">Transfer Lead</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2 dark:text-zinc-400">Transfer Type</label>
                <div className="relative">
                  <select 
                    value={transferType} 
                    onChange={e => { setTransferType(e.target.value as any); setTransferTarget(""); }} 
                    className="w-full bg-slate-50 border-slate-200 h-11 text-[13px] font-medium rounded-xl outline-none appearance-none px-4 border shadow-sm focus:border-emerald-500 focus:bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800"
                  >
                    <option value="user">Specific User</option>
                    <option value="city">Another City (Return to Pool)</option>
                    <option value="country">Another Country (Return to Pool)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2 dark:text-zinc-400">
                  {transferType === "user" ? "Select User" : transferType === "city" ? "Destination City" : "Destination Country"}
                </label>
                <div className="relative">
                  {transferType === "user" ? (
                    <>
                      <select 
                        value={transferTarget} 
                        onChange={e => setTransferTarget(e.target.value)} 
                        className="w-full bg-slate-50 border-slate-200 h-11 text-[13px] font-medium rounded-xl outline-none appearance-none px-4 border shadow-sm focus:border-emerald-500 focus:bg-white transition-colors dark:bg-zinc-900 dark:border-zinc-800"
                      >
                        <option value="">Choose a user...</option>
                        {systemUsers.filter((u: any) => u.role === "sales_executive").map((u: any) => (
                          <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </>
                  ) : transferType === "city" ? (
                    <Input 
                      placeholder="e.g. Dubai, Sialkot" 
                      value={transferTarget} 
                      onChange={e => setTransferTarget(e.target.value)} 
                      className="h-11 rounded-xl text-[13px] bg-slate-50 focus:bg-white transition-colors dark:bg-zinc-900" 
                    />
                  ) : (
                    <Input 
                      placeholder="e.g. UAE, Pakistan" 
                      value={transferTarget} 
                      onChange={e => setTransferTarget(e.target.value)} 
                      className="h-11 rounded-xl text-[13px] bg-slate-50 focus:bg-white transition-colors dark:bg-zinc-900" 
                    />
                  )}
                </div>
                {transferType !== "user" && (
                  <p className="text-[11px] text-slate-500 mt-2 ml-1 dark:text-zinc-400">
                    This will remove the current assignment and place the lead into the unassigned pool for the target {transferType}.
                  </p>
                )}
              </div>
              <div className="pt-2">
                <Button 
                  onClick={() => transferTarget && transferLeadMutation.mutate({ leadId: transferModalLeadId, type: transferType, target: transferTarget })} 
                  disabled={!transferTarget || transferLeadMutation.isPending} 
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
                >
                  {transferLeadMutation.isPending ? "Transferring..." : "Confirm Transfer"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
