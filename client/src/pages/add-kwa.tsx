import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AddKwa() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: kwaData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-records"],
  });

  // Form State
  const [company, setCompany] = useState("");
  const [kwaValue, setKwaValue] = useState("");
  const [type, setType] = useState("none");
  const [person, setPerson] = useState("none");
  const [detail, setDetail] = useState("");

  // Use Kwa Modal State
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  
  const handleOpenUseModal = (row: any) => {
    setSelectedRow(row);
    setIsUseModalOpen(true);
  };

  const handleUseKwaSubmit = () => {
    toast({ title: "Kwa Used Successfully!" });
    setIsUseModalOpen(false);
    setSelectedRow(null);
  };

  const saveKwaMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const res = await apiRequest("POST", "/api/target-system/kwa-records", newRecord);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/kwa-records"] });
      toast({ title: "KWA record added successfully!" });
      
      // Reset form
      setCompany("");
      setKwaValue("");
      setType("none");
      setPerson("none");
      setDetail("");
      setIsFormOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create KWA record.", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!company || !kwaValue || type === "none" || person === "none") {
      toast({ title: "Please fill out all required fields (Company, Kwa, Type, Person).", variant: "destructive" });
      return;
    }

    saveKwaMutation.mutate({
      company,
      employee: person,
      kwa: kwaValue,
      detail,
      type
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center font-bold text-lg uppercase">
        <span className="text-gray-700 mr-2 dark:text-zinc-400">KWA RECORD /</span>
        <span 
          className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          ADD KWA
        </span>
      </div>

      {isFormOpen && (
        <Card className="mb-6 border rounded-sm shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Company Name</label>
                <Select value={company} onValueChange={setCompany}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Search Company Through Id/Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input placeholder="" className="h-8" />
                    </div>
                    <SelectItem value="WARPRO INDUSTRY">WARPRO INDUSTRY</SelectItem>
                    <SelectItem value="Dyna international">Dyna international</SelectItem>
                    <SelectItem value="IMRAN USMAN ENTERPRISES">IMRAN USMAN ENTERPRISES</SelectItem>
                    <SelectItem value="AL NOLAN ENTERPRISES">AL NOLAN ENTERPRISES</SelectItem>
                    <SelectItem value="APTO ENTERPRISES">APTO ENTERPRISES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa($):</label>
                <Input 
                  placeholder="Kwa($)" 
                  type="number"
                  value={kwaValue}
                  onChange={(e) => setKwaValue(e.target.value)}
                  className="h-9" 
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Type:</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose ...</SelectItem>
                    <SelectItem value="Kwa">Kwa</SelectItem>
                    <SelectItem value="Psa">Psa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Person:</label>
                <Select value={person} onValueChange={setPerson}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    <SelectItem value="Zohaib Nisar Ahmad">Zohaib Nisar Ahmad</SelectItem>
                    <SelectItem value="Faiza Khalid">Faiza Khalid</SelectItem>
                    <SelectItem value="Hina Arij">Hina Arij</SelectItem>
                    <SelectItem value="Waqas Ahmed">Waqas Ahmed</SelectItem>
                    <SelectItem value="Amir Nafees">Amir Nafees</SelectItem>
                    <SelectItem value="M. Arslan Janjua">M. Arslan Janjua</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Detail</label>
              <Input 
                placeholder="add detail" 
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="w-full" 
              />
            </div>

            <Button className="bg-[#00a65a] hover:bg-[#008d4c] px-6" onClick={handleSubmit}>
              Submit
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border rounded-sm shadow-sm">
        <CardContent className="p-0">
          <Dialog open={isUseModalOpen} onOpenChange={setIsUseModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-normal text-gray-700 border-b pb-4 dark:text-zinc-400">Use Kwa</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Company:</label>
                  <Input value={selectedRow?.company || ""} disabled className="bg-gray-100 text-gray-600 h-10 dark:text-zinc-300 dark:bg-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Person:</label>
                  <Input value={selectedRow?.employee || ""} disabled className="bg-gray-100 text-gray-600 h-10 dark:text-zinc-300 dark:bg-zinc-900" />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Person:</label>
                  <Select defaultValue="none">
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose...</SelectItem>
                      <SelectItem value="Zohaib Nisar Ahmad">Zohaib Nisar Ahmad</SelectItem>
                      <SelectItem value="Faiza Khalid">Faiza Khalid</SelectItem>
                      <SelectItem value="Hina Arij">Hina Arij</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa($):</label>
                  <Input placeholder="Kwa($)" type="number" className="h-10" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Kwa Type:</label>
                  <Select defaultValue="Used">
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Used" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="Refund">Refund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Detail:</label>
                  <Textarea className="min-h-[100px] resize-y" />
                </div>
              </div>
              <DialogFooter className="border-t pt-4">
                <Button variant="secondary" onClick={() => setIsUseModalOpen(false)}>Close</Button>
                <Button className="bg-[#00a65a] hover:bg-[#008d4c]" onClick={handleUseKwaSubmit}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Show</span>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-zinc-300">
                <Select defaultValue="10">
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>entries</span>
              </div>
            </div>
            <div className="flex flex-col space-y-2 text-right">
              <span className="text-sm text-gray-600 dark:text-zinc-300">Search:</span>
              <Input className="h-8 w-48" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-t dark:bg-zinc-900">
                <TableRow>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">No#</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Com Id</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Company</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Employee</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Kwa</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Detail</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Remaining</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Type</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-zinc-400">Date</TableHead>
                  <TableHead className="font-bold text-gray-700 text-center dark:text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">Loading live data...</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {kwaData.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{index + 1}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.id}</TableCell>
                        <TableCell className="text-sm text-gray-700 uppercase dark:text-zinc-400">{row.company}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.employee}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.kwa}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.detail}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.remaining}$</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-zinc-400">{row.type}</TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap dark:text-zinc-400">{new Date(row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '')}</TableCell>
                        <TableCell className="text-center">
                          <PlusCircle 
                            className="w-5 h-5 text-[#00a65a] cursor-pointer hover:text-[#008d4c] mx-auto dark:text-zinc-400" 
                            onClick={() => handleOpenUseModal(row)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {kwaData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-gray-500 dark:text-zinc-400">No KWA records found.</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 flex items-center justify-between border-t text-sm text-gray-600 dark:text-zinc-300">
            <div>Showing 1 to {Math.min(10, kwaData.length)} of {kwaData.length} entries</div>
            <div className="flex space-x-1">
              <Button variant="outline" className="h-8 px-3 text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400">Previous</Button>
              <Button variant="default" className="h-8 w-8 p-0 bg-[#00a65a] hover:bg-[#008d4c]">1</Button>
              <Button variant="outline" className="h-8 w-8 p-0">2</Button>
              <Button variant="outline" className="h-8 w-8 p-0">3</Button>
              <Button variant="outline" className="h-8 w-8 p-0">4</Button>
              <Button variant="outline" className="h-8 w-8 p-0">5</Button>
              <span className="px-2 flex items-end">...</span>
              <Button variant="outline" className="h-8 w-8 p-0">27</Button>
              <Button variant="outline" className="h-8 px-3">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
