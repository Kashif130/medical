"use client";

import { useEffect, useMemo, useState } from "react";
import { watchSales } from "@/lib/firebase";
import { Printer, ChevronDown, ChevronUp, X, Receipt } from "lucide-react";

const STORE_NAME  = "Umer Din Medical Store";
const STORE_ADDR  = "Chak No.128/9L Near Govt High School";
const STORE_PHONE = "03116126145";

// ── Mini receipt modal ──────────────────────────────────────
function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
  const subtotal    = sale.subtotal    ?? sale.total ?? 0;
  const flatDiscount= sale.flatDiscount ?? sale.discount ?? 0;
  const miscCharges = sale.miscCharges  ?? 0;
  const gstAmount   = sale.gstAmount    ?? 0;
  const total       = sale.total        ?? 0;

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Overlay — screen only */}
      <div
        className="receipt-overlay"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}
      >
        <div onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
          {/* Close + Print buttons — hidden on print */}
          <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
            <button
              onClick={handlePrint}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#0e6e5c", color: "white",
                fontSize: 13, fontWeight: 600, padding: "8px 16px",
                borderRadius: 8, border: "none", cursor: "pointer",
              }}
            >
              <Printer size={14} /> Print receipt
            </button>
            <button
              onClick={onClose}
              style={{ background: "white", border: "none", cursor: "pointer", color: "#6b7280", padding: "8px 10px", borderRadius: 8 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Receipt paper */}
          <div
            id="receipt-paper"
            style={{
              width: 320, background: "white",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 12, color: "#111",
              padding: "20px 18px",
              borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            }}
          >
            {/* Store header */}
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>{STORE_NAME}</p>
              <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{STORE_ADDR}</p>
              <p style={{ fontSize: 11, color: "#555" }}>{STORE_PHONE}</p>
            </div>

            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />

            {/* Bill meta */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span>{date.toLocaleDateString("en-PK")} {date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</span>
              <span>Bill #{sale.id?.slice(-6).toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span>Customer: {sale.customerName || "Walk-in"}</span>
              <span>{sale.paymentMethod || "Cash"}</span>
            </div>
            {sale.createdBy?.name && (
              <div style={{ fontSize: 11, marginBottom: 2 }}>
                Sold by: {sale.createdBy.name}
              </div>
            )}

            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />

            {/* Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Item</th>
                  <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600, fontSize: 10 }}>Qty</th>
                  <th style={{ textAlign: "right", paddingBottom: 4, fontWeight: 600, fontSize: 10 }}>Rate</th>
                  <th style={{ textAlign: "right", paddingBottom: 4, fontWeight: 600, fontSize: 10 }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items || []).map((item, i) => (
                  <tr key={i}>
                    <td style={{ paddingBottom: 2, maxWidth: 120, wordBreak: "break-word" }}>{item.name}</td>
                    <td style={{ textAlign: "center", paddingBottom: 2 }}>{item.qty}</td>
                    <td style={{ textAlign: "right", paddingBottom: 2 }}>{item.price}</td>
                    <td style={{ textAlign: "right", paddingBottom: 2 }}>{(item.price * item.qty).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />

            {/* Totals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(0)}</span>
              </div>
              {flatDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                  <span>Discount</span>
                  <span>- Rs. {flatDiscount.toFixed(0)}</span>
                </div>
              )}
              {gstAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>S.Tax / GST (17%)</span>
                  <span>Rs. {gstAmount.toFixed(0)}</span>
                </div>
              )}
              {miscCharges > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Misc charges</span>
                  <span>Rs. {miscCharges.toFixed(0)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginTop: 4, borderTop: "1px solid #ccc", paddingTop: 4 }}>
                <span>GRAND TOTAL</span>
                <span>Rs. {total.toFixed(0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginTop: 2 }}>
                <span>Payment</span>
                <span>{sale.paymentMethod || "Cash"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
            <p style={{ textAlign: "center", fontSize: 11, color: "#555" }}>
              Shukriya! Sehat mand rahein. 🏥
            </p>
            <p style={{ textAlign: "center", fontSize: 10, color: "#999", marginTop: 4 }}>
              {STORE_PHONE}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-paper, #receipt-paper * { visibility: visible !important; }
          .receipt-overlay { background: transparent !important; }
          #receipt-paper {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 80mm !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}

// ── Main Sales Page ─────────────────────────────────────────
export default function SalesPage() {
  const [sales, setSales]       = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => watchSales(setSales), []);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + (s.total || 0), 0), [sales]);
  const todaySales   = useMemo(() => {
    const today = new Date().toDateString();
    return sales.filter(s => s.createdAt?.toDate?.()?.toDateString() === today);
  }, [sales]);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Sales History</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Har bill ka record — receipt dobara print karein</p>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontFamily: "monospace" }}>Aaj ki sale</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#0e6e5c" }}>Rs. {todayRevenue.toFixed(0)}</p>
            <p style={{ fontSize: 11, color: "#9ca3af" }}>{todaySales.length} bills</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontFamily: "monospace" }}>Total revenue</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Rs. {totalRevenue.toFixed(0)}</p>
            <p style={{ fontSize: 11, color: "#9ca3af" }}>{sales.length} bills total</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "white", border: "1px solid #dce6e2", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #dce6e2" }}>
              {["Date & Time","Customer","Items","Sold by","Payment","Total",""].map(h => (
                <th key={h} style={{
                  padding: "10px 12px", textAlign: h === "Total" ? "right" : "left",
                  fontSize: 11, fontFamily: "monospace", color: "#6b7280",
                  textTransform: "uppercase", fontWeight: 500,
                  display: isMobile && ["Sold by","Payment"].includes(h) ? "none" : "table-cell"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => {
              const date = s.createdAt?.toDate ? s.createdAt.toDate() : null;
              const isExpanded = expandedId === s.id;
              return (
                <>
                  <tr
                    key={s.id}
                    style={{ borderBottom: "1px solid #f0f4f2", cursor: "pointer" }}
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  >
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
                      {date ? (
                        <>
                          <div>{date.toLocaleDateString("en-PK")}</div>
                          <div style={{ color: "#9ca3af" }}>{date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</div>
                        </>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      {s.customerName || "Walk-in"}
                      {s.customerPhone && <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{s.customerPhone}</div>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                      <span style={{ background: "#f0f4f2", borderRadius: 6, padding: "2px 8px", fontFamily: "monospace", fontSize: 11 }}>
                        {s.items?.length || 0} items
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, display: isMobile ? "none" : "table-cell" }}>
                      {s.createdBy?.name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, display: isMobile ? "none" : "table-cell" }}>
                      <span style={{
                        background: s.paymentMethod === "Cash" ? "#dcfce7" : "#dbeafe",
                        color: s.paymentMethod === "Cash" ? "#16a34a" : "#2563eb",
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99
                      }}>
                        {s.paymentMethod || "Cash"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      Rs. {(s.total || 0).toFixed(0)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReceiptSale(s); }}
                          title="Receipt print karein"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "#f0faf5", border: "1px solid #a7f3d0",
                            color: "#0e6e5c", fontSize: 11, fontWeight: 600,
                            padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Printer size={12} />
                          {!isMobile && "Receipt"}
                        </button>
                        <span style={{ color: "#9ca3af" }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row — items detail */}
                  {isExpanded && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={7} style={{ padding: "0 12px 16px", background: "#f8faf9" }}>
                        <div style={{ paddingTop: 12 }}>
                          {/* Items table */}
                          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 10 }}>
                            <thead>
                              <tr style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 10, textTransform: "uppercase" }}>
                                <th style={{ textAlign: "left", paddingBottom: 4 }}>Medicine</th>
                                <th style={{ textAlign: "center", paddingBottom: 4 }}>Qty</th>
                                <th style={{ textAlign: "right", paddingBottom: 4 }}>Rate</th>
                                <th style={{ textAlign: "right", paddingBottom: 4 }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(s.items || []).map((item, i) => (
                                <tr key={i} style={{ borderTop: "1px solid #e5ede9" }}>
                                  <td style={{ padding: "4px 0" }}>{item.name}</td>
                                  <td style={{ textAlign: "center", padding: "4px 0", color: "#6b7280" }}>{item.qty}</td>
                                  <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace" }}>Rs. {item.price}</td>
                                  <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>Rs. {(item.price * item.qty).toFixed(0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Totals summary */}
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, borderTop: "1px dashed #dce6e2", paddingTop: 8 }}>
                            <span style={{ color: "#6b7280" }}>Subtotal: <strong>Rs. {(s.subtotal || s.total || 0).toFixed(0)}</strong></span>
                            {(s.flatDiscount || s.discount || 0) > 0 && <span style={{ color: "#dc2626" }}>Discount: − Rs. {(s.flatDiscount || s.discount || 0).toFixed(0)}</span>}
                            {(s.gstAmount || 0) > 0 && <span style={{ color: "#6b7280" }}>GST: Rs. {s.gstAmount.toFixed(0)}</span>}
                            {(s.miscCharges || 0) > 0 && <span style={{ color: "#6b7280" }}>Misc: Rs. {s.miscCharges.toFixed(0)}</span>}
                            <span style={{ fontWeight: 700 }}>Total: Rs. {(s.total || 0).toFixed(0)}</span>
                            {!isMobile && s.createdBy?.name && <span style={{ color: "#9ca3af" }}>by {s.createdBy.name}</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  Abhi tak koi sale record nahi hai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt modal */}
      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
      )}
    </div>
  );
}
