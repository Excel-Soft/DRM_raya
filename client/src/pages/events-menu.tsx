import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";

export default function EventsMenu() {
  const [showForm, setShowForm] = useState(true);

  // State for menus list
  const [menus, setMenus] = useState<any[]>([]);

  // State for Form
  const [itemName, setItemName] = useState("");
  const [eventId, setEventId] = useState("");
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");

  const handleAddMenu = () => {
    const newMenu = {
      id: menus.length + 1,
      item: itemName,
      event: eventId || "General", // Placeholder if no event selected
      amount: parseFloat(amount) || 0,
      detail: detail,
      createDate: format(new Date(), "dd-MM-yyyy")
    };

    setMenus([...menus, newMenu]);

    // Clear form
    setItemName("");
    setEventId("");
    setAmount("");
    setDetail("");
  };

  const totalAmount = menus.reduce((sum, menu) => sum + menu.amount, 0);

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold tracking-wide uppercase">
        <span className="text-gray-700 dark:text-zinc-400">CREATE EVENT MENU</span>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD EVENT MENU
        </button>
      </div>

      <div className="space-y-6">
        {/* Add Event Menu Form */}
        {showForm && (
          <Card className="shadow-sm border-t border-t-gray-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Item</label>
                  <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Enter the event name" className="text-sm h-9" />
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
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Amount</label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Detail</label>
                  <Input value={detail} onChange={e => setDetail(e.target.value)} placeholder="add detail" className="text-sm h-9" />
                </div>
              </div>

              <Button onClick={handleAddMenu} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
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
                  <th className="px-4 py-4 whitespace-nowrap">Item</th>
                  <th className="px-4 py-4 whitespace-nowrap">Event</th>
                  <th className="px-4 py-4 whitespace-nowrap">Amount</th>
                  <th className="px-4 py-4 whitespace-nowrap">Detail</th>
                  <th className="px-4 py-4 whitespace-nowrap">Create</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu, idx) => (
                  <tr key={menu.id} className="border-b transition-colors">
                    <td className="px-4 py-4 text-[#d35400] font-medium">{idx + 1}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{menu.item}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{menu.event}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{menu.amount}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{menu.detail}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{menu.createDate}</td>
                  </tr>
                ))}
                
                {/* Total Row */}
                <tr className="bg-gray-50/50 font-bold border-b-0">
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4 text-gray-800 dark:text-zinc-100">Total</td>
                  <td className="px-4 py-4 text-gray-800 dark:text-zinc-100">{totalAmount}</td>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
