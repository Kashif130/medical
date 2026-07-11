"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { watchInventory, checkoutSale, checkoutCreditSale, expiryStatus, GST_RATE, fetchAllForBackup } from "@/lib/firebase";
import {
  Search, Plus, Minus, Trash2, ReceiptText, Printer,
  Wifi, WifiOff, Scan, Download, MessageSquare
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";

const STORE_NAME  = "Umer Din Medical Store";
const STORE_ADDR  = "Apna address yahan likho";
const STORE_PHONE = "03XX-XXXXXXX";

// ── Offline queue helpers ─────────────────────────────────
const QUEUE_KEY = "pos_offline_queue";
function loadQueue()  { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); } catch { return []; } }
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

// ── Receipt print helper ──────────────────────────────────
function printReceipt(bill) {
  const w = window.open("", "_blank", "width=400,height=600");
  w.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 16px; width: 280px; }
      h2 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .divider { border-top: 1px dashed #999; margin: 6px 0; }
      .bold { font-weight: 700; }
      .total { font-size: 14px; font-weight: 700; }
    </style></head><body>
    <h2>${STORE_NAME}</h2>
    <p class="center" style="font-size:10px;margin:0 0 8px;">${STORE_ADDR}<br/>${STORE_PHONE}</p>
    <div class="divider"></div>
    <div class="row"><span>${bill.date.toLocaleDateString("en-PK")} ${bill.date.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})}</span><span>Bill #${(bill.id||"").slice(-6).toUpperCase()}</span></div>
    <div class="row"><span>Customer: ${bill.customerName||"Walk-in"}</span><span>${bill.paymentMethod}</span></div>
    ${bill.soldBy ? `<div style="font-size:10px;color:#555;">Sold by: ${bill.soldBy}</div>` : ""}
    <div class="divider"></div>
    <div class="row bold"><span>Item</span><span>Qty</span><span>Rate</span><span>Amt</span></div>
    ${(bill.items||[]).map(i=>`<div class="row"><span style="max-width:110px;overflow:hidden">${i.name}</span><span>${i.qty}</span><span>${i.price}</span><span>${(i.price*i.qty).toFixed(0)}</span></div>`).join("")}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>Rs. ${(bill.subtotal||0).toFixed(0)}</span></div>
    ${(bill.flatDiscount||0)>0?`<div class="row"><span>Discount</span><span style="color:red">- Rs. ${bill.flatDiscount.toFixed(0)}</span></div>`:""}
    ${(bill.gstAmount||0)>0?`<div class="row"><span>GST (17%)</span><span>Rs. ${bill.gstAmount.toFixed(0)}</span></div>`:""}
    ${(bill.miscCharges||0)>0?`<div class="row"><span>Misc</span><span>Rs. ${bill.miscCharges.toFixed(0)}</span></div>`:""}
    <div class="divider"></div>
    <div class="row total"><span>GRAND TOTAL</span><span>Rs. ${(bill.total||0).toFixed(0)}</span></div>
    <div class="divider"></div>
    <p class="center" style="margin-top:8px;font-size:11px;">Shukriya! Sehat mand rahein. 🏥<br/>${STORE_PHONE}</p>
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

