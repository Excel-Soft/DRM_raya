import React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InvoiceReceiptProps {
    invoiceData: {
        invoiceNumber: string;
        date: Date;
        from: {
            name: string;
            whatsapp: string;
            phone: string;
            email: string;
            address: string;
        };
        to: {
            name: string;
            phone: string;
            email: string;
            address: string;
        };
        items: Array<{
            name: string;
            detail: string;
            price: number;
            quantity: number;
            total: number;
        }>;
        subTotalUsd: number;
        subTotalPkr: number;
        taxUsd: number;
        discountPkr: number;
        totalPkr: number;
    };
    onClose?: () => void;
    hideButtons?: boolean;
}

const stripAlibabaSuffix = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
        .replace(/\s*\([^)]*\)/gi, "")
        .replace(/Alibaba Product Posting\s*/gi, "")
        .trim();
};

const formatInvoiceNo = (invNum: string | null | undefined): string => {
    if (!invNum) return "9876";
    const str = invNum.toString().trim();
    // Extract numbers only (strips letters, dashes, hex characters like 'd' in UUID)
    const digitsOnly = str.replace(/\D/g, "");
    if (digitsOnly.length > 0) {
        return digitsOnly;
    }
    // Fallback numeric hash if input string contains no digits
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
        sum += str.charCodeAt(i);
    }
    return String(1000 + (sum % 9000));
};

