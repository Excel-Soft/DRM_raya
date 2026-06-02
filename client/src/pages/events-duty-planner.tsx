import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";

export default function EventsDutyPlanner() {
  const [showForm, setShowForm] = useState(true);

  // State for plans list
  const [plans, setPlans] = useState<any[]>([
    {
      id: 1,
      person: "Muhammad Shahbaz",
      event: "RC Event-Logistics AB",
      duty: "Management",
      detail: "Oversee entire operation",
      createDate: format(new Date(), "dd-MM-yyyy")
    }
  ]);

  // State for Form
  const [employee, setEmployee] = useState("");
  const [eventId, setEventId] = useState("");
  const [dutyName, setDutyName] = useState("");
  const [detail, setDetail] = useState("");

  const handleAddPlan = () => {
    const newPlan = {
      id: plans.length + 1,
      person: employee || "Unassigned",
      event: eventId || "General",
      duty: dutyName || "N/A",
      detail: detail || "None",
      createDate: format(new Date(), "dd-MM-yyyy")
    };

    setPlans([...plans, newPlan]);

    // Clear form
    setEmployee("");
    setEventId("");
    setDutyName("");
    setDetail("");
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold tracking-wide uppercase">
        <span className="text-gray-700 dark:text-zinc-400">CREATE EVENT DUTY</span>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD PLAN
        </button>
      </div>

      <div className="space-y-6">
        {/* Add Plan Form */}
        {showForm && (
          <Card className="shadow-sm border-t border-t-gray-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Employee</label>
                  <Select value={employee} onValueChange={setEmployee}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Muhammad Shahbaz">Muhammad Shahbaz</SelectItem>
                      <SelectItem value="Ali Raza">Ali Raza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event</label>
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RC Event-Logistics AB">RC Event-Logistics AB</SelectItem>
                      <SelectItem value="Other Event">Other Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Duty</label>
                  <Input value={dutyName} onChange={e => setDutyName(e.target.value)} placeholder="enter the duty name" className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Detail</label>
                  <Input value={detail} onChange={e => setDetail(e.target.value)} placeholder="add detail" className="text-sm h-9" />
                </div>
              </div>

              <Button onClick={handleAddPlan} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
                Submit
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        <Card className="shadow-sm border-t border-t-gray-200 bg-white dark:bg-zinc-900">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-xs text-gray-700 bg-white border-b font-bold dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-4 whitespace-nowrap">#</th>
                  <th className="px-4 py-4 whitespace-nowrap">Person</th>
                  <th className="px-4 py-4 whitespace-nowrap">Event</th>
                  <th className="px-4 py-4 whitespace-nowrap">Duty</th>
                  <th className="px-4 py-4 whitespace-nowrap">Detail</th>
                  <th className="px-4 py-4 whitespace-nowrap">Create</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, idx) => (
                  <tr key={plan.id} className="border-b transition-colors last:border-b-0">
                    <td className="px-4 py-4 text-[#d35400] font-medium">{idx + 1}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{plan.person}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{plan.event}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{plan.duty}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{plan.detail}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{plan.createDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
