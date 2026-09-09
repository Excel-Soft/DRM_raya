import { PlusCircle } from "lucide-react";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const paymentReceivedData = [
    { no: 1, company: "MARAJDIN IMPEX", person: "Khadija jamil", contact: "03145244521", pay: "0" },
    { no: 2, company: "fanbear sports", person: "Khadija jamil", contact: "null", pay: "500" },
    { no: 3, company: "MARAJDIN IMPEX", person: "Khadija jamil", contact: "03145244521", pay: "0" },
    { no: 4, company: "MOHZA INDUSTRIES", person: "M.salman", contact: "03046247658", pay: "0" },
    { no: 5, company: "MOHZA INDUSTRIES", person: "M.salman", contact: "03046247658", pay: "0" },
    { no: 6, company: "MOHZA INDUSTRIES", person: "M.salman", contact: "03046247658", pay: "0" },
    { no: 7, company: "VENTURA ENTERPRISES", person: "Saim Tariq", contact: "0333-8623770", pay: "10000" },
    { no: 8, company: "RONIEL SPORTS", person: "Zohaib Nisar Ahmad", contact: "0322-7449696", pay: "5000" },
];

const dataVerificationData = [
    { no: "74", company: "CHEEMA APPAREL", person: "Ayesha Shafique", contact: "03177231437", project: "Alibaba Product Posting" },
    { no: "74", company: "MINHAS & CO", person: "Amina Tahir", contact: "03486655072", project: "Alibaba Product Posting" },
    { no: "74", company: "MINHAS & CO", person: "Zain Ahmed", contact: "03486655072", project: "Alibaba Minisite" },
];

const alibabaPaymentData = [
    { no: "74", company: "MOHZA INDUSTRIES", person: "M.salman", contact: "03046247658", pay: "1819.00" },
    { no: "74", company: "VENTURA ENTERPRISES", person: "Saim Tariq", contact: "0333-8623770", pay: "1799.00" },
    { no: "74", company: "FIT2U WEARS", person: "Saim Tariq", contact: "3137223333", pay: "1259.00" },
    { no: "74", company: "JEXMOO ENTERPRISES", person: "Saim Tariq", contact: "3036083548", pay: "200.00" },
    { no: "74", company: "UNIVENTURE", person: "Fatima ilyas", contact: "3317404012", pay: "1759.00" },
    { no: "74", company: "BAIFA ENTERPRISES", person: "M. Arslan Janjua", contact: "0301-8640917", pay: "1599.00" },
    { no: "74", company: "JACOMO APPAREL", person: "M.salman", contact: "03364663549", pay: "7999.00" },
    { no: "74", company: "FASH STARS", person: "Khadija jamil", contact: "05245214521", pay: "1819.00" },
];

export default function CustomersVerification() {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<string>("");

    const handleOpenFeedback = (companyName: string) => {
        setSelectedCompany(companyName);
        setIsFeedbackOpen(true);
    };

    return (
        <div className="p-6 min-h-screen bg-[#f4f6f9] overflow-x-hidden dark:bg-zinc-950">
            <h1 className="text-[18px] font-extrabold text-[#444a50] uppercase mb-6 tracking-wide drop-shadow-sm dark:text-zinc-400">
                Customers Verification
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

                {/* Vas Payment Received Column */}
                <div className="bg-white mx-2 pt-2 pb-0 dark:bg-zinc-900">
                    <h2 className="text-[14px] font-bold text-gray-700 p-3 bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Vas Payment Received</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[12px]">
                            <thead>
                                <tr className="bg-[#f0f2f5] border-y border-gray-100 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">No</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Person</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Contact</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Pay</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentReceivedData.map((row, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                        <td className="px-3 py-4 text-gray-500 font-medium uppercase dark:text-zinc-400">{row.company}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.person}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.contact}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.pay}</td>
                                        <td className="px-3 py-4 text-center">
                                            <button onClick={() => handleOpenFeedback(row.company)} className="text-[#00a65a] hover:bg-emerald-50 rounded-full p-0.5 transition-colors dark:text-zinc-400">
                                                <PlusCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Data Verification Column (Elevated) */}
                <div className="bg-white relative z-10 shadow-[0_0_20px_rgba(0,0,0,0.1)] rounded -mx-1 -mt-2 pb-10 dark:bg-zinc-900">
                    <h2 className="text-[14px] font-bold text-gray-700 p-4 border-b border-gray-100 dark:border-zinc-800 dark:text-zinc-400">Data Verification</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[12px]">
                            <thead>
                                <tr className="bg-[#f0f2f5] border-y border-gray-100 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">No</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Person</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Contact</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Project</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dataVerificationData.map((row, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                        <td className="px-3 py-4 text-gray-500 font-medium uppercase dark:text-zinc-400">{row.company}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.person}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.contact}</td>
                                        <td className="px-3 py-4 text-gray-500 max-w-[100px] whitespace-normal leading-tight dark:text-zinc-400">{row.project}</td>
                                        <td className="px-3 py-4 text-center align-top">
                                            <button onClick={() => handleOpenFeedback(row.company)} className="text-[#00a65a] hover:bg-emerald-50 rounded-full p-0.5 mt-1 transition-colors dark:text-zinc-400">
                                                <PlusCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Alibaba Payment Column */}
                <div className="bg-white mx-2 pt-2 pb-0 dark:bg-zinc-900">
                    <h2 className="text-[14px] font-bold text-gray-700 p-3 bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Alibaba Payment</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[12px]">
                            <thead>
                                <tr className="bg-[#f0f2f5] border-y border-gray-100 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">No</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Person</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Contact</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Pay</th>
                                    <th className="px-3 py-3 font-semibold text-gray-600 dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alibabaPaymentData.map((row, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                        <td className="px-3 py-4 text-gray-500 font-medium uppercase dark:text-zinc-400">{row.company}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.person}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.contact}</td>
                                        <td className="px-3 py-4 text-gray-500 dark:text-zinc-400">{row.pay}</td>
                                        <td className="px-3 py-4 text-center">
                                            <button onClick={() => handleOpenFeedback(row.company)} className="text-[#00a65a] hover:bg-emerald-50 rounded-full p-0.5 transition-colors dark:text-zinc-400">
                                                <PlusCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Customer Feedback Dialog */}
            <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader className="px-5 py-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#545a60] dark:text-zinc-400">Customer Feedback</DialogTitle>
                    </DialogHeader>

                    <div className="px-5 py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-semibold text-[#545a60] dark:text-zinc-400">Name</Label>
                            <Input
                                value={selectedCompany}
                                readOnly
                                className="bg-[#f0f2f5]/60 dark:bg-zinc-800 text-gray-600 border-gray-200 focus-visible:ring-0 text-[13px] h-9 dark:text-zinc-300 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-semibold text-[#545a60] dark:text-zinc-400">Feedback</Label>
                            <Textarea
                                className="min-h-[100px] resize-none text-[13px] border-gray-200 focus-visible:ring-1 focus-visible:ring-[#00a65a] dark:border-zinc-800"
                            />
                        </div>
                    </div>

                    <DialogFooter className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 sm:justify-end dark:bg-zinc-900 dark:border-zinc-800">
                        <Button
                            variant="outline"
                            onClick={() => setIsFeedbackOpen(false)}
                            className="px-5 bg-[#f0f2f5] hover:bg-gray-200 text-[#212529] border-0 h-9 text-[13px] font-medium dark:bg-zinc-900 dark:text-zinc-100"
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => setIsFeedbackOpen(false)}
                            className="px-5 bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 text-[13px] font-medium transition-colors"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
