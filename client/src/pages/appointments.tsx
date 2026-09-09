import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { useLocation } from "wouter";
import { Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Appointment = {
  id: string;
  company: string;
  purpose: string;
  time: string;
};

type CustomerOption = { id: string; companyName: string; accountName: string };

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", purpose: "", time: "", location: "" });

  const { data, isLoading, refetch, isRefetching } = useQuery<Appointment[]>({
    queryKey: ["/api/sales/appointments", date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/appointments?date=${date}`);
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.customerId || !date) throw new Error("Customer ID and date are required");
      const res = await apiRequest("POST", "/api/sales/appointments", {
        customerId: form.customerId,
        purpose: form.purpose || "Meeting",
        date,
        time: form.time,
        location: form.location,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment created" });
      setCreateOpen(false);
      setForm({ customerId: "", purpose: "", time: "", location: "" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to create appointment", variant: "destructive" });
    },
  });

  const { data: customerList = [] } = useQuery<CustomerOption[]>({
    queryKey: ["/api/sales/customers", "appointments-picker"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/customers?pageSize=200");
      const json = await res.json();
      return json?.customers?.map((c: any) => ({
        id: c.id,
        companyName: c.companyName ?? c.company ?? "Unknown",
        accountName: c.accountName ?? c.account_holder ?? "",
      })) as CustomerOption[];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Sales / Appointments</p>
          <h1 className="text-2xl font-bold">Today&apos;s Appointments</h1>
          <CardDescription className="mt-1">View and manage your appointments for today.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isRefetching}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Customer ID</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(val) => setForm((f) => ({ ...f, customerId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName} {c.accountName ? `(${c.accountName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                    placeholder="Or paste customer UUID"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Purpose</Label>
                  <Input
                    value={form.purpose}
                    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="Meeting purpose"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Location (optional)</Label>
                    <Input
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="Zoom / Office"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Appointments</CardTitle>
            <CardDescription>Showing appointments for {format(parseISO(`${date}T00:00:00Z`), "PPP")}.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading appointments...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No appointments for this date.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell>{apt.company}</TableCell>
                    <TableCell>{apt.purpose}</TableCell>
                    <TableCell>{apt.time ? format(parseISO(apt.time), "hh:mm a") : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
