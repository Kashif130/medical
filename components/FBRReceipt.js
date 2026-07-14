"use client";

/**
 * FBRReceipt.js
 * FBR-compliant tax invoice with QR code
 * Usage: <FBRReceipt bill={bill} onClose={()=>...} />
 *
 * bill shape:
 * {
 *   id, date, items:[{name,qty,price,costPrice,discount}],
 *   subtotal, totalDiscount, miscCharges, gstAmount, applyGst,
 *   total, customerName, customerPhone, paymentMethod, soldBy
 * }
 */

import { useEffect, useRef } from "react";
import { X, Printer } from "lucide-react";

// ── Store config — update these ───────────────────────────
const STORE = {
  name:    "Umer Din Medical Store",
  address: "Chak No.128/9L, Near Govt Girls High School",
  phone:   "03116126145",
  ntn:     "XXXX-XXXXXXX",   // National Tax Number
  strn:    "XX-XX-XXXX-XXX-XXXXXX", // Sales Tax Reg No
  city:    "Sahiwal, Pakistan",
};

// QR data: FBR-style string (FBR POS verification URL format)
function buildQrData(bill) {
  const date  = bill.date instanceof Date ? bill.date : new Date();
  const ds    = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const ts    = `${String(date.getHours()).padStart(2,"0")}${String(date.getMinutes()).padStart(2,"0")}${String(date.getSeconds()).padStart(2,"0")}`;
  // FBR PRAL verification link format
  return `https://invoice.fbr.gov.pk/Verify?ntn=${STORE.ntn.replace(/-/g,"")}&invoiceNo=${bill.id?.slice(-8).toUpperCase()}&date=${ds}&time=${ts}&amount=${Math.round(bill.total)}`;
}