export default function BillingPage() {
  const { profile, user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch]       = useState("");
  const [cart, setCart]           = useState([]);
  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [flatDiscount, setFlatDiscount]   = useState(0);
  const [miscCharges, setMiscCharges]     = useState(0);
  const [applyGst, setApplyGst]           = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isCredit, setIsCredit]           = useState(false);
  const [error, setError]   = useState("");
  const [lastBill, setLastBill] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const barcodeRef = useRef("");
  const barcodeTimer = useRef(null);
  const searchRef = useRef();

  useEffect(() => watchInventory(setMedicines), []);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Online/offline detection ──────────────────────────
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setIsOnline(navigator.onLine);
    setOfflineQueue(loadQueue());
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Auto-sync when back online ────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    const q = loadQueue();
    if (q.length === 0) return;
    setSyncingQueue(true);
    (async () => {
      const remaining = [];
      for (const sale of q) {
        try { await checkoutSale(sale); }
        catch { remaining.push(sale); }
      }
      saveQueue(remaining);
      setOfflineQueue(remaining);
      setSyncingQueue(false);
    })();
  }, [isOnline]);

  // ── Barcode scanner (keyboard wedge) ─────────────────
  const handleBarcode = useCallback((code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const med = medicines.find(m =>
      m.barcode === trimmed || m.name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (med) {
      addToCart(med);
    } else {
      setSearch(trimmed);
      searchRef.current?.focus();
    }
  }, [medicines]);

  useEffect(() => {
    function onKeyDown(e) {
      // Scanner sends chars fast then Enter
      if (e.key === "Enter") {
        if (barcodeRef.current.length > 2) {
          handleBarcode(barcodeRef.current);
          barcodeRef.current = "";
        }
        return;
      }
      if (e.key.length === 1) {
        barcodeRef.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeRef.current = ""; }, 300);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBarcode]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return medicines.filter(m =>
      m.name?.toLowerCase().includes(term) ||
      m.barcode?.includes(term) ||
      m.category?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [medicines, search]);

  function addToCart(med) {
    setCart(prev => {
      const ex = prev.find(i => i.id === med.id);
      if (ex) return prev.map(i => i.id===med.id ? {...i, qty: Math.min(i.maxStock, i.qty+1)} : i);
      return [...prev, { id:med.id, name:med.name, price:med.price, costPrice:med.costPrice||0, qty:1, maxStock:med.stock }];
    });
    setSearch("");
  }

  function changeQty(id, delta) {
    setCart(prev => prev.map(i => i.id===id ? {...i, qty: Math.max(1, Math.min(i.maxStock, i.qty+delta))} : i));
  }
  function removeItem(id) { setCart(prev => prev.filter(i => i.id!==id)); }

  const subtotal    = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const afterDisc   = Math.max(0, subtotal - Number(flatDiscount||0));
  const gstAmount   = applyGst ? Math.round(afterDisc * GST_RATE) : 0;
  const total       = Math.max(0, afterDisc + gstAmount + Number(miscCharges||0));

  // ── WhatsApp/SMS receipt ──────────────────────────────
  function sendWhatsAppReceipt(bill) {
    if (!bill.customerPhone) { alert("Customer phone number nahi hai."); return; }
    const itemLines = (bill.items||[]).map(i => `• ${i.name} x${i.qty} = Rs.${(i.price*i.qty).toFixed(0)}`).join("\n");
    const msg = `🏥 *${STORE_NAME}*\n📍 ${STORE_ADDR}\n\n*Bill Receipt*\nDate: ${bill.date.toLocaleDateString("en-PK")}\nCustomer: ${bill.customerName||"Walk-in"}\n\n${itemLines}\n${bill.flatDiscount>0?`\nDiscount: - Rs.${bill.flatDiscount.toFixed(0)}`:""}${bill.gstAmount>0?`\nGST: Rs.${bill.gstAmount.toFixed(0)}`:""}${bill.miscCharges>0?`\nMisc: Rs.${bill.miscCharges.toFixed(0)}`:""}\n\n*Total: Rs.${bill.total.toFixed(0)}*\nPayment: ${bill.paymentMethod}\n\nShukriya! 🙏\n${STORE_PHONE}`;
    const phone = bill.customerPhone.replace(/\D/g,"");
    window.open(`https://wa.me/92${phone.replace(/^0/,"")}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // ── Backup export ─────────────────────────────────────
  async function handleBackup() {
    try {
      const data = await fetchAllForBackup();
      const wb   = XLSX.utils.book_new();
      const sheets = {
        Medicines: data.medicines, Sales: data.sales, Purchases: data.purchases,
        Credits: data.credits, Returns: data.returns, Suppliers: data.suppliers,
      };
      Object.entries(sheets).forEach(([name, rows]) => {
        if (!rows?.length) return;
        const flat = rows.map(r => {
          const out = {...r};
          ["createdAt","updatedAt"].forEach(k => { if (out[k]?.toDate) out[k] = out[k].toDate().toLocaleString(); });
          if (Array.isArray(out.items)) out.items = out.items.map(i=>`${i.name} x${i.qty}`).join(", ");
          if (Array.isArray(out.payments)) out.payments = out.payments.length;
          return out;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), name);
      });
      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `UmerDin-POS-Backup-${date}.xlsx`);
    } catch(e) { alert("Backup mein masla: " + e.message); }
  }

  // ── Checkout ──────────────────────────────────────────
  async function handleCheckout() {
    if (cart.length === 0) return;
    setBusy(true); setError("");
    const salePayload = {
      items: cart.map(({id,name,price,costPrice,qty}) => ({id,name,price,costPrice,qty})),
      customerName, customerPhone, subtotal, flatDiscount:Number(flatDiscount||0),
      miscCharges:Number(miscCharges||0), applyGst, total, paymentMethod,
      createdBy: { uid: user?.uid||null, name: profile?.name||"Unknown" },
    };
    try {
      let saleId;
      if (!isOnline) {
        // Queue for later
        const q = [...loadQueue(), { ...salePayload, _queuedAt: new Date().toISOString() }];
        saveQueue(q); setOfflineQueue(q);
        saleId = "OFFLINE-" + Date.now();
      } else if (isCredit) {
        saleId = await checkoutCreditSale(salePayload);
      } else {
        saleId = await checkoutSale(salePayload);
      }
      const bill = {
        id: saleId, date: new Date(), items: cart,
        subtotal, flatDiscount:Number(flatDiscount||0),
        miscCharges:Number(miscCharges||0), gstAmount, total,
        customerName, customerPhone, paymentMethod: isCredit?"Udhar (Credit)":paymentMethod,
        soldBy: profile?.name||"Unknown",
      };
      setLastBill(bill);
      setCart([]); setCustomerName(""); setCustomerPhone("");
      setFlatDiscount(0); setMiscCharges(0); setApplyGst(false); setIsCredit(false);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: isMobile?16:32, maxWidth:1100 }}>

      {/* Header bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Billing</h1>
          {offlineQueue.length>0 && (
            <p style={{ fontSize:12, color:"#d97706" }}>⏳ {offlineQueue.length} sale(s) online hone pe sync hongi</p>
          )}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {/* Online/offline badge */}
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
            padding:"5px 10px", borderRadius:99, background:isOnline?"#dcfce7":"#fee2e2",
            color:isOnline?"#16a34a":"#dc2626" }}>
            {isOnline ? <><Wifi size={13}/> Online</> : <><WifiOff size={13}/> Offline</>}
          </span>
          {syncingQueue && <span style={{ fontSize:12, color:"#d97706" }}>Syncing...</span>}
          {/* Scanner hint */}
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#6b7280",
            padding:"5px 10px", borderRadius:99, background:"#f3f4f6", border:"1px solid #e5e7eb" }}>
            <Scan size={13}/> Barcode ready
          </span>
          {/* Backup button */}
          <button onClick={handleBackup} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600,
            padding:"7px 12px", borderRadius:8, background:"white", border:"1px solid #dce6e2", cursor:"pointer", color:"#374151" }}>
            <Download size={13}/> Backup
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr 1fr", gap:24, alignItems:"start" }}>
        {/* Left: search + cart */}
        <div style={{ gridColumn: isMobile?"1":"1 / 3" }}>

          {/* Search */}
          <div style={{ position:"relative", marginBottom:12 }}>
            <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Medicine naam ya barcode type karein..."
              style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:10, paddingBottom:10, fontSize:13,
                border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
            {results.length>0 && (
              <div style={{ position:"absolute", zIndex:10, marginTop:4, width:"100%", background:"white",
                border:"1px solid #dce6e2", borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,0.08)", overflow:"hidden" }}>
                {results.map(m=>{
                  const out = (m.stock??0)<=0;
                  return (
                    <button key={m.id} disabled={out} onClick={()=>addToCart(m)}
                      style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 14px", background:"none", border:"none", cursor:out?"not-allowed":"pointer",
                        opacity:out?0.4:1, borderBottom:"1px solid #f0f4f2", textAlign:"left" }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>{m.name}</p>
                        {m.category && <p style={{ fontSize:11, color:"#9ca3af" }}>{m.category}</p>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <p style={{ fontSize:13, fontFamily:"monospace", fontWeight:600 }}>Rs. {m.price}</p>
                        <p style={{ fontSize:11, color: out?"#dc2626":"#9ca3af" }}>{out?"Out of stock":`${m.stock} left`}</p>
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
            {cart.map(item=>(
              <div key={item.id} style={{ padding:"10px 14px", borderBottom:"1px solid #f0f4f2", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:500 }}>{item.name}</p>
                  <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>Rs. {item.price} each</p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", border:"1px solid #dce6e2", borderRadius:8 }}>
                    <button onClick={()=>changeQty(item.id,-1)} style={{ padding:"4px 8px", background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Minus size={12}/></button>
                    <span style={{ padding:"0 8px", fontSize:13, fontFamily:"monospace", fontWeight:600 }}>{item.qty}</span>
                    <button onClick={()=>changeQty(item.id,+1)} style={{ padding:"4px 8px", background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Plus size={12}/></button>
                  </div>
                  <span style={{ fontSize:13, fontFamily:"monospace", fontWeight:600, minWidth:60, textAlign:"right" }}>Rs. {(item.price*item.qty).toFixed(0)}</span>
                  <button onClick={()=>removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>

          {/* Success bar */}
          {lastBill && (
            <div style={{ marginTop:12, background:"#f0faf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <p style={{ fontSize:13, color:"#0e6e5c", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                  <ReceiptText size={15}/> Rs. {lastBill.total.toFixed(0)} — {lastBill.paymentMethod}
                </p>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>printReceipt(lastBill)}
                    style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, padding:"5px 10px",
                      borderRadius:7, border:"1px solid #0e6e5c", color:"#0e6e5c", background:"white", cursor:"pointer" }}>
                    <Printer size={12}/> Print
                  </button>
                  {lastBill.customerPhone && (
                    <button onClick={()=>sendWhatsAppReceipt(lastBill)}
                      style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, padding:"5px 10px",
                        borderRadius:7, border:"none", color:"white", background:"#25D366", cursor:"pointer" }}>
                      <MessageSquare size={12}/> WhatsApp
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: checkout panel */}
        <div>
          <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:18, position:"sticky", top:16 }}>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Checkout</p>

            <F label="Customer name">
              <input value={customerName} onChange={e=>setCustomerName(e.target.value)} style={inp}/>
            </F>
            <F label="Phone (WhatsApp receipt ke liye)">
              <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="03XX-XXXXXXX" style={inp}/>
            </F>
            <F label="Flat Discount (Rs.)">
              <input type="number" min={0} value={flatDiscount} onChange={e=>setFlatDiscount(e.target.value)} style={inp}/>
            </F>
            <F label="Misc charges (Rs.)">
              <input type="number" min={0} value={miscCharges} onChange={e=>setMiscCharges(e.target.value)} style={inp}/>
            </F>
            <F label="Payment method">
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} style={inp}>
                <option>Cash</option><option>Card</option><option>EasyPaisa</option><option>JazzCash</option>
              </select>
            </F>

            {/* Toggles */}
            <div style={{ display:"flex", flexDirection:"column", gap:10, margin:"12px 0" }}>
              <Toggle label="Apply GST / S.Tax (17%)" value={applyGst} onChange={setApplyGst}/>
              <Toggle label="Udhar / Credit sale" value={isCredit} onChange={setIsCredit} color="#d97706"/>
            </div>

            {/* Totals */}
            <div style={{ borderTop:"1px solid #f0f4f2", paddingTop:10, display:"flex", flexDirection:"column", gap:4, fontSize:13, marginBottom:12 }}>
              <Row label="Subtotal"    val={`Rs. ${subtotal.toFixed(0)}`}/>
              {Number(flatDiscount)>0 && <Row label="Disc (−)"   val={`− Rs. ${Number(flatDiscount).toFixed(0)}`} red/>}
              {applyGst             && <Row label="GST (17%)"    val={`+ Rs. ${gstAmount.toFixed(0)}`}/>}
              {Number(miscCharges)>0 && <Row label="Misc (+)"    val={`+ Rs. ${Number(miscCharges).toFixed(0)}`}/>}
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:15, borderTop:"1px solid #dce6e2", paddingTop:8, marginTop:4 }}>
                <span>{isCredit?"Udhar Total":"Grand Total"}</span>
                <span style={{ fontFamily:"monospace" }}>Rs. {total.toFixed(0)}</span>
              </div>
            </div>

            {!isOnline && <p style={{ fontSize:12, color:"#d97706", marginBottom:8, textAlign:"center" }}>⚠️ Offline — sale queue mein jayegi</p>}
            {isCredit   && <p style={{ fontSize:12, color:"#d97706", marginBottom:8, textAlign:"center" }}>📋 Udhar tab mein record ho ga</p>}
            {error      && <p style={{ fontSize:12, color:"#dc2626", background:"#fee2e2", padding:"8px", borderRadius:8, marginBottom:8 }}>{error}</p>}

            <button onClick={handleCheckout} disabled={cart.length===0||busy}
              style={{ width:"100%", background: isCredit?"#d97706":"#0e6e5c", color:"white", fontSize:14,
                fontWeight:700, padding:"12px", borderRadius:10, border:"none", cursor:"pointer",
                opacity:cart.length===0?0.4:1 }}>
              {busy?"Processing...": isCredit ? "Udhar record karein" : !isOnline ? "Queue mein add karein" : "Complete sale"}
            </button>
          </div>
        </div>
      </div>
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
    <div style={{ display:"flex", justifyContent:"space-between", color: red?"#dc2626":"#6b7280" }}>
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
