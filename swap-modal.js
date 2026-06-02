const fs = require('fs');
const path = 'c:/WebExcelsDRM/client/src/pages/service-private-pool.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('function QuotationTemplateModal');
if (startIdx === -1) {
    console.error("Could not find function QuotationTemplateModal");
    process.exit(1);
}

const beforeComponent = content.slice(0, startIdx);

const newComponent = `function QuotationTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col bg-slate-50 overflow-hidden gap-0 border-slate-200">
                <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-row items-center justify-between">
                    <DialogTitle className="text-[18px] font-bold text-slate-800">Quotation Template Detail</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto flex flex-col gap-6">
                        
                        {/* Client Details Card */}
                        <div className="bg-white p-5 md:p-6 rounded-[10px] shadow-sm border border-slate-200">
                            <h3 className="text-[14px] font-bold text-slate-700 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                                <User className="w-4 h-4 text-[#059669]" />
                                Client Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Quotation Date</label>
                                    <input type="text" defaultValue="04-01-26" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Company Name</label>
                                    <input type="text" defaultValue="Al khar store" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Contact</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Account Holder</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Email</label>
                                    <input type="text" defaultValue="null" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Order Grid Card */}
                        <div className="flex flex-col lg:flex-row gap-6">
                            
                            <div className="flex-1 w-full bg-white p-5 md:p-6 rounded-[10px] shadow-sm border border-slate-200 relative overflow-hidden">
                                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                                    <h3 className="text-[14px] font-bold text-slate-700 flex items-center gap-2">
                                        <Archive className="w-4 h-4 text-[#059669]" />
                                        Products & Services
                                    </h3>
                                    <button className="bg-[#059669] text-white px-3.5 py-1.5 rounded-[6px] text-[12px] font-semibold hover:bg-[#047857] transition-colors flex items-center gap-1.5 shadow-sm">
                                        <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add Row
                                    </button>
                                </div>

                                <div className="w-full overflow-x-auto">
                                    <div className="min-w-[750px] pb-4">
                                        {/* Headers */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-3 bg-slate-50 p-3 rounded-[6px] border border-slate-100">
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight">Product</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight">Detail</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right">Unit Price</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right">Quantity</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right">Total</div>
                                        </div>
                                        
                                        {/* Row 1 */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-4 items-start p-1">
                                            <div>
                                                <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-700 shadow-sm cursor-pointer">
                                                    <option>Alibaba Product Posting</option>
                                                </select>
                                            </div>
                                            <div>
                                                <textarea defaultValue="product posting 200 per month" rows={2} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white resize-none text-slate-700 shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="200" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right text-slate-700 shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="1" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right text-slate-700 shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="200.00" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] bg-slate-50 text-slate-500 focus:outline-none font-bold text-right cursor-not-allowed shadow-sm" readOnly />
                                            </div>
                                        </div>

                                        {/* Row 2 */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-4 items-start p-1 relative">
                                            <div>
                                                <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-400 shadow-sm cursor-pointer">
                                                    <option>~~SELECT~~</option>
                                                </select>
                                            </div>
                                            <div>
                                                <textarea rows={2} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white resize-none shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right shadow-sm" />
                                            </div>
                                            <div>
                                                <input type="text" placeholder="0.00" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] bg-slate-50 text-slate-400 focus:outline-none font-bold text-right cursor-not-allowed shadow-sm" readOnly />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action Footers embedded under products */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-slate-100">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600">Note</label>
                                        <textarea rows={4} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-slate-50 hover:bg-white resize-none shadow-sm" placeholder="Add additional terms, history, or notes here..."></textarea>
                                    </div>
                                    <div className="flex flex-col gap-1.5 md:pl-4">
                                        <label className="text-[12px] font-semibold text-slate-600">Delivery Time</label>
                                        <div className="relative w-full md:w-48">
                                            <input type="text" defaultValue="15" className="w-full border border-slate-200 rounded-[6px] pl-3 pr-10 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm font-medium" />
                                            <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-400">DAYS</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Summary Totals Sidebar */}
                            <div className="w-full lg:w-[320px] shrink-0 bg-white shadow-sm rounded-[10px] border border-slate-200 p-6 flex flex-col gap-4 h-fit">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-1 border-b border-slate-100 pb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#059669]" />
                                    Order Summary
                                </h3>
                                
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[13px] font-semibold text-slate-500">Sub Amount</span>
                                    <span className="text-[14px] font-bold text-slate-700">200.00</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] font-semibold text-slate-500">GST 18%</span>
                                    <input type="text" defaultValue="0" className="w-20 border border-slate-200 rounded-[6px] px-2 py-1.5 text-[13px] font-medium text-right focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-slate-50 hover:bg-white shadow-sm" />
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                                    <span className="text-[13px] font-bold text-slate-600">Total Amount</span>
                                    <span className="text-[14px] font-bold text-slate-800">200.00</span>
                                </div>
                                
                                <div className="mt-3 flex flex-col gap-3 bg-emerald-50/50 p-4 rounded-[8px] border border-emerald-100/60">
                                    <span className="text-[11px] font-bold text-[#059669] uppercase tracking-wider">Discount Module</span>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-1.5 text-[12px] text-slate-700 font-semibold cursor-pointer">
                                            <input type="radio" name="discount_type" className="accent-[#059669] w-3.5 h-3.5" /> % Percentage
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[12px] text-slate-700 font-semibold cursor-pointer">
                                            <input type="radio" name="discount_type" defaultChecked className="accent-[#059669] w-3.5 h-3.5" /> Fixed
                                        </label>
                                    </div>
                                    <div className="flex mt-1">
                                        <input type="text" defaultValue="26400" className="w-full border border-emerald-200 rounded-[6px] px-3 py-2 text-[14px] font-bold text-right text-emerald-900 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                    </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-100 pt-5 mt-2">
                                    <span className="text-[14px] font-bold text-slate-700">Grand Total</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 mb-0.5">USD</span>
                                        <span className="text-[20px] font-black text-[#059669] leading-none">106.38</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-5">
                                    <span className="text-[13px] font-semibold text-slate-500">PKR Total</span>
                                    <span className="text-[14px] font-bold text-slate-400">Rs 17,021.28</span>
                                </div>

                                {/* Extra settings */}
                                <div className="flex items-center justify-between mt-1 gap-2">
                                    <span className="text-[12px] font-semibold text-slate-500">-</span>
                                    <input type="text" defaultValue="18" className="w-16 border border-slate-200 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-right focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm" />
                                </div>
                                <div className="flex items-center justify-between mt-2 gap-2">
                                    <span className="text-[12px] font-semibold text-slate-500">Payment Term %</span>
                                    <select className="flex-1 max-w-[120px] border border-slate-200 rounded-[6px] px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-600 shadow-sm font-medium cursor-pointer">
                                        <option>~~SELECT~~</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 gap-2">
                                    <span className="text-[13px] font-semibold text-slate-500">Amount Sent</span>
                                    <span className="text-[14px] font-bold text-slate-400">0.00</span>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 gap-2">
                                    <span className="text-[13px] font-bold text-slate-700">Save Quotation</span>
                                    <select className="w-24 border border-slate-200 rounded-[6px] px-2 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-[#059669] font-bold shadow-sm cursor-pointer">
                                        <option>No</option>
                                        <option>Yes</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2 mt-4 pt-1">
                                    <button className="w-full bg-[#059669] hover:bg-[#047857] text-white px-4 py-3 rounded-[6px] text-[13px] font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]">Save Changes</button>
                                    <button onClick={onClose} className="w-full bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-[6px] text-[13px] font-bold hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm">Discard Changes</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
`;

fs.writeFileSync(path, beforeComponent + newComponent, 'utf8');
console.log("Successfully replaced QuotationTemplateModal.");