// Draw QR using canvas (simple matrix QR — no external lib needed)
// We use a data URI approach via Google Charts API (offline fallback: text)
function QRCode({ data, size = 100 }) {
  const encoded = encodeURIComponent(data);
  // Google Charts QR — works online; degrades gracefully offline
  const src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encoded}&choe=UTF-8`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="FBR QR"
      style={{ display:"block", imageRendering:"pixelated" }}
      onError={e => { e.target.style.display="none"; }}
    />
  );
}

export default function FBRReceipt({ bill, onClose }) {
  if (!bill) return null;

  const date         = bill.date instanceof Date ? bill.date : new Date();
  const subtotal     = bill.subtotal     ?? 0;
  // Fallback: derive discount from items if bill doesn't carry a saved totalDiscount
  const itemsDiscount = (bill.items||[]).reduce((s,i)=>s+(Number(i.discount)||0)*(i.qty||0), 0);
  const totalDiscount = (bill.totalDiscount && bill.totalDiscount > 0) ? bill.totalDiscount : itemsDiscount;
  const gstAmount    = bill.gstAmount    ?? 0;
  const miscCharges  = bill.miscCharges  ?? 0;
  const total        = bill.total        ?? 0;
  const returned     = bill.returnedAmount ?? 0;
  const netTotal     = total - returned;
  const qrData       = buildQrData(bill);
  const invoiceNo    = bill.id?.slice(-8).toUpperCase() || "—";

  function handlePrint() { window.print(); }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:60,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div onClick={e=>e.stopPropagation()} style={{ position:"relative" }}>

          {/* Buttons — no print */}
          <div className="no-print"
            style={{ display:"flex", justifyContent:"flex-end", gap:8, marginBottom:10 }}>
            <button onClick={handlePrint}
              style={{ display:"flex", alignItems:"center", gap:6, background:"#0e6e5c",
                color:"white", fontSize:13, fontWeight:600, padding:"8px 18px",
                borderRadius:8, border:"none", cursor:"pointer" }}>
              <Printer size={14}/> Print Invoice
            </button>
            <button onClick={onClose}
              style={{ background:"white", border:"none", cursor:"pointer",
                color:"#6b7280", padding:"8px 10px", borderRadius:8 }}>
              <X size={16}/>
            </button>
          </div>

          {/* ── Receipt paper ── */}
          <div id="fbr-receipt"
            style={{ width:340, background:"white",
              fontFamily:"'Courier New', Courier, monospace",
              fontSize:11, color:"#111",
              padding:"18px 16px 14px",
              borderRadius:8, boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>

            {/* Store header */}
            <div style={{ textAlign:"center", borderBottom:"2px solid #111", paddingBottom:8, marginBottom:8 }}>
              <p style={{ fontWeight:700, fontSize:15, letterSpacing:1 }}>{STORE.name}</p>
              <p style={{ fontSize:10, marginTop:2 }}>{STORE.address}</p>
              <p style={{ fontSize:10 }}>{STORE.city} · {STORE.phone}</p>
            </div>

            {/* FBR details */}
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <p style={{ fontWeight:700, fontSize:12, letterSpacing:0.5 }}>
                ★ FBR TAX INVOICE ★
              </p>
              <p style={{ fontSize:10, color:"#555", marginTop:2 }}>
                NTN: {STORE.ntn}
              </p>
              <p style={{ fontSize:10, color:"#555" }}>
                STRN: {STORE.strn}
              </p>
            </div>

            <div style={{ borderTop:"1px dashed #999", margin:"6px 0" }}/>

            {/* Invoice meta */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, fontSize:10, marginBottom:6 }}>
              <span>Invoice #: <strong>{invoiceNo}</strong></span>
              <span style={{ textAlign:"right" }}>Date: {date.toLocaleDateString("en-PK")}</span>
              <span>Time: {date.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
              <span style={{ textAlign:"right" }}>Method: {bill.paymentMethod||"Cash"}</span>
            </div>

            {/* Customer */}
            <div style={{ fontSize:10, marginBottom:4 }}>
              <span>Customer: <strong>{bill.customerName||"Walk-in"}</strong></span>
              {bill.customerPhone && <span style={{ marginLeft:8 }}>Ph: {bill.customerPhone}</span>}
            </div>
            {bill.soldBy && <div style={{ fontSize:10, marginBottom:4, color:"#555" }}>Cashier: {bill.soldBy}</div>}

            <div style={{ borderTop:"1px dashed #999", margin:"6px 0" }}/>

            {/* Items table */}
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #333" }}>
                  <th style={{ textAlign:"left", paddingBottom:3, width:"34%" }}>Description</th>
                  <th style={{ textAlign:"center", paddingBottom:3, width:"8%" }}>Qty</th>
                  <th style={{ textAlign:"right", paddingBottom:3, width:"15%" }}>Rate</th>
                  <th style={{ textAlign:"right", paddingBottom:3, width:"15%" }}>Disc</th>
                  <th style={{ textAlign:"right", paddingBottom:3, width:"12%" }}>Tax</th>
                  <th style={{ textAlign:"right", paddingBottom:3, width:"16%" }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {(bill.items||[]).map((item,i) => {
                  const disc     = Number(item.discount||0);
                  const netUnit  = Math.max(0, item.price - disc);
                  const lineAmt  = netUnit * item.qty;
                  const lineTax  = bill.applyGst ? Math.round(lineAmt * 0.17 / 1.17) : 0;
                  return (
                    <tr key={i} style={{ borderBottom:"1px dotted #ccc" }}>
                      <td style={{ padding:"2px 0", wordBreak:"break-word", lineHeight:1.3 }}>{item.name}</td>
                      <td style={{ textAlign:"center", padding:"2px 0" }}>{item.qty}</td>
                      <td style={{ textAlign:"right", padding:"2px 0" }}>{item.price.toFixed(0)}</td>
                      <td style={{ textAlign:"right", padding:"2px 0", color: disc>0?"#c1121f":"#999" }}>{disc>0?disc.toFixed(0):"0"}</td>
                      <td style={{ textAlign:"right", padding:"2px 0", color:"#555" }}>{lineTax>0?lineTax.toFixed(0):"0"}</td>
                      <td style={{ textAlign:"right", padding:"2px 0", fontWeight:600 }}>{lineAmt.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ borderTop:"1px solid #333", margin:"6px 0" }}/>

            {/* Totals */}
            <div style={{ display:"flex", flexDirection:"column", gap:2, fontSize:11 }}>
              <Row2 label="Subtotal"          val={`Rs. ${subtotal.toFixed(0)}`}/>
              {totalDiscount>0 && <Row2 label="Total Discount (−)" val={`Rs. ${totalDiscount.toFixed(0)}`} red/>}
              {gstAmount>0    && <Row2 label="Sales Tax 17%"  val={`Rs. ${gstAmount.toFixed(0)}`}/>}
              {miscCharges>0  && <Row2 label="Misc (+)"       val={`Rs. ${miscCharges.toFixed(0)}`}/>}
            </div>

            <div style={{ borderTop:"2px solid #111", margin:"5px 0", paddingTop:4,
              display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:14 }}>
              <span>TOTAL (PKR)</span>
              <span>Rs. {total.toFixed(0)}</span>
            </div>

            {returned>0 && (
              <>
                <Row2 label="Returned (−)" val={`Rs. ${returned.toFixed(0)}`} red/>
                <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:12, marginTop:3 }}>
                  <span>NET PAYABLE</span><span>Rs. {netTotal.toFixed(0)}</span>
                </div>
              </>
            )}

            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>

            {/* QR code + FBR note */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <div>
                <QRCode data={qrData} size={80}/>
                <p style={{ fontSize:8, color:"#555", marginTop:3, width:80, textAlign:"center", lineHeight:1.3 }}>
                  FBR verification QR
                </p>
              </div>
              <div style={{ flex:1, fontSize:9, color:"#555", lineHeight:1.5 }}>
                <p style={{ fontWeight:700, color:"#111", fontSize:10, marginBottom:3 }}>
                  Verify at FBR Portal:
                </p>
                <p>invoice.fbr.gov.pk</p>
                <p style={{ marginTop:4 }}>
                  This invoice is electronically generated and is valid without signature.
                </p>
                <p style={{ marginTop:4, fontFamily:"sans-serif" }}>
                  یہ رسید FBR ٹیکس انوائس ہے
                </p>
              </div>
            </div>

            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>
            <p style={{ textAlign:"center", fontSize:10, color:"#555" }}>
              Shukriya! Sehat mand rahein. 🏥
            </p>
            <p style={{ textAlign:"center", fontSize:9, color:"#999", marginTop:2 }}>
              {STORE.phone} · {STORE.city}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #fbr-receipt, #fbr-receipt * { visibility: visible !important; }
          #fbr-receipt {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 80mm !important;
            padding: 4mm !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}

function Row2({ label, val, red }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", color:red?"#dc2626":"inherit" }}>
      <span>{label}</span><span style={{ fontFamily:"monospace" }}>{val}</span>
    </div>
  );
}