export function InvoiceReceipt({ invoiceData, onClose, hideButtons }: InvoiceReceiptProps) {
    return (
        <div className="invoice-print-container bg-white p-5 max-w-3xl mx-auto shadow-lg border rounded-lg overflow-hidden font-sans dark:bg-zinc-900">
            <div className="flex justify-between items-start mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <img
                        src="/webexcels-logo.png"
                        alt="Web Excels Logo"
                        className="h-12 w-auto object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60/00a65a/ffffff?text=WE';
                        }}
                    />
                </div>
                <div className="text-right text-[12px] text-gray-800 font-medium dark:text-zinc-300 whitespace-nowrap pt-1">
                    <p><span className="font-bold">Invoice No:</span> {formatInvoiceNo(invoiceData.invoiceNumber)}</p>
                    <p><span className="font-bold">Date:</span> {format(invoiceData.date, "yyyy-MM-dd HH:mm:ss")}</p>
                </div>
            </div>

            {/* Invoice Header Section */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-6 bg-[#00a65a]"></div>
                <h2 className="text-2xl font-black text-gray-800 tracking-wider uppercase dark:text-zinc-100">Invoice</h2>
                <div className="flex-1 h-6 bg-[#00a65a]"></div>
            </div>

            {/* Addresses Section */}
            <div className="grid grid-cols-2 gap-6 mb-6 border-b border-gray-100 pb-4 dark:border-zinc-800">
                <div className="space-y-1">
                    <h3 className="font-bold text-[12px] text-gray-800 border-b border-gray-300 inline-block uppercase dark:text-zinc-100 dark:border-zinc-800">From:</h3>
                    <p className="font-bold text-[11px]">{invoiceData.from.name}</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">{invoiceData.from.whatsapp} (Whatsapp)</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">{invoiceData.from.phone}</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">{invoiceData.from.email}</p>
                    <p className="text-[10px] text-gray-600 font-medium max-w-[200px] dark:text-zinc-300">{invoiceData.from.address}</p>
                </div>
                <div className="space-y-1 text-right">
                    <h3 className="font-bold text-[12px] text-gray-800 border-b border-gray-300 inline-block uppercase dark:text-zinc-100 dark:border-zinc-800">To:</h3>
                    <p className="font-bold text-[11px]">{stripAlibabaSuffix(invoiceData.to.name)}</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">Phone: {invoiceData.to.phone}</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">Email: {invoiceData.to.email}</p>
                    <p className="text-[10px] text-gray-600 font-medium dark:text-zinc-300">Address: {invoiceData.to.address || "..."}</p>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse mb-6 border-2 border-gray-600 dark:border-zinc-800">
                <thead>
                    <tr className="bg-[#343a40] text-white text-[11px] font-bold">
                        <th className="py-2 px-3 text-center border-r border-gray-500 w-10 dark:border-zinc-800">Sl.</th>
                        <th className="py-2 px-3 text-left border-r border-gray-500 dark:border-zinc-800">Item Description</th>
                        <th className="py-2 px-3 text-center border-r border-gray-500 w-20 dark:border-zinc-800">Price</th>
                        <th className="py-2 px-3 text-center border-r border-gray-500 w-20 dark:border-zinc-800">Qty</th>
                        <th className="py-2 px-3 text-center w-20">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {invoiceData.items.map((item, idx) => (
                        <tr key={idx} className="text-[10px] text-gray-800 border-b border-gray-600 last:border-b-0 dark:text-zinc-100 dark:border-zinc-800">
                            <td className="py-2 px-3 text-center border-r border-gray-600 font-bold dark:border-zinc-800">{idx + 1}</td>
                            <td className="py-2 px-3 border-r border-gray-600 dark:border-zinc-800">
                                <p className="font-bold">{stripAlibabaSuffix(item.name)}</p>
                                <p className="text-[9px] text-gray-500 leading-tight dark:text-zinc-400">{stripAlibabaSuffix(item.detail)}</p>
                            </td>
                            <td className="py-2 px-3 text-center border-r border-gray-600 dark:border-zinc-800">${item.price}</td>
                            <td className="py-2 px-3 text-center border-r border-gray-600 dark:border-zinc-800">
                                {((item.name || "").toLowerCase().includes("product posting") || (item.detail || "").toLowerCase().includes("product posting")) && (item.quantity === 1 || !item.quantity)
                                    ? 100
                                    : item.quantity}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-gray-700 dark:text-zinc-400">{item.total}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Section */}
            <div className="flex flex-col items-end mb-10 space-y-1 pr-2">
                <div className="flex justify-between w-40 text-[11px] font-bold text-gray-700 dark:text-zinc-400">
                    <span>Sub Total:</span>
                    <span>${invoiceData.subTotalUsd}</span>
                </div>
                <div className="flex justify-between w-40 text-[11px] font-bold text-gray-700 dark:text-zinc-400">
                    <span>Sub Total:</span>
                    <span>{invoiceData.subTotalPkr} Pkr</span>
                </div>
                <div className="flex justify-between w-40 text-[11px] font-bold text-gray-700 dark:text-zinc-400">
                    <span>Tax:</span>
                    <span>${invoiceData.taxUsd}</span>
                </div>
                <div className="flex justify-between w-40 text-[11px] font-bold text-gray-700 dark:text-zinc-400">
                    <span>Discount:</span>
                    <span>{invoiceData.discountPkr} Pkr</span>
                </div>
                <div className="mt-2 w-44 bg-[#00a65a] text-white p-1.5 flex justify-between items-center rounded-sm shadow-sm">
                    <span className="text-[12px] font-bold tracking-wide uppercase">Total:</span>
                    <span className="text-[13px] font-black">{invoiceData.totalPkr} Pkr</span>
                </div>
            </div>

            {/* Footer Section */}
            <div className="border-t-2 border-[#00a65a] pt-4 mt-8 flex flex-col items-center gap-1.5 dark:border-zinc-800">
                <p className="text-[12px] font-black tracking-tight text-gray-800 dark:text-zinc-100">
                    This Invoice Only For <span className="text-[#00a65a] dark:text-zinc-400">{stripAlibabaSuffix(invoiceData.to.name)}</span>. Copyright 2026 Reserved By Webexcels.
                </p>
                {!hideButtons && (
                    <div className="flex gap-4 mt-4 no-print">
                        <button
                            onClick={() => window.print()}
                            className="bg-[#00a65a] text-white py-1.5 px-6 rounded-md font-bold text-xs hover:bg-[#008d4c] shadow-sm transition-all active:scale-95"
                        >
                            Print Now
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="bg-gray-100 text-gray-700 py-1.5 px-6 rounded-md font-bold text-xs hover:bg-gray-200 transition-all active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
                            >
                                Close
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
