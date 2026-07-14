"use client";

import { useEffect, useState, useMemo } from "react";
import { watchSales, watchReturns, createReturn } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Search, RotateCcw, X, CheckCircle2 } from "lucide-react";

export default function ReturnsPage() {
  const { user, profile } = useAuth();
  const [sales, setSales]     = useState([]);
  const [returns, setReturns] = useState([]);
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState(null);   // sale being returned
  const [returnItems, setReturnItems] = useState([]); // which items + qty
  const [reason, setReason]   = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [busy, setBusy]       = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  useEffect(() => watchSales(setSales), []);
  useEffect(() => watchReturns(setReturns), []);

  const filteredSales = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return sales.slice(0, 30);
    return sales.filter(s =>
      s.customerName?.toLowerCase().includes(t) ||
      s.id?.toLowerCase().includes(t) ||
      s.items?.some(i => i.name?.toLowerCase().includes(t))
    );
  }, [sales, search]);

  function openReturn(sale) {
    setSelected(sale);
    setReturnItems(sale.items.map(i => ({ ...i, returnQty: 0 })));
    setReason(""); setRefundMethod("Cash"); setError(""); setSuccess("");
  }

  function updateQty(id, val) {
    setReturnItems(prev => prev.map(i =>
      i.id === id ? { ...i, returnQty: Math.min(i.qty, Math.max(0, Number(val))) } : i
    ));
  }

  const refundItems  = returnItems.filter(i => i.returnQty > 0);

  // Each item carries its own per-unit discount, so refund = (price - discount) x returnQty.
  const refundAmount = refundItems.reduce((s, i) => {
    const netUnit = Math.max(0, i.price - (Number(i.discount)||0));
    return s + netUnit * i.returnQty;
  }, 0);

  async function handleSubmit() {
    if (refundItems.length === 0) { setError("Kam az kam ek item select karein."); return; }
    setBusy(true); setError("");
    try {
      await createReturn({
        saleId: selected.id,
        items:  refundItems.map(i => ({ id: i.id, name: i.name, qty: i.returnQty, price: i.price, discount: Number(i.discount)||0 })),
        reason, refundAmount, refundMethod,
        createdBy: { uid: user?.uid, name: profile?.name || "Unknown" },
      });
      setSuccess(`Return complete — Rs. ${refundAmount.toFixed(0)} refund (${refundMethod}). Stock wapas aa gaya.`);
      setSelected(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Returns & Refunds</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Customer wapas aaye — medicine return karo, stock aur refund automatic</p>

      {success && (
        <div style={{ display:"flex", gap:8, alignItems:"center", background:"#f0faf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"12px 16px", marginBottom:16, color:"#0e6e5c", fontSize:13 }}>
          <CheckCircle2 size={16}/> {success}
        </div>
      )}

      {/* Search past sales */}
      <div style={{ position:"relative", marginBottom:16 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer naam ya bill ID search karein..."
          style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
      </div>

      {/* Sales list */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden", marginBottom:32 }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Customer","Items","Total",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:h==="Total"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(s => {
              const date = s.createdAt?.toDate?.() || new Date();
              const hasReturn = returns.some(r => r.saleId === s.id);
              return (
                <tr key={s.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                  <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>{date.toLocaleDateString("en-PK")}</td>
                  <td style={{ padding:"9px 12px", fontWeight:500 }}>{s.customerName||"Walk-in"}</td>
                  <td style={{ padding:"9px 12px", fontSize:12, color:"#6b7280" }}>{s.items?.length||0} items</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>Rs. {(s.total||0).toFixed(0)}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <button onClick={()=>openReturn(s)}
                      style={{ display:"flex", alignItems:"center", gap:5, background: hasReturn?"#f3f4f6":"#f0faf5", border:`1px solid ${hasReturn?"#e5e7eb":"#a7f3d0"}`, color:hasReturn?"#6b7280":"#0e6e5c", fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:6, cursor:"pointer" }}>
                      <RotateCcw size={12}/> {hasReturn ? "Again return" : "Return"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredSales.length===0 && (
              <tr><td colSpan={5} style={{ padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi sale nahi mili.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Return history */}
      <h2 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Return History</h2>
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Items","Reason","Method","Refund"].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:h==="Refund"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.map(r=>{
              const date = r.createdAt?.toDate?.()|| new Date();
              return (
                <tr key={r.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                  <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>{date.toLocaleDateString("en-PK")}</td>
                  <td style={{ padding:"9px 12px", fontSize:12, color:"#6b7280" }}>{r.items?.map(i=>`${i.name} x${i.qty}`).join(", ")}</td>
                  <td style={{ padding:"9px 12px", fontSize:12 }}>{r.reason||"—"}</td>
                  <td style={{ padding:"9px 12px", fontSize:12 }}>{r.refundMethod}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:600, color:"#dc2626" }}>− Rs. {(r.refundAmount||0).toFixed(0)}</td>
                </tr>
              );
            })}
            {returns.length===0&&<tr><td colSpan={5} style={{ padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi return nahi hua abhi tak.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:500, padding:24, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>Return — {selected.customerName||"Walk-in"}</h2>
              <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={18}/></button>
            </div>
            {error && <p style={{ fontSize:13, color:"#dc2626", background:"#fee2e2", padding:"8px 12px", borderRadius:8, marginBottom:12 }}>{error}</p>}

            <p style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Kitni quantity wapas aa rahi hai? (0 = return nahi)</p>
            {returnItems.map(item=>{
              const disc = Number(item.discount)||0;
              return (
                <div key={item.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f0f4f2" }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:500 }}>{item.name}</p>
                    <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>
                      Rs. {item.price} × max {item.qty}{disc>0 && <span style={{ color:"#dc2626" }}> · disc − Rs.{disc}/unit</span>}
                    </p>
                  </div>
                  <input type="number" min={0} max={item.qty} value={item.returnQty}
                    onChange={e=>updateQty(item.id, e.target.value)}
                    style={{ width:64, textAlign:"center", fontSize:14, fontWeight:600, padding:"6px 8px", border:"1px solid #dce6e2", borderRadius:8, outline:"none" }}/>
                </div>
              );
            })}

            <div style={{ marginTop:16 }}>
              <label style={{ display:"block", marginBottom:10 }}>
                <span style={{ fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:4 }}>Wapsi ki wajah</span>
                <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. غلط دوائی، expiry..." style={{ width:"100%", fontSize:13, padding:"8px 10px", border:"1px solid #dce6e2", borderRadius:8, outline:"none", boxSizing:"border-box" }}/>
              </label>
              <label style={{ display:"block", marginBottom:16 }}>
                <span style={{ fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:4 }}>Refund method</span>
                <select value={refundMethod} onChange={e=>setRefundMethod(e.target.value)} style={{ width:"100%", fontSize:13, padding:"8px 10px", border:"1px solid #dce6e2", borderRadius:8, outline:"none", background:"white" }}>
                  <option>Cash</option><option>EasyPaisa</option><option>JazzCash</option><option>Bank transfer</option>
                </select>
              </label>
            </div>

            {refundAmount > 0 && (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, color:"#dc2626" }}>Refund amount</span>
                <span style={{ fontSize:16, fontWeight:700, color:"#dc2626", fontFamily:"monospace" }}>Rs. {refundAmount.toFixed(0)}</span>
              </div>
            )}

            <button onClick={handleSubmit} disabled={busy||refundItems.length===0}
              style={{ width:"100%", background:"#dc2626", color:"white", fontSize:13, fontWeight:600, padding:"11px", borderRadius:10, border:"none", cursor:"pointer", opacity: refundItems.length===0?0.4:1 }}>
              {busy ? "Processing..." : `Confirm return — Rs. ${refundAmount.toFixed(0)} refund`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
