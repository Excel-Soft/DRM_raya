import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Tag, Target, ArrowLeftRight, Download, Play, CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { getAuthHeader } from "@/lib/queryClient";

const OVERRIDE_ROLES = ["admin", "super_admin", "superadmin", "sales_manager"];

export default function MarketingManagerDashboard() {
  const [activeEventTab, setActiveEventTab] = useState<"today" | "week">("today");
  const [importOpen, setImportOpen] = useState(false);

  const role = (() => {
    try {
      return (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
    } catch {
      return "";
    }
  })();
  const canOverride = OVERRIDE_ROLES.includes(role);

  async function downloadTemplate() {
    try {
      const res = await fetch("/api/leads/template", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lead-import-template.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Surface failure honestly rather than silently downloading a fake file.
      alert("Could not download the template. Please try again.");
    }
  }

  const { data: fetchedLeads, isLoading: leadsLoading } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Show only real leads returned by the API. Never fall back to fabricated
  // leads — empty results render the dedicated "No leads found" state below.
  const leads = Array.isArray(fetchedLeads) ? fetchedLeads : [];

  const [topSellingPeriod, setTopSellingPeriod] = useState("ld");
  const { data: eventsRes } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/events?pageSize=200"],
  });
  const allEvents = Array.isArray(eventsRes?.data) ? eventsRes!.data : [];

  const periodStart = (() => {
    const d = new Date();
    if (topSellingPeriod === "ld") d.setHours(0, 0, 0, 0);
    else if (topSellingPeriod === "wc") d.setDate(d.getDate() - 6);
    else if (topSellingPeriod === "mc") d.setDate(d.getDate() - 29);
    else if (topSellingPeriod === "qc") d.setDate(d.getDate() - 89);
    else if (topSellingPeriod === "yc") d.setDate(d.getDate() - 364);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const eventsInPeriod = allEvents.filter((e) => e.eventDate && new Date(e.eventDate) >= periodStart);
  const totalEventsCount = eventsInPeriod.length;
  const seminarCount = eventsInPeriod.filter((e) => e.eventType === "Seminar").length;
  const webinarCount = eventsInPeriod.filter((e) => e.eventType === "Webinar").length;
  const attendingCount = eventsInPeriod.reduce((sum, e) => sum + (Number(e.attendeeCount) || 0), 0);
  const eventCostTotal = eventsInPeriod.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const now = new Date();
  const nextEvent = allEvents
    .filter((e) => e.eventDate && new Date(e.eventDate) >= now)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfThisWeek = new Date(startOfToday);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 6);
  endOfThisWeek.setHours(23, 59, 59, 999);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const inDateRange = (event: any, from: Date, to: Date) => {
    if (!event.eventDate) return false;
    const d = new Date(event.eventDate);
    return d >= from && d <= to;
  };
  const todayEvents = allEvents.filter((e) => inDateRange(e, startOfToday, endOfToday));
  const thisWeekEvents = allEvents.filter((e) => inDateRange(e, startOfToday, endOfThisWeek));
  const monthlyEvents = allEvents
    .filter((e) => inDateRange(e, monthStart, monthEnd))
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  const [allEventsTypeFilter, setAllEventsTypeFilter] = useState("all");
  const filteredAllEvents = allEvents
    .filter((e) => allEventsTypeFilter === "all" || e.eventType === (allEventsTypeFilter === "seminar" ? "Seminar" : "Webinar"))
    .sort((a, b) => new Date(b.eventDate || 0).getTime() - new Date(a.eventDate || 0).getTime());

  const speakerSummary = (event: any) => {
    const names = Array.isArray(event.speakers) ? event.speakers.map((s: any) => s.speakerName).filter(Boolean) : [];
    return names.length ? names.join(", ") : "-";
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold text-gray-500 uppercase tracking-wide dark:text-zinc-400">
        <span className="text-gray-700 dark:text-zinc-400">DASHBOARD</span>
        <span className="mx-2">/</span>
        <span className="text-[#00a65a] dark:text-zinc-400">MARKETING DEPARTMENT</span>
        <span className="mx-2">/</span>
        <span className="text-gray-500 dark:text-zinc-400">MARKETING MANAGER</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Top Selling */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 flex flex-row items-center justify-between dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Top Selling</CardTitle>
              <div className="w-24">
                <Select value={topSellingPeriod} onValueChange={setTopSellingPeriod}>
                  <SelectTrigger className="h-8 text-xs font-bold bg-white border-gray-300 dark:bg-zinc-900 dark:border-zinc-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ld">LD</SelectItem>
                    <SelectItem value="wc">WC</SelectItem>
                    <SelectItem value="mc">MC</SelectItem>
                    <SelectItem value="qc">QC</SelectItem>
                    <SelectItem value="yc">YC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-5 bg-slate-50 dark:bg-zinc-900">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Total Events" value={String(totalEventsCount)} icon={Users} />
                <StatCard title="Seminar" value={String(seminarCount)} icon={ArrowLeftRight} />
                <StatCard title="Webinar" value={String(webinarCount)} icon={Tag} />
                <StatCard title="Next Event" value={nextEvent ? format(new Date(nextEvent.eventDate), "dd MMM") : "None"} icon={Target} />
                <StatCard title="Attending" value={String(attendingCount)} icon={Target} />
                <StatCard title="Event Cost" value={`${eventCostTotal.toLocaleString()} Rs`} icon={Tag} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 flex flex-row items-center justify-between dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Current Event</CardTitle>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveEventTab("today")}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${activeEventTab === "today" ? "bg-[#00a65a] text-white shadow-sm" : "bg-transparent text-gray-600 dark:text-slate-300 hover:bg-gray-100"}`}
                >
                  Today Events
                </button>
                <button 
                  onClick={() => setActiveEventTab("week")}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${activeEventTab === "week" ? "bg-[#00a65a] text-white shadow-sm" : "bg-transparent text-gray-600 dark:text-slate-300 hover:bg-gray-100"}`}
                >
                  This Week Events
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold">Start Time</th>
                    <th className="px-4 py-3 font-bold">End Time</th>
                    <th className="px-4 py-3 font-bold">Speaker/Time</th>
                    <th className="px-4 py-3 font-bold">Event Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = activeEventTab === "today" ? todayEvents : thisWeekEvents;
                    if (!rows.length) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
                            No events {activeEventTab === "today" ? "today" : "this week"}.
                          </td>
                        </tr>
                      );
                    }
                    return rows.map((event) => (
                      <tr key={event.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.id.slice(0, 6)}</td>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-zinc-400">{event.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${event.eventType === 'Webinar' ? 'bg-blue-100 text-blue-700' : event.eventType === 'Seminar' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {event.eventType || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.startTime || "-"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.endTime || "-"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{speakerSummary(event)}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{format(new Date(event.eventDate), "dd/MM/yyyy")}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">All Uploaded Leads <span className="text-xs font-normal text-gray-500 dark:text-zinc-400">(All leads created by you)</span></CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">Company</th>
                    <th className="px-4 py-3 font-bold">Created By</th>
                    <th className="px-4 py-3 font-bold">Created Time</th>
                    <th className="px-4 py-3 font-bold">Created Date</th>
                    <th className="px-4 py-3 font-bold">Country</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">Loading leads...</td>
                    </tr>
                  ) : leads && leads.length > 0 ? (
                    leads.slice(0, 5).map((lead, i) => (
                      <tr key={lead.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-zinc-400">{lead.companyName || lead.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{lead.contactPerson || "N/A"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{lead.createdAt ? format(new Date(lead.createdAt), "hh:mm a") : "N/A"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{lead.createdAt ? format(new Date(lead.createdAt), "dd/MM/yyyy") : "N/A"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{lead.country || "N/A"}</td>
                        <td className="px-4 py-3">
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                            {lead.status || "Lead"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-zinc-400">
                        <div className="flex flex-col items-center justify-center">
                          <span className="w-8 h-8 rounded-full border border-gray-300 text-gray-400 flex items-center justify-center text-lg mb-2 dark:border-zinc-800">i</span>
                          <div className="font-bold text-gray-600 dark:text-zinc-300">No leads found</div>
                          <div className="text-xs mt-1">You haven't uploaded any leads yet</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Promotion Baners</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50 dark:bg-zinc-900">
              <div className="relative w-full h-32 rounded overflow-hidden shadow group">
                <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80" alt="Promotion Banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer p-1">
                  &lt;
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer p-1">
                  &gt;
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Projects Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-3">
                <ProjectLink text="Duplication" href="/sales/duplicate-checker" />
                <ProjectLink text="Add Customer" href="/sales/add-customer" />
                <ProjectLink text="Temporary" href="/customer/temporary-contact" />
                <ProjectLink text="Over Time" href="/hr/overtime" />
                <ProjectLink text="Leave Application" href="/hr/leave-request" />
                <ProjectLink text="Attendance" href="/hr/attendance" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t border-t-gray-200">
            <CardHeader className="border-b bg-white py-3 flex flex-row items-center justify-between dark:bg-zinc-900">
              <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Upload Leads</CardTitle>
              <button 
                className="w-6 h-6 rounded-full bg-[#00a65a] flex items-center justify-center text-white hover:bg-[#008d4c] transition-colors shadow-sm"
                onClick={() => setImportOpen(true)}
                title="Import Leads"
                data-testid="button-open-import"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
              </button>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50 dark:bg-zinc-900">
              <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#dcfce7] rounded-full flex items-center justify-center text-[#166534] font-bold text-xs tracking-wider dark:bg-zinc-900 dark:text-zinc-100">
                    EXCEL
                  </div>
                  <div>
                    <h4 className="font-bold text-[#344767] text-[15px] dark:text-zinc-100">lead-import-template.csv</h4>
                    <p className="text-[13px] text-gray-500 mt-0.5 dark:text-zinc-400">Expected columns for import</p>
                  </div>
                </div>
                <button 
                  className="border border-gray-800 rounded-[4px] p-0.5 hover:bg-gray-100 transition-colors text-[#344767] dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100"
                  title="Download Template"
                  data-testid="button-template-download"
                  onClick={downloadTemplate}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Card className="shadow-sm border-t border-t-gray-200">
          <CardHeader className="border-b bg-white py-3 dark:bg-zinc-900">
            <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Monthly Event</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Start Time</th>
                  <th className="px-4 py-3 font-bold">End Time</th>
                  <th className="px-4 py-3 font-bold">Speaker/Time</th>
                  <th className="px-4 py-3 font-bold">Event Date</th>
                </tr>
              </thead>
              <tbody>
                {monthlyEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">No events this month.</td>
                  </tr>
                ) : (
                  monthlyEvents.map((event) => (
                    <tr key={event.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.id.slice(0, 6)}</td>
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-zinc-400">{event.name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${event.eventType === 'Webinar' ? 'bg-blue-100 text-blue-700' : event.eventType === 'Seminar' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                          {event.eventType || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.startTime || "-"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.endTime || "-"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{speakerSummary(event)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{format(new Date(event.eventDate), "dd/MM/yyyy")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t border-t-gray-200">
          <CardHeader className="border-b bg-white py-3 flex flex-row items-center justify-between dark:bg-zinc-900">
            <CardTitle className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">All Events</CardTitle>
            <div className="w-32">
              <Select value={allEventsTypeFilter} onValueChange={setAllEventsTypeFilter}>
                <SelectTrigger className="h-8 text-xs bg-white border-gray-300 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="seminar">Seminar</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-bold">No#</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Venue</th>
                  <th className="px-4 py-3 font-bold">Event Date</th>
                  <th className="px-4 py-3 font-bold">Attendees</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">No events found.</td>
                  </tr>
                ) : (
                  filteredAllEvents.map((event, i) => (
                    <tr key={event.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-zinc-400">{event.name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${event.eventType === 'Webinar' ? 'bg-blue-100 text-blue-700' : event.eventType === 'Seminar' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                          {event.eventType || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.venue || "-"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.eventDate ? format(new Date(event.eventDate), "dd/MM/yyyy") : "-"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{event.attendeeCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <Link href="/events/add">
                          <button
                            className="text-[#00a65a] hover:text-[#008d4c] transition-colors font-bold p-1 rounded hover:bg-green-50 dark:text-zinc-400"
                            title="Manage this event"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        canOverride={canOverride}
      />
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-md shadow-sm p-4 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
      <div>
        <div className="text-[12px] font-semibold text-gray-500 mb-1 dark:text-zinc-400">{title}</div>
        <div className="text-[20px] font-bold text-gray-700 dark:text-zinc-400">{value}</div>
      </div>
      <div className="w-10 h-10 rounded-full bg-[#00a65a] text-white flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function ProjectLink({ text, href }: { text: string, href: string }) {
  return (
    <Link href={href}>
      <div className="bg-[#f8f9fa] hover:bg-gray-200 text-[#4c5f70] text-[13px] font-medium py-2.5 px-3 flex justify-between items-center cursor-pointer rounded transition-colors border border-transparent hover:border-gray-300 dark:bg-zinc-900 dark:text-zinc-400">
        <span>{text}</span>
        <Play className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
      </div>
    </Link>
  );
}
