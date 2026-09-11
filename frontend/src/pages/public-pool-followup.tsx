import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2, Eye, PlusCircle } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { FollowCustomerDialog } from "@/components/FollowCustomerDialog"; // We'll assume this exists, or we redirect. Wait, let me just prefill and redirect to add-customer since it's unowned.

export default function PublicPoolFollowup() {
  const [, setLocation] = useLocation();
  const [selectedMainService, setSelectedMainService] = useState<string | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // 1. Fetch Main Services
  const { data: mainServices, isLoading: isLoadingMain } = useQuery({
    queryKey: ["public-pool-followup", "main-services"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/public-pool-followup/main-services");
      return await res.json();
    },
  });

  const mainServiceNames: Record<string, string> = {
    "1": "Alibaba Membership",
    "2": "Alibaba Services",
    "3": "Design Development",
    "4": "Domain Hosting",
    "5": "AI Services",
  };

  // 2. Fetch Sub Services when a main service is selected
  const { data: subServices, isLoading: isLoadingSub } = useQuery({
    queryKey: ["public-pool-followup", "sub-services", selectedMainService],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/public-pool-followup/sub-services?mainServiceId=${selectedMainService}`);
      return await res.json();
    },
    enabled: !!selectedMainService,
  });

  // 3. Fetch Customers when a sub service is selected
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["public-pool-followup", "customers", selectedSubService, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/public-pool-followup/customers?subService=${encodeURIComponent(selectedSubService || "")}&page=${page}`);
      return await res.json();
    },
    enabled: !!selectedSubService,
  });

  const handlePickUp = (customer: any) => {
    // Save to session storage and navigate to Add Customer (Pick Up Flow)
    sessionStorage.setItem("pickupPublicPool", JSON.stringify(customer));
    setLocation(`/sales/add-customer`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 pb-24">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Customer" },
          { label: "Public Pool (Follow up)", active: true },
        ]}
      />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 mt-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Public Pool (Follow up)</h1>
          <p className="text-slate-500">View and follow-up with companies inactive for 60+ days.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Services Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Main Services</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMain ? (
              <div className="flex items-center justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.entries(mainServiceNames).map(([id, name]) => {
                  const count = mainServices?.[id] || 0;
                  const isSelected = selectedMainService === id;
                  return (
                    <Button
                      key={id}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        setSelectedMainService(id);
                        setSelectedSubService(null);
                        setPage(1);
                      }}
                      className="relative min-w-[150px] justify-between"
                    >
                      <span>{name}</span>
                      <Badge variant={isSelected ? "secondary" : "default"} className="ml-2">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sub Services Card */}
        {selectedMainService && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sub Services</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSub ? (
                <div className="flex items-center justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {subServices?.map((sub: any) => {
                    const isSelected = selectedSubService === sub.name;
                    return (
                      <Button
                        key={sub.name}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => {
                          setSelectedSubService(sub.name);
                          setPage(1);
                        }}
                        size="sm"
                        className="relative justify-between"
                      >
                        <span>{sub.name}</span>
                        <Badge variant={isSelected ? "secondary" : "default"} className="ml-2 bg-slate-200 text-slate-700 hover:bg-slate-300">
                          {sub.count}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Customers Table Card */}
        {selectedSubService && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Companies for {selectedSubService}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCustomers ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Company ID</TableHead>
                          <TableHead>Co Name</TableHead>
                          <TableHead>Acc Holder</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Contact No</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customersData?.data?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                              No companies found matching the criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          customersData?.data?.map((customer: any) => (
                            <TableRow key={customer.id}>
                              <TableCell className="font-medium text-blue-600">{customer.com_id || "-"}</TableCell>
                              <TableCell>{customer.cname || "Unknown"}</TableCell>
                              <TableCell>{customer.account_name || "-"}</TableCell>
                              <TableCell>{customer.email || "-"}</TableCell>
                              <TableCell>{customer.phone || "-"}</TableCell>
                              <TableCell>{customer.assigned_to || <Badge variant="outline" className="text-slate-500">Unassigned</Badge>}</TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button size="sm" variant="outline" onClick={() => setLocation(`/sales/customers/${customer.id}`)}>
                                  <Eye className="w-4 h-4 mr-1" /> View
                                </Button>
                                {/* Since user doesn't own it, we redirect to Pick Up (Add Customer page) which is how they claim and edit */}
                                <Button size="sm" onClick={() => handlePickUp({
                                  ...customer,
                                  company: customer.cname,
                                  accountHolder: customer.account_name,
                                })}>
                                  <PlusCircle className="w-4 h-4 mr-1" /> Pick Up / Followup
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoadingCustomers}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-500">Page {page}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!customersData?.hasNextPage || isLoadingCustomers}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
