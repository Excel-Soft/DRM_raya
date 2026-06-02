import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

function EditCompanyDetailModal({
    isOpen,
    onClose,
    companyData
}: {
    isOpen: boolean;
    onClose: () => void;
    companyData: any;
}) {
    const serviceTypes = [
        "Mobile Responsive Website", "E-Commerce Store", "Alibaba Services", "Domain Registration / Hosting",
        "Photo Shooting & Video Documen", "SEO & SEM Services", "Facebook Fan Page Design", "EBay Store / Posting",
        "Web Design & Development", "Graphic Designing & Logo Desig", "Daraz Store & Product Posting", "Digital Marketing",
        "Product mockups design service", "Designing Services", "CONSULTANCY & CERTIFICATION", "Amazon Store / Posting",
        "Alibaba listing page", "Videography Service", "Amazon Product Hunting", "Amazon Product Listing",
        "Amazon Account Creation", "Instagram Page Design Manage", "Instagram ADs", "Facebook ADs",
        "Social Media followers", "Minisite professional", "Android App", "VM",
        "Etsy Store Creation or Posting", "Social Media Account Handling", "Alibaba VA"
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl p-6 bg-white gap-6 dark:bg-zinc-900">
                <DialogHeader>
                    <DialogTitle className="text-[16px] font-bold text-[#475569] uppercase border-b pb-4 dark:text-zinc-400">
                        EDIT COMPANY DETAIL
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto max-h-[75vh] pr-2 custom-scrollbar">
                    {/* Column 1: Company Detail */}
                    <div className="space-y-4">
                        <h3 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Company Detail</h3>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Company name *</label>
                            <Input defaultValue={companyData?.company} className="bg-[#f8fafc] border-slate-200 h-9 text-[13px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Ab</label>
                            <Select>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Choose..." /></SelectTrigger>
                                <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Country /Region *</label>
                            <Select defaultValue="pk">
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Pakistan" /></SelectTrigger>
                                <SelectContent><SelectItem value="pk">Pakistan</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Contact No(0521234567) *</label>
                            <Input defaultValue={companyData?.contactNo} className="border-slate-200 h-9 text-[13px] dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">City *</label>
                            <Select defaultValue="sk">
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Sialkot" /></SelectTrigger>
                                <SelectContent><SelectItem value="sk">Sialkot</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Address</label>
                            <Textarea defaultValue="rey" className="bg-[#f8fafc] border-slate-200 text-[13px] min-h-[40px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Company type</label>
                            <Select>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Choose..." /></SelectTrigger>
                                <SelectContent><SelectItem value="type1">Type 1</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Crm Id</label>
                            <Input placeholder="Enter Crm Id" className="border-slate-200 h-9 text-[13px] dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Crm Date</label>
                            <Input type="date" className="border-slate-200 h-9 text-[13px] dark:border-zinc-800" />
                        </div>
                    </div>

                    {/* Column 2: Primary Detail */}
                    <div className="space-y-4">
                        <h3 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Primary Detail</h3>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Title</label>
                            <Select defaultValue="mr">
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Mr." /></SelectTrigger>
                                <SelectContent><SelectItem value="mr">Mr.</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Person Full Name</label>
                            <Input defaultValue={companyData?.accHolder} className="bg-[#f8fafc] border-slate-200 h-9 text-[13px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">CNIC</label>
                            <Input defaultValue="323" className="bg-[#f8fafc] border-slate-200 h-9 text-[13px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">NTN</label>
                            <Input defaultValue={companyData?.ntn !== "none" ? companyData?.ntn : "123"} className="bg-[#f8fafc] border-slate-200 h-9 text-[13px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Website</label>
                            <Input placeholder="www.name.com" className="border-slate-200 h-9 text-[13px] dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Email *</label>
                            <Input defaultValue={companyData?.email} className="bg-[#f8fafc] border-slate-200 h-9 text-[13px] dark:bg-zinc-900 dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Mobile No (03001234567)*</label>
                            <Input defaultValue="null" className="border-slate-200 h-9 text-[13px] dark:border-zinc-800" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Designation</label>
                            <Select>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Choose..." /></SelectTrigger>
                                <SelectContent><SelectItem value="d1">Desig 1</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Your Comment</label>
                            <Textarea className="border-slate-200 text-[13px] min-h-[80px] dark:border-zinc-800" />
                        </div>
                    </div>

                    {/* Column 3: Lead Detail & Submit */}
                    <div className="space-y-4 flex flex-col h-full">
                        <h3 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Lead Detail</h3>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">RC Link</label>
                            <Select defaultValue="webxl">
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Webxl" /></SelectTrigger>
                                <SelectContent><SelectItem value="webxl">Webxl</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Source</label>
                            <Select defaultValue="fb">
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="FaceBook" /></SelectTrigger>
                                <SelectContent><SelectItem value="fb">FaceBook</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Grade</label>
                            <Select>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"><SelectValue placeholder="Choose..." /></SelectTrigger>
                                <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
                            </Select>
                        </div>

                        <div className="pt-2 flex-grow flex flex-col min-h-0">
                            <h3 className="text-[13px] font-bold text-slate-700 mb-3 dark:text-zinc-400">Service Type</h3>
                            <div className="space-y-2 flex-grow overflow-y-auto custom-scrollbar pr-2 mb-4">
                                {serviceTypes.map(service => (
                                    <div key={service} className="flex items-start space-x-2">
                                        <Checkbox id={service} className="mt-0.5 border-slate-300 w-3.5 h-3.5 rounded-[3px] data-[state=checked]:bg-[#059669] data-[state=checked]:border-[#059669] dark:border-zinc-800" />
                                        <label htmlFor={service} className="text-[12px] text-slate-600 font-medium leading-[1.3] cursor-pointer dark:text-zinc-300">
                                            {service}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 mt-auto">
                            <Button className="bg-[#059669] hover:bg-emerald-700 text-white shadow-sm h-9 px-6 font-medium text-[13px] w-auto">
                                Submit form
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ServicePublicPool() {
    const [selectedCompany, setSelectedCompany] = useState<any>(null);

    const mockData = [
        {
            id: "wl_cxcz_41", company: "cxczc", city: "sialkot", salePerson: "Fatima ilyas", accHolder: "ali",
            email: "zunair.b.ahmad@gmail.com", contactNo: "030000000", ntn: "123",
            lastFollowName: "Samman Khalid", lastFollowService: "Mobile Responsive Website", lastFollowNext: "2024-06-15 11:21:00", accountCreate: "2023-05-27"
        },
        {
            id: "PKArvi195", company: "Arvisions smc-pvt Ltd", city: "sialkot", salePerson: "Anita", accHolder: "Ur Rahman ALTAF",
            email: "altaf257@gmail.com", contactNo: "03189285874", ntn: "none",
            lastFollowName: "Samman Khalid", lastFollowService: "Mobile Responsive Website", lastFollowNext: "2024-06-15 12:13:00", accountCreate: "2022-11-15"
        },
        {
            id: "PKARIO210", company: "ARIOX BM SPORTS", city: "sialkot", salePerson: "Shazia Arshad", accHolder: "AMIR PERVAIZ",
            email: "arixkbmsports@gmail.com", contactNo: "03089112981", ntn: "none",
            lastFollowName: "Izhaq Ravis", lastFollowService: "Alibaba Services", lastFollowNext: "0000-00-00 00:00:00", accountCreate: "2023-04-06"
        },
        {
            id: "PKASTI213", company: "ASTIR SPORTS", city: "sialkot", salePerson: "Umay kalsoom", accHolder: "NASIR ALI",
            email: "astirsports1@gmail.com", contactNo: "03417274002", ntn: "none",
            lastFollowName: "Umay kalsoom", lastFollowService: "Alibaba Services", lastFollowNext: "0000-00-00 00:00:00", accountCreate: "2023-03-10"
        },
        {
            id: "PKBABA388", company: "BABA AZIZ INTERNATIONAL", city: "sialkot", salePerson: "Anita", accHolder: "IMRAN AZIZ",
            email: "babaaziz638@gmail.com", contactNo: "03304192216", ntn: "none",
            lastFollowName: "Samman Khalid", lastFollowService: "Mobile Responsive Website", lastFollowNext: "0000-00-00 00:00:00", accountCreate: "2023-05-17"
        }
    ];

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight mb-4 dark:text-zinc-400">PUBLIC POOL</h2>

            <div className="bg-white rounded-[4px] shadow-sm border border-slate-50 h-10 mb-6 dark:bg-zinc-900 dark:border-zinc-800"></div>

            <div className="mb-4">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">TRACING</h2>
            </div>

            <div className="bg-white shadow-sm border border-slate-100 rounded-[4px] p-2 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="overflow-x-auto rounded border border-slate-50 dark:border-zinc-800">
                    <Table className="w-full min-w-[1200px]">
                        <TableHeader>
                            <TableRow className="bg-[#f1f5f9] border-none hover:bg-[#f1f5f9] dark:bg-zinc-800 dark:hover:bg-zinc-800">
                                <TableHead className="w-10 pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Company ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Company Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">City</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Sale Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Acc Holder</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Email</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Contact No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">NTN/CINC</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap w-[200px] dark:text-zinc-300">Last Follow</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Account Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockData.map((row, idx) => (
                                <TableRow key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                    <TableCell className="pl-4 py-4"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 uppercase dark:text-zinc-300">{row.id}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.company}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 lowercase dark:text-zinc-300">{row.city}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 capitalize dark:text-zinc-300">{row.salePerson}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.accHolder}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 lowercase dark:text-zinc-300">{row.email}</TableCell>
                                    <TableCell className="py-4">
                                        <span className="bg-[#d1fae5] text-[#059669] text-[12px] font-bold px-2 py-0.5 rounded-[4px] dark:bg-zinc-900 dark:text-zinc-400">{row.contactNo}</span>
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.ntn}</TableCell>
                                    <TableCell className="py-4">
                                        <div className="bg-[#f8fafc] border border-slate-100 rounded-[4px] p-2 flex flex-col gap-1 w-full max-w-[200px] dark:bg-zinc-900 dark:border-zinc-800">
                                            <span className="text-[12px] font-bold text-[#059669] dark:text-zinc-400">{row.lastFollowName}</span>
                                            <span className="text-[11px] font-medium text-slate-500 line-clamp-1 dark:text-zinc-400">{row.lastFollowService}</span>
                                            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Next: {row.lastFollowNext}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.accountCreate}</TableCell>
                                    <TableCell className="py-4">
                                        <div
                                            className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 shadow-sm transition-colors"
                                            onClick={() => setSelectedCompany(row)}
                                        >
                                            <ArrowRightCircle className="w-3.5 h-3.5" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditCompanyDetailModal
                isOpen={!!selectedCompany}
                onClose={() => setSelectedCompany(null)}
                companyData={selectedCompany}
            />
        </div>
    );
}
