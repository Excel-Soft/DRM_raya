import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Search } from "lucide-react";

const eventOptions = [
  "RC Event-Logistics AB",
  "NC Seminar 13th May, 2025",
  "Business Communication Workshop",
  "Ignite Growth, Conquer New Markets",
  "Webinar - Breakthrough Market Strategies to dominate your Industry",
  "Traffic opportunities to Increse your Business",
  "The Ultimate Guide to Scaling your Business on Alibaba",
  "SEO Webinar",
  "Dont Just Dream it: Sell on Alibaba.com",
  "Digital Marketing Workshop"
];

const mockData = [
  {
    id: "01",
    eventType: "02",
    company: "03",
    esTime: "04",
    eeTime: "05",
    location: "06",
    speaker: "07",
    topic: "08",
    startTime: "09",
    endTime: "10",
    totalTime: "11",
    presentAbsent: "12",
    sale: "13",
    eventDate: "14"
  }
];

export default function EventReport() {
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [entries, setEntries] = useState("10");

  const filteredEvents = eventOptions.filter(e => e.toLowerCase().includes(eventSearch.toLowerCase()));

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] uppercase tracking-wide">
          WEB EXCELS EVENTS REPORT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-end gap-6 max-w-2xl">
              <div className="flex flex-col gap-2 w-full md:w-[400px]">
                <Label className="text-[13px] font-bold text-[#555]">Select Event</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                      <Input 
                        placeholder="Search event..." 
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {filteredEvents.map((ev, idx) => (
                        <SelectItem key={idx} value={ev} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {ev}
                        </SelectItem>
                      ))}
                      {filteredEvents.length === 0 && (
                        <div className="p-2 text-xs text-slate-500 text-center">No events found</div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              
              <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm">
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#555] mb-2">Event List</h2>
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#555]">Show</span>
                <Select value={entries} onValueChange={setEntries}>
                  <SelectTrigger className="h-8 w-[70px] bg-white border-slate-300 text-xs text-[#555] focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-[#555]">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#555]">Search:</span>
                <Input 
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="h-8 w-[200px] bg-white border-slate-300 text-xs focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-sm">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] hover:bg-[#d9f2e6]">
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">#</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Type</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Company</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">ES Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">EE Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Location</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Speaker</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Topic</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Start Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">End Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Total Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Present/Absent</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Sale</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {mockData.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                      <TableCell className="py-4 px-3 text-[#555]">{item.id}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.eventType}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.company}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.esTime}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.eeTime}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.location}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.speaker}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.topic}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.startTime}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.endTime}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.totalTime}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.presentAbsent}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.sale}</TableCell>
                      <TableCell className="py-4 px-3 text-[#555]">{item.eventDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination / Info */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-[#555]">
                Showing 1 to 1 of 1 entries
              </div>
              <div className="flex border border-slate-200 rounded-sm overflow-hidden">
                <button className="px-3 py-1.5 text-xs text-slate-400 bg-white cursor-not-allowed">Previous</button>
                <button className="px-3 py-1.5 text-xs text-white bg-[#00a65a] font-medium">1</button>
                <button className="px-3 py-1.5 text-xs text-slate-400 bg-white cursor-not-allowed border-l border-slate-200">Next</button>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
