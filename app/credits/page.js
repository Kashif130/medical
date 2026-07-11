"use client";

import { useEffect, useState, useMemo } from "react";
import { watchCredits, addCreditPayment } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Search, CreditCard, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";

const STATUS_STYLE = {
  paid:    { bg:"#dcfce7", color:"#16a34a", label:"Paid" },
  partial: { bg:"#fef9c3", color:"#d97706", label:"Partial" },
  pending: { bg:"#fee2e2", color:"#dc2626", label:"Pending" },
};

export default function CreditsPage() {
  const { user, profile } = useAuth();
  const [credits, setCredits]     = useState([]);
  const [search, setSearch]       = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [payModal, setPayModal]   = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => watchCredits(setCredits), []);

  const filtered = useMemo(() => {
    let list = credits;
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    const t = search.trim().toLowerCase();
    if (t) list = list.filter(c => c.customerName?.toLowerCase().includes(t) || c.customerPhone?.includes(t));
    return list;
  }, [credits, search, filterStatus]);

  const totalPending = credits.filter(c=>c.status!=="paid").reduce((s,c)=>s+(c.remaining||0),0);
  const totalCount   = credits.filter(c=>c.status!=="paid").length;

  async function handlePayment() {
    if (!payAmount || Number(payAmount) <= 0) { setError("Valid amount darj karein."); return; }
    if (Number(payAmount) > payModal.remaining) { setError(`Maximum Rs. ${payModal.remaining.toFixed(0)} receive ho sakta hai.`); return; }
    setBusy(true); setError("");
    try {
      await addCreditPayment(payModal.id, payAmount, { uid: user?.uid, name: profile?.name });
      setPayModal(null); setPayAmount("");
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding:24, maxWidth:1000 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Udhar / Credit Sales</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Baaki payment track karein — har customer ka hisaab</p>
        </div>
        <div style={{ background:"#fee2e2", border:"1px solid #fecaca", borderRadius:12, padding:"12px 20px", textAlign:"right" }}>
          <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace", textTransform:"uppercase" }}>Total baaki</p>
          <p style={{ fontSize:22, fontWeight:800, color:"#dc2626", fontFamily:"monospace" }}>Rs. {totalPending.toFixed(0)}</p>
          <p style={{ fontSize:11, color:"#9ca3af" }}>{totalCount} customers</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer naam ya phone..."
            style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
        </div>
        {["all","pending","partial","paid"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)}
            style={{ fontSize:12, fontWeight:600, padding:"8px 14px", borderRadius:8, cursor:"pointer",
              background: filterStatus===s ? "#0e6e5c" : "white",
              color: filterStatus===s ? "white" : "#6b7280",
              border: filterStatus===s ? "none" : "1px solid #dce6e2" }}>
            {s==="all"?"Sab":s==="pending"?"Pending":s==="partial"?"Partial":"Paid"}
          </button>
        ))}
      </div>

      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Customer","Date","Total","Paid","Baaki","Status",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:["Total","Paid","Baaki"].includes(h)?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c=>{
              const date  = c.createdAt?.toDate?.() || new Date();
              const st    = STATUS_STYLE[c.status] || STATUS_STYLE.pending;
              const isExp = expandedId === c.id;
              return (
                <>
                  <tr key={c.id} style={{ borderBottom:"1px solid #f0f4f2", cursor:"pointer" }} onClick={()=>setExpandedId(isExp?null:c.id)}>
                    <td style={{ padding:"10px 12px" }}>
                      <p style={{ fontWeight:600 }}>{c.customerName||"—"}</p>
                      {c.customerPhone && <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{c.customerPhone}</p>}
                    </td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>{date.toLocaleDateString("en-PK")}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"monospace" }}>Rs. {(c.totalAmount||0).toFixed(0)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"monospace", color:"#16a34a" }}>Rs. {(c.paidAmount||0).toFixed(0)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color: c.remaining>0?"#dc2626":"#16a34a" }}>Rs. {(c.remaining||0).toFixed(0)}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:st.bg, color:st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding:"10px 8px" }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        {c.status!=="paid" && (
                          <button onClick={e=>{e.stopPropagation();setPayModal(c);setPayAmount("");setError("");}}
                            style={{ display:"flex", alignItems:"center", gap:4, background:"#0e6e5c", color:"white", fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer" }}>
                            <CreditCard size={12}/> Payment
                          </button>
                        )}
                        {isExp ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${c.id}-exp`}>
                      <td colSpan={7} style={{ padding:"0 12px 16px", background:"#f8faf9" }}>
                        <div style={{ paddingTop:12 }}>
                          <p style={{ fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8 }}>Items sold:</p>
                          {(c.items||[]).map((item,i)=>(
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", borderBottom:"1px solid #e5ede9" }}>
                              <span>{item.name} × {item.qty}</span>
                              <span style={{ fontFamily:"monospace" }}>Rs. {(item.price*item.qty).toFixed(0)}</span>
                            </div>
                          ))}
                          {(c.payments||[]).length > 0 && (
                            <>
                              <p style={{ fontSize:12, fontWeight:600, color:"#6b7280", margin:"12px 0 6px" }}>Payment history:</p>
                              {c.payments.map((p,i)=>(
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0" }}>
                                  <span style={{ color:"#6b7280" }}>{new Date(p.date).toLocaleDateString("en-PK")} — {p.by}</span>
                                  <span style={{ color:"#16a34a", fontFamily:"monospace", fontWeight:600 }}>+ Rs. {p.amount}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={7} style={{ padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi credit sale nahi mili.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Payment modal */}
      {payModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:380, padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>Payment receive karein</h2>
              <button onClick={()=>setPayModal(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={18}/></button>
            </div>
            <p style={{ fontSize:13, color:"#6b7280", marginBottom:4 }}>Customer: <strong>{payModal.customerName}</strong></p>
            <p style={{ fontSize:13, color:"#dc2626", marginBottom:16, fontFamily:"monospace" }}>Baaki: Rs. {(payModal.remaining||0).toFixed(0)}</p>
            {error && <p style={{ fontSize:13, color:"#dc2626", background:"#fee2e2", padding:"8px 12px", borderRadius:8, marginBottom:12 }}>{error}</p>}
            <label style={{ display:"block", marginBottom:16 }}>
              <span style={{ fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:4 }}>Amount (Rs.)</span>
              <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder={`Max Rs. ${(payModal.remaining||0).toFixed(0)}`}
                style={{ width:"100%", fontSize:20, fontWeight:700, padding:"10px 12px", border:"2px solid #dce6e2", borderRadius:10, outline:"none", boxSizing:"border-box" }}/>
            </label>
            <button onClick={handlePayment} disabled={busy}
              style={{ width:"100%", background:"#0e6e5c", color:"white", fontSize:14, fontWeight:600, padding:"12px", borderRadius:10, border:"none", cursor:"pointer" }}>
              {busy ? "Saving..." : `Rs. ${payAmount||0} receive karein`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
            }
         
