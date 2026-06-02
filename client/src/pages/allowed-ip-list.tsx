import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data based on the screenshot
const initialData = [
  { id: 1, ip: "154.192.169.111", location: ",", browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36", ipUser: "", createdAt: "2026-05-09 10:23:31", createdBy: "Muhammad Junaid Aazar" },
  { id: 2, ip: "59.103.99.67", location: ",", browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36", ipUser: "Izhaq KPK", createdAt: "2026-05-05 16:17:33", createdBy: "Muhammad Junaid Aazar" },
  { id: 3, ip: "39.35.70.13", location: ",", browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36", ipUser: "", createdAt: "2026-01-20 15:21:45", createdBy: "Muhammad Junaid Aazar" },
  { id: 4, ip: "39.53.48.12", location: ",", browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36", ipUser: "Habib", createdAt: "2025-10-03 10:21:08", createdBy: "Faheem Ullah" },
  { id: 5, ip: "35.50.12.219", location: ",", browser: "", ipUser: "Gulburg Office", createdAt: "2025-10-01 16:27:20", createdBy: "Muhammad Habib Ahmed" },
  { id: 6, ip: "223.123.6.156", location: ",", browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36", ipUser: "Habib home", createdAt: "2025-08-25 15:55:50", createdBy: "Muhammad Junaid Aazar" },
  { id: 7, ip: "72.255.14.26", location: ",", browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36", ipUser: "Mr. Shehbaz Home Sialkot", createdAt: "2025-07-30 18:54:48", createdBy: "Muhammad Junaid Aazar" },
  { id: 8, ip: "58.65.214.96", location: ",", browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36", ipUser: "", createdAt: "2025-07-19 12:20:13", createdBy: "Muhammad Habib Ahmed" },
];

export default function AllowedIpList() {
  const { toast } = useToast();
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    ip: "",
    location: "",
    browser: "",
    ipUser: ""
  });

  const handleOpenDialog = () => {
    setFormData({ ip: "", location: "", browser: "", ipUser: "" });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.ip) {
      toast({ title: "Validation Error", description: "Allowed IP is required.", variant: "destructive" });
      return;
    }

    const newRecord = {
      id: data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1,
      ip: formData.ip,
      location: formData.location || ",",
      browser: formData.browser,
      ipUser: formData.ipUser,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      createdBy: sessionStorage.getItem("userName") || "Unknown User"
    };

    setData([...data, newRecord]);
    setIsDialogOpen(false);
    toast({ title: "Success", description: "DRM IP added successfully." });
  };

  const handleDelete = (id: number) => {
    setData(data.filter(item => item.id !== id));
    toast({ title: "Deleted", description: "DRM IP record has been removed." });
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto bg-white rounded-md shadow-sm border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h1 className="text-lg font-normal text-[#333]">DRM Allowed IPs</h1>
          <Button 
            onClick={handleOpenDialog}
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-4 rounded-[4px] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <Table className="w-full text-[13px] whitespace-nowrap">
            <TableHeader>
              <TableRow className="border-b-0 bg-[#f8f9fa] hover:bg-[#f8f9fa]">
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">ID</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Allowed IP</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Location</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Browser</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">IP User</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Created At</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Created By</TableHead>
                <TableHead className="py-3 px-4 font-bold text-[#333] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {data.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                  <TableCell className="py-3 px-4 text-[#555]">{item.id}</TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="bg-[#00a65a] text-white px-2 py-0.5 rounded-[4px] text-xs font-medium">
                      {item.ip}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#555]">{item.location}</TableCell>
                  <TableCell className="py-3 px-4 text-[#555] max-w-[300px] truncate" title={item.browser}>
                    {item.browser}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#555]">{item.ipUser}</TableCell>
                  <TableCell className="py-3 px-4 text-[#555]">{item.createdAt}</TableCell>
                  <TableCell className="py-3 px-4 text-[#555]">{item.createdBy}</TableCell>
                  <TableCell className="py-3 px-4 text-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(item.id)}
                      className="h-7 w-7 bg-[#f56954] hover:bg-[#d73925] text-white rounded-[4px]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add DRM IP Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-md border-0">
          <DialogHeader className="p-4 border-b border-slate-100 bg-[#f8f9fa]">
            <DialogTitle className="text-lg font-medium text-[#333] flex justify-between items-center">
              Add DRM IP
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-5">
            {/* Allowed IP */}
            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">
                Allowed IP <span className="text-red-500">*</span>
              </Label>
              <Input 
                placeholder="e.g., 192.168.1.1" 
                value={formData.ip}
                onChange={(e) => setFormData({...formData, ip: e.target.value})}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
              />
              <p className="text-[11px] text-slate-400 pt-1">
                Enter the IP address to be allowed for DRM access
              </p>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">Location</Label>
              <Input 
                placeholder="e.g., Office Main Building" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
              />
            </div>

            {/* Browser */}
            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">Browser</Label>
              <Input 
                placeholder="e.g., Chrome, Firefox" 
                value={formData.browser}
                onChange={(e) => setFormData({...formData, browser: e.target.value})}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
              />
            </div>

            {/* IP User */}
            <div className="space-y-1">
              <Label className="text-[13px] font-bold text-[#555]">IP User</Label>
              <Input 
                placeholder="Username or department" 
                value={formData.ipUser}
                onChange={(e) => setFormData({...formData, ipUser: e.target.value})}
                className="h-10 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-slate-100 bg-[#f8f9fa] flex gap-2 justify-end sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="bg-[#777] hover:bg-[#666] text-white border-0 h-9 px-6 rounded-[4px]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[4px] flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
