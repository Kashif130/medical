"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { watchInventory, checkoutSale, checkoutCreditSale, expiryStatus, GST_RATE, fetchAllForBackup } from "@/lib/firebase";
import {
  Search, Plus, Minus, Trash2, ReceiptText, Printer,
  Wifi, WifiOff, Scan, Download, MessageSquare, FileText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FBRReceipt from "@/components/FBRReceipt";
import * as XLSX from "xlsx";

const STORE_NAME  = "Umer Din Medical Store";
const STORE_ADDR  = "Chak No.128/9L, Near Govt Girls High School";
const STORE_PHONE = "03116126145";

// ── Offline queue ─────────────────────────────────────────
const QUEUE_KEY = "pos_offline_queue";
function loadQueue()  { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); } catch { return []; } }
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

// QR data — encodes bill verification info (store, invoice #, date, amount)
function buildQrData(bill) {
  const date = bill.date instanceof Date ? bill.date : new Date();
  const ds   = date.toLocaleDateString("en-PK");
  const inv  = (bill.id||"").slice(-8).toUpperCase();
  return `${STORE_NAME}\nInvoice #${inv}\nDate: ${ds}\nTotal: Rs.${Math.round(bill.total||0)}\nPh: ${STORE_PHONE}`;
}
function qrImageUrl(data, size=110) {
  return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(data)}&choe=UTF-8`;
}

// ── Regular print receipt ─────────────────────────────────
function printReceipt(bill) {
  const w = window.open("","_blank","width=400,height=650");
  const qrSrc = qrImageUrl(buildQrData(bill), 110);
  const itemsDiscount = (bill.items||[]).reduce((s,i)=>s+(Number(i.discount)||0)*(i.qty||0), 0);
  const totalDiscount = (bill.totalDiscount && bill.totalDiscount > 0) ? bill.totalDiscount : itemsDiscount;
  w.document.write(`<html><head><title>Receipt</title>
  <style>body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:16px;width:280px;}
  h2{font-size:14px;text-align:center;margin:0 0 4px;}.center{text-align:center;}
  .row{display:flex;justify-content:space-between;padding:2px 0;}.divider{border-top:1px dashed #999;margin:6px 0;}
  .bold{font-weight:700;}.total{font-size:14px;font-weight:700;}
  .itemrow{padding:3px 0;}
  .itemname{font-weight:600;}
  .itemsub{display:flex;justify-content:space-between;font-size:10.5px;color:#444;}
  .discline{color:#c1121f;font-size:10.5px;}
  .qrwrap{text-align:center;margin-top:8px;}
  </style></head><body>
  <h2>${STORE_NAME}</h2>
  <p class="center" style="font-size:10px;margin:0 0 8px;">${STORE_ADDR}<br/>Ph: ${STORE_PHONE}</p>
  <div class="divider"></div>
  <div class="row"><span>${bill.date.toLocaleDateString("en-PK")} ${bill.date.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})}</span><span>Bill #${(bill.id||"").slice(-6).toUpperCase()}</span></div>
  <div class="row"><span>Customer: ${bill.customerName||"Walk-in"}</span><span>${bill.paymentMethod}</span></div>
  ${bill.soldBy?`<div style="font-size:10px;color:#555;">Sold by: ${bill.soldBy}</div>`:""}
  <div class="divider"></div>
  <div class="row bold"><span>Item</span><span>Amt</span></div>
  ${(bill.items||[]).map(i=>{
    const disc = Number(i.discount||0);
    const net  = Math.max(0, i.price - disc);
    const lineDiscTotal = disc*i.qty;
    return `<div class="itemrow">
      <div class="row"><span class="itemname">${i.name}</span><span>${(net*i.qty).toFixed(0)}</span></div>
      <div class="itemsub"><span>${i.qty} x Rs.${i.price}</span><span></span></div>
      ${disc>0?`<div class="discline">Discount (${i.qty} units): − Rs. ${lineDiscTotal.toFixed(0)}</div>`:""}
    </div>`;
  }).join("")}
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>Rs. ${(bill.subtotal||0).toFixed(0)}</span></div>
  ${(totalDiscount||0)>0?`<div class="row"><span>Total Discount</span><span style="color:red">- Rs. ${totalDiscount.toFixed(0)}</span></div>`:""}
  ${(bill.gstAmount||0)>0?`<div class="row"><span>GST (17%)</span><span>Rs. ${bill.gstAmount.toFixed(0)}</span></div>`:""}
  ${(bill.miscCharges||0)>0?`<div class="row"><span>Misc</span><span>Rs. ${bill.miscCharges.toFixed(0)}</span></div>`:""}
  <div class="divider"></div>
  <div class="row total"><span>GRAND TOTAL</span><span>Rs. ${(bill.total||0).toFixed(0)}</span></div>
  <div class="divider"></div>
  <div class="qrwrap"><img src="${qrSrc}" width="110" height="110"/><p style="font-size:9px;color:#555;margin-top:3px;">Scan to verify bill</p></div>
  <div class="divider"></div>
  <p class="center" style="margin-top:8px;font-size:11px;">Shukriya! Sehat mand rahein. 🏥<br/>${STORE_PHONE}</p>
  </body></html>`);
  w.document.close();
  setTimeout(()=>{w.print();w.close();},600);
}

export default function BillingPage() {
  const { profile, user } = useAuth();
  const [medicines, setMedicines]       = useState([]);
  const [search, setSearch]             = useState("");
  const [cart, setCart]                 = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [miscCharges, setMiscCharges]   = useState(0);
  const [applyGst, setApplyGst]         = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isCredit, setIsCredit]         = useState(false);
  const [error, setError]               = useState("");
  const [lastBill, setLastBill]         = useState(null);
  const [showFBR, setShowFBR]           = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [isOnline, setIsOnline]         = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const barcodeRef  = useRef("");
  const barcodeTimer= useRef(null);
  const searchRef   = useRef();

  useEffect(() => watchInventory(setMedicines), []);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth<768); }
    check(); window.addEventListener("resize",check);
    return () => window.removeEventListener("resize",check);
  }, []);

  // Online/offline
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    setIsOnline(navigator.onLine);
    setOfflineQueue(loadQueue());
    return () => { window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  }, []);

  // Auto-sync
  useEffect(() => {
    if (!isOnline) return;
    const q = loadQueue();
    if (q.length===0) return;
    setSyncingQueue(true);
    (async () => {
      const remaining=[];
      for (const sale of q) { try { await checkoutSale(sale); } catch { remaining.push(sale); } }
      saveQueue(remaining); setOfflineQueue(remaining); setSyncingQueue(false);
    })();
  }, [isOnline]);

  // Barcode scanner
  const handleBarcode = useCallback((code) => {
    const trimmed = code.trim(); if (!trimmed) return;
    const med = medicines.find(m => m.barcode===trimmed || m.name?.toLowerCase()===trimmed.toLowerCase());
    if (med) { addToCart(med); } else { setSearch(trimmed); searchRef.current?.focus(); }
  }, [medicines]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key==="Enter") {
        if (barcodeRef.current.length>2) { handleBarcode(barcodeRef.current); barcodeRef.current=""; }
        return;
      }
      if (e.key.length===1) {
        barcodeRef.current+=e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current=setTimeout(()=>{barcodeRef.current="";},300);
      }
    }
    window.addEventListener("keydown",onKeyDown);
    return () => window.removeEventListener("keydown",onKeyDown);
  }, [handleBarcode]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return medicines.filter(m =>
      m.name?.toLowerCase().includes(term) ||
      m.genericName?.toLowerCase().includes(term) ||
      m.barcode?.includes(term) ||
      m.category?.toLowerCase().includes(term)
    ).slice(0,8);
  }, [medicines, search]);

  function addToCart(med) {
    setCart(prev => {
      const ex = prev.find(i=>i.id===med.id);
      if (ex) return prev.map(i=>i.id===med.id?{...i,qty:Math.min(i.maxStock,i.qty+1)}:i);
      return [...prev,{id:med.id,name:med.name,price:med.price,costPrice:med.costPrice||0,qty:1,discount:0,maxStock:med.stock}];
    });
    setSearch("");
  }
  function changeQty(id,delta) { setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(1,Math.min(i.maxStock,i.qty+delta))}:i)); }
  function changeDiscount(id,val) {
    setCart(prev=>prev.map(i=>{
      if (i.id!==id) return i;
      const d = Math.max(0, Math.min(i.price, Number(val)||0)); // clamp 0..price
      return {...i, discount:d};
    }));
  }
  function removeItem(id) { setCart(prev=>prev.filter(i=>i.id!==id)); }

  // Per-item discount math
  const subtotal      = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const totalDiscount = cart.reduce((s,i)=>s+(Number(i.discount)||0)*i.qty,0);
  const afterDisc      = Math.max(0, subtotal - totalDiscount);
  const gstAmount      = applyGst ? Math.round(afterDisc*GST_RATE) : 0;
  const total          = Math.max(0, afterDisc + gstAmount + Number(miscCharges||0));

  // WhatsApp receipt
  function sendWhatsAppReceipt(bill) {
    if (!bill.customerPhone) { alert("Customer phone number nahi hai."); return; }
    const itemLines=(bill.items||[]).map(i=>{
      const disc = Number(i.discount||0);
      const net  = Math.max(0, i.price - disc);
      const line = `• ${i.name} x${i.qty} = Rs.${(net*i.qty).toFixed(0)}`;
      return disc>0 ? `${line} (disc: −Rs.${(disc*i.qty).toFixed(0)})` : line;
    }).join("\n");
    const msg=`🏥 *${STORE_NAME}*\n📍 ${STORE_ADDR}\n\n*Bill Receipt*\nDate: ${bill.date.toLocaleDateString("en-PK")}\nCustomer: ${bill.customerName||"Walk-in"}\n\n${itemLines}\n${bill.totalDiscount>0?`\nTotal Discount: - Rs.${bill.totalDiscount.toFixed(0)}`:""}${bill.gstAmount>0?`\nGST: Rs.${bill.gstAmount.toFixed(0)}`:""}${bill.miscCharges>0?`\nMisc: Rs.${bill.miscCharges.toFixed(0)}`:""}\n\n*Total: Rs.${bill.total.toFixed(0)}*\nPayment: ${bill.paymentMethod}\n\nShukriya! 🙏\n${STORE_PHONE}`;
    const phone=bill.customerPhone.replace(/\D/g,"");
    window.open(`https://wa.me/92${phone.replace(/^0/,"")}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  // Backup
  async function handleBackup() {
    try {
      const data=await fetchAllForBackup();
      const XLSX2=await import("xlsx");
      const wb=XLSX2.utils.book_new();
      const sheets={Medicines:data.medicines,Sales:data.sales,Purchases:data.purchases,Credits:data.credits,Returns:data.returns,Suppliers:data.suppliers};
      Object.entries(sheets).forEach(([name,rows])=>{
        if (!rows?.length) return;
        const flat=rows.map(r=>{
          const out={...r};
          ["createdAt","updatedAt"].forEach(k=>{if(out[k]?.toDate)out[k]=out[k].toDate().toLocaleString();});
          if (Array.isArray(out.items)) out.items=out.items.map(i=>`${i.name} x${i.qty}`).join(", ");
          if (Array.isArray(out.payments)) out.payments=out.payments.length;
          return out;
        });
        XLSX2.utils.book_append_sheet(wb,XLSX2.utils.json_to_sheet(flat),name);
      });
      XLSX2.writeFile(wb,`UmerDin-POS-Backup-${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch(e) { alert("Backup error: "+e.message); }
  }

  // Checkout
  async function handleCheckout() {
    if (cart.length===0) return;
    setBusy(true); setError("");
    const salePayload={
      items:cart.map(({id,name,price,costPrice,qty,discount})=>({id,name,price,costPrice,qty,discount:Number(discount)||0})),
      customerName,customerPhone,subtotal,totalDiscount,
      miscCharges:Number(miscCharges||0),applyGst,total,paymentMethod,
      createdBy:{uid:user?.uid||null,name:profile?.name||"Unknown"},
    };
    try {
      let saleId;
      if (!isOnline) {
        const q=[...loadQueue(),{...salePayload,_queuedAt:new Date().toISOString()}];
        saveQueue(q); setOfflineQueue(q); saleId="OFFLINE-"+Date.now();
      } else if (isCredit) {
        saleId=await checkoutCreditSale(salePayload);
      } else {
        saleId=await checkoutSale(salePayload);
      }
      const bill={
        id:saleId,date:new Date(),items:cart,
        subtotal,totalDiscount,
        miscCharges:Number(miscCharges||0),gstAmount,applyGst,total,
        customerName,customerPhone,
        paymentMethod:isCredit?"Udhar (Credit)":paymentMethod,
        soldBy:profile?.name||"Unknown",
      };
      setLastBill(bill);
      setCart([]); setCustomerName(""); setCustomerPhone("");
      setMiscCharges(0); setApplyGst(false); setIsCredit(false);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding:isMobile?16:32, maxWidth:1100 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Billing</h1>
          {offlineQueue.length>0 && <p style={{ fontSize:12, color:"#d97706" }}>⏳ {offlineQueue.length} sale(s) sync pending</p>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
            padding:"5px 10px", borderRadius:99, background:isOnline?"#dcfce7":"#fee2e2",
            color:isOnline?"#16a34a":"#dc2626" }}>
            {isOnline?<><Wifi size={13}/> Online</>:<><WifiOff size={13}/> Offline</>}
          </span>
          {syncingQueue && <span style={{ fontSize:12, color:"#d97706" }}>Syncing...</span>}
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#6b7280",
            padding:"5px 10px", borderRadius:99, background:"#f3f4f6", border:"1px solid #e5e7eb" }}>
            <Scan size={13}/> Barcode ready
          </span>
          <button onClick={handleBackup}
            style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
              padding:"7px 12px", borderRadius:8, background:"white", border:"1px solid #dce6e2",
              cursor:"pointer", color:"#374151" }}>
            <Download size={13}/> Backup
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:24, alignItems:"start" }}>

        {/* Left — search + cart */}
        <div>
          {/* Search */}
          <div style={{ position:"relative", marginBottom:12 }}>
            <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Medicine naam, generic naam ya barcode..."
              style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:10, paddingBottom:10,
                fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white",
                boxSizing:"border-box", outline:"none" }}/>
            {results.length>0 && (
              <div style={{ position:"absolute", zIndex:10, marginTop:4, width:"100%", background:"white",
                border:"1px solid #dce6e2", borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,0.08)", overflow:"hidden" }}>
                {results.map(m=>{
                  const out=(m.stock??0)<=0;
                  return (
                    <button key={m.id} disabled={out} onClick={()=>addToCart(m)}
                      style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 14px", background:"none", border:"none", cursor:out?"not-allowed":"pointer",
                        opacity:out?0.4:1, borderBottom:"1px solid #f0f4f2", textAlign:"left" }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>{m.name}</p>
                        {m.genericName && <p style={{ fontSize:11, color:"#0e6e5c" }}>{m.genericName}</p>}
                        {m.category && <p style={{ fontSize:11, color:"#9ca3af" }}>{m.category}</p>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <p style={{ fontSize:13, fontFamily:"monospace", fontWeight:600 }}>Rs. {m.price}</p>
                        <p style={{ fontSize:11, color:out?"#dc2626":"#9ca3af" }}>{out?"Out of stock":`${m.stock} left`}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:"1px solid #dce6e2" }}>
              <p style={{ fontSize:13, fontWeight:600 }}>Cart ({cart.length} items)</p>
            </div>
            {cart.length===0 && (
              <p style={{ padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                Upar search karo ya barcode scan karo
              </p>
            )}
            {cart.map(item=>{
              const disc    = Number(item.discount)||0;
              const netUnit = Math.max(0, item.price - disc);
              return (
                <div key={item.id} style={{ padding:"10px 14px", borderBottom:"1px solid #f0f4f2" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500 }}>{item.name}</p>
                      <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>
                        Rs. {item.price} each{disc>0 && <span style={{ color:"#dc2626" }}> · − Rs.{disc}/unit</span>}
                      </p>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", border:"1px solid #dce6e2", borderRadius:8 }}>
                        <button onClick={()=>changeQty(item.id,-1)} style={{ padding:"4px 8px", background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Minus size={12}/></button>
                        <span style={{ padding:"0 8px", fontSize:13, fontFamily:"monospace", fontWeight:600 }}>{item.qty}</span>
                        <button onClick={()=>changeQty(item.id,+1)} style={{ padding:"4px 8px", background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Plus size={12}/></button>
                      </div>
                      <span style={{ fontSize:13, fontFamily:"monospace", fontWeight:600, minWidth:60, textAlign:"right" }}>Rs. {(netUnit*item.qty).toFixed(0)}</span>
                      <button onClick={()=>removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                  {/* Per-unit discount input */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                    <span style={{ fontSize:11, color:"#6b7280", fontFamily:"monospace", textTransform:"uppercase", whiteSpace:"nowrap" }}>Disc/unit (Rs.)</span>
                    <input type="number" min={0} max={item.price} value={item.discount}
                      onChange={e=>changeDiscount(item.id, e.target.value)}
                      style={{ width:80, fontSize:12, padding:"4px 8px", border:"1px solid #dce6e2", borderRadius:6, outline:"none" }}/>
                    {disc>0 && (
                      <span style={{ fontSize:11, color:"#dc2626", fontFamily:"monospace" }}>
                        Line disc: − Rs. {(disc*item.qty).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Success bar */}
          {lastBill && (
            <div style={{ marginTop:12, background:"#f0faf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <p style={{ fontSize:13, color:"#0e6e5c", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                  <ReceiptText size={15}/> Rs. {lastBill.total.toFixed(0)} — {lastBill.paymentMethod}
                </p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>printReceipt(lastBill)}
                    style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
                      padding:"5px 10px", borderRadius:7, border:"1px solid #0e6e5c",
                      color:"#0e6e5c", background:"white", cursor:"pointer" }}>
                    <Printer size={12}/> Print
                  </button>
                  <button onClick={()=>setShowFBR(true)}
                    style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
                      padding:"5px 10px", borderRadius:7, border:"none",
                      color:"white", background:"#1e40af", cursor:"pointer" }}>
                    <FileText size={12}/> FBR Invoice
                  </button>
                  {lastBill.customerPhone && (
                    <button onClick={()=>sendWhatsAppReceipt(lastBill)}
                      style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
                        padding:"5px 10px", borderRadius:7, border:"none",
                        color:"white", background:"#25D366", cursor:"pointer" }}>
                      <MessageSquare size={12}/> WhatsApp
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — checkout */}
        <div>
          <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:18, position:"sticky", top:16 }}>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Checkout</p>

            <F label="Customer name"><input value={customerName} onChange={e=>setCustomerName(e.target.value)} style={inp}/></F>
            <F label="Phone (WhatsApp receipt)"><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="03XX-XXXXXXX" style={inp}/></F>
            <F label="Misc charges (Rs.)"><input type="number" min={0} value={miscCharges} onChange={e=>setMiscCharges(e.target.value)} style={inp}/></F>
            <F label="Payment method">
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} style={inp}>
                <option>Cash</option><option>Card</option><option>EasyPaisa</option><option>JazzCash</option>
              </select>
            </F>

            <div style={{ display:"flex", flexDirection:"column", gap:10, margin:"12px 0" }}>
              <Toggle label="Apply GST / S.Tax (17%)" value={applyGst}  onChange={setApplyGst}/>
              <Toggle label="Udhar / Credit sale"     value={isCredit}  onChange={setIsCredit} color="#d97706"/>
            </div>

            {/* Totals */}
            <div style={{ borderTop:"1px solid #f0f4f2", paddingTop:10, display:"flex", flexDirection:"column", gap:4, fontSize:13, marginBottom:12 }}>
              <Row label="Subtotal"  val={`Rs. ${subtotal.toFixed(0)}`}/>
              {totalDiscount>0 && <Row label="Total Discount (−)" val={`− Rs. ${totalDiscount.toFixed(0)}`} red/>}
              {applyGst             && <Row label="GST (17%)"  val={`+ Rs. ${gstAmount.toFixed(0)}`}/>}
              {Number(miscCharges)>0 && <Row label="Misc (+)"  val={`+ Rs. ${Number(miscCharges).toFixed(0)}`}/>}
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:15, borderTop:"1px solid #dce6e2", paddingTop:8, marginTop:4 }}>
                <span>{isCredit?"Udhar Total":"Grand Total"}</span>
                <span style={{ fontFamily:"monospace" }}>Rs. {total.toFixed(0)}</span>
              </div>
            </div>

            {!isOnline && <p style={{ fontSize:12, color:"#d97706", marginBottom:8, textAlign:"center" }}>⚠️ Offline — sale queue mein jayegi</p>}
            {isCredit   && <p style={{ fontSize:12, color:"#d97706", marginBottom:8, textAlign:"center" }}>📋 Credits page pe record hoga</p>}
            {error      && <p style={{ fontSize:12, color:"#dc2626", background:"#fee2e2", padding:"8px", borderRadius:8, marginBottom:8 }}>{error}</p>}

            <button onClick={handleCheckout} disabled={cart.length===0||busy}
              style={{ width:"100%", background:isCredit?"#d97706":"#0e6e5c", color:"white",
                fontSize:14, fontWeight:700, padding:"12px", borderRadius:10, border:"none",
                cursor:"pointer", opacity:cart.length===0?0.4:1 }}>
              {busy?"Processing...":isCredit?"Udhar record karein":!isOnline?"Queue mein add karein":"Complete sale"}
            </button>
          </div>
        </div>
      </div>

      {/* FBR Receipt Modal */}
      {showFBR && lastBill && (
        <FBRReceipt bill={lastBill} onClose={()=>setShowFBR(false)}/>
      )}
    </div>
  );
}

const inp = { width:"100%", fontSize:13, padding:"8px 10px", border:"1px solid #dce6e2", borderRadius:8, background:"white", boxSizing:"border-box", outline:"none" };

function F({ label, children }) {
  return (
    <label style={{ display:"block", marginBottom:10 }}>
      <span style={{ display:"block", fontSize:10, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", marginBottom:4 }}>{label}</span>
      {children}
    </label>
  );
}
function Row({ label, val, red }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", color:red?"#dc2626":"#6b7280" }}>
      <span>{label}</span><span style={{ fontFamily:"monospace" }}>{val}</span>
    </div>
  );
}
function Toggle({ label, value, onChange, color="#0e6e5c" }) {
  return (
    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
      <div onClick={()=>onChange(!value)}
        style={{ width:36, height:20, borderRadius:99, background:value?color:"#e5e7eb", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
        <span style={{ position:"absolute", top:2, left:value?18:2, width:16, height:16, borderRadius:99, background:"white", boxShadow:"0 1px 3px rgba(0,0,0,0.2)", transition:"left 0.2s" }}/>
      </div>
      <span style={{ fontSize:12, color:"#6b7280" }}>{label}</span>
    </label>
  );
}
