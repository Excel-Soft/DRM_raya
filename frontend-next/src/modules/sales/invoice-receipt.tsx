"use client";

import type { CSSProperties } from "react";
import { PDF } from "@/lib/pdf/pdf-safe-styles";
import { plainTextForPdf } from "@/lib/pdf/plain-text";

export type InvoiceReceiptData = {
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

const stripAlibabaSuffix = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.replace(/\s*\([^)]*\)/gi, "").trim();
};

const formatInvoiceNo = (invNum: string | null | undefined): string => {
  if (!invNum) return "9876";
  const str = invNum.toString().trim();
  const digitsOnly = str.replace(/\D/g, "");
  if (digitsOnly.length > 0) return digitsOnly;
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return String(1000 + (sum % 9000));
};

function formatReceiptDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const rootStyle: CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  overflow: "hidden",
  borderRadius: 8,
  border: `1px solid ${PDF.gray300}`,
  backgroundColor: PDF.white,
  padding: 20,
  fontFamily: PDF.font,
  color: PDF.black,
};

export function InvoiceReceipt({
  invoiceData,
  onClose,
  hideButtons,
  documentTitle = "Invoice",
  referenceLabel = "Invoice No:",
}: {
  invoiceData: InvoiceReceiptData;
  onClose?: () => void;
  hideButtons?: boolean;
  documentTitle?: string;
  referenceLabel?: string;
}) {
  const footerLabel =
    documentTitle === "Quotation" ? "This Quotation Only For" : "This Invoice Only For";

  return (
    <div style={rootStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <img src="/webexcels-logo.png" alt="Web Excels Logo" style={{ height: 48, width: "auto", objectFit: "contain" }} />
        <div style={{ textAlign: "right", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", paddingTop: 4 }}>
          <p style={{ margin: 0 }}>
            <strong>{referenceLabel}</strong> {formatInvoiceNo(invoiceData.invoiceNumber)}
          </p>
          <p style={{ margin: "4px 0 0" }}>
            <strong>Date:</strong> {formatReceiptDate(invoiceData.date)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 24, backgroundColor: PDF.brand }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {documentTitle}
        </h2>
        <div style={{ flex: 1, height: 24, backgroundColor: PDF.brand }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: `1px solid ${PDF.gray100}`,
        }}
      >
        <div style={{ fontSize: 10 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>From:</h3>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>{invoiceData.from.name}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>{invoiceData.from.whatsapp} (Whatsapp)</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>{invoiceData.from.phone}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>{invoiceData.from.email}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600, maxWidth: 200 }}>{invoiceData.from.address}</p>
        </div>
        <div style={{ fontSize: 10, textAlign: "right" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>To:</h3>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>{stripAlibabaSuffix(invoiceData.to.name)}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>Phone: {invoiceData.to.phone}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>Email: {invoiceData.to.email}</p>
          <p style={{ margin: "2px 0", color: PDF.gray600 }}>Address: {invoiceData.to.address || "..."}</p>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, border: `2px solid ${PDF.border}`, fontSize: 10 }}>
        <thead>
          <tr style={{ backgroundColor: PDF.headerBg, color: PDF.white, fontWeight: 700, fontSize: 11 }}>
            <th style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.gray500}`, width: 40, textAlign: "center" }}>Sl.</th>
            <th style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.gray500}`, textAlign: "left" }}>Item Description</th>
            <th style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.gray500}`, width: 80, textAlign: "center" }}>Price</th>
            <th style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.gray500}`, width: 80, textAlign: "center" }}>Qty</th>
            <th style={{ padding: "8px 12px", width: 80, textAlign: "center" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoiceData.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${PDF.border}`, color: PDF.black }}>
              <td style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.border}`, textAlign: "center", fontWeight: 700 }}>{idx + 1}</td>
              <td style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.border}` }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{stripAlibabaSuffix(item.name)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 9, color: PDF.gray500, whiteSpace: "pre-line" }}>
                  {stripAlibabaSuffix(plainTextForPdf(item.detail))}
                </p>
              </td>
              <td style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.border}`, textAlign: "center" }}>${item.price}</td>
              <td style={{ padding: "8px 12px", borderRight: `1px solid ${PDF.border}`, textAlign: "center" }}>
                {((item.name || "").toLowerCase().includes("product posting") ||
                  (item.detail || "").toLowerCase().includes("product posting")) &&
                (item.quantity === 1 || !item.quantity)
                  ? 100
                  : item.quantity}
              </td>
              <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: PDF.gray700 }}>{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 40, fontSize: 11, fontWeight: 700, color: PDF.gray700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: 160 }}>
          <span>Sub Total:</span>
          <span>${invoiceData.subTotalUsd}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: 160, marginTop: 4 }}>
          <span>Sub Total:</span>
          <span>{invoiceData.subTotalPkr} Pkr</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: 160, marginTop: 4 }}>
          <span>Tax:</span>
          <span>${invoiceData.taxUsd}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: 160, marginTop: 4 }}>
          <span>Discount:</span>
          <span>{invoiceData.discountPkr} Pkr</span>
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: 176,
            backgroundColor: PDF.brand,
            color: PDF.white,
            padding: "6px 8px",
            borderRadius: 2,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Total:</span>
          <span style={{ fontSize: 13, fontWeight: 900 }}>{invoiceData.totalPkr} Pkr</span>
        </div>
      </div>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: `2px solid ${PDF.brand}`, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 900 }}>
          {footerLabel} <span style={{ color: PDF.brand }}>{stripAlibabaSuffix(invoiceData.to.name)}</span>. Copyright 2026
          Reserved By Webexcels.
        </p>
        {!hideButtons ? (
          <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                backgroundColor: PDF.brand,
                color: PDF.white,
                border: "none",
                borderRadius: 6,
                padding: "6px 24px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Print Now
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: PDF.gray100,
                  color: PDF.gray700,
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 24px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const WEBEXCELS_FROM = {
  name: "Web Excels",
  whatsapp: "+92-334-8086611",
  phone: "+92-52-4271592",
  email: "Support@Webexcels.com",
  address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan",
} as const;
