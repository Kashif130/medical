"use client";

import { useEffect, useMemo, useState } from "react";
import { watchSales, watchReturns } from "@/lib/firebase";
import { Printer, ChevronDown, ChevronUp, X, RotateCcw, Search } from "lucide-react";

const STORE_NAME  = "Umer Din Medical Store";
const STORE_ADDR  = "Apna address yahan likho";
const STORE_PHONE = "03XX-XXXXXXX";

const PERIODS = [
  { key:"today",   label:"Aaj" },
  { key:"week",    label:"7 Din" },
  { key:"month",   label:"Is Mahina" },
  { key:"3months", label:"3 Mahine" },
  { key:"all",     label:"Sab" },
];

function startOf(period) {
  const now = new Date();
  if (period==="today")   return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (period==="week")    { const d=new Date(now); d.setDate(d.getDate()-6); d.setHours(0,0,0,0); return d; }
  if (period==="month")   return new Date(now.getFullYear(),now.getMonth(),1);
  if (period==="3months") { const d=new Date(now); d.setMonth(d.getMonth()-3); d.setDate(1); d.setHours(0,0,0,0); return d; }
  return null;
}

// ── Receipt modal ─────────────────────────────────────────
function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;
  const date        = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
  const subtotal    = sale.subtotal    ?? sale.total ?? 0;
  const flatDiscount= sale.flatDiscount ?? 0;
  const miscCharges = sale.miscCharges  ?? 0;
  const gstAmount   = sale.gstAmount   ?? 0;
  const total       = sale.total       ?? 0;
  const returned    = sale.returnedAmount ?? 0;

  return (
    <>
      <div onClick={onClose} className="receipt-overlay"
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:50,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div onClick={e=>e.stopPropagation()}>
          <div className="no-print" style={{ display:"flex", justifyContent:"flex-end", gap:8, marginBottom:10 }}>
            <button onClick={()=>window.print()}
              style={{ display:"flex", alignItems:"center", gap:6, background:"#0e6e5c", color:"white", fontSize:13, fontWeight:600, padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer" }}>
              <Printer size={14}/> Print
            </button>
            <button onClick={onClose} style={{ background:"white", border:"none", cursor:"pointer", color:"#6b7280", padding:"8px 10px", borderRadius:8 }}>
              <X size={16}/>
            </button>
          </div>
          <div id="receipt-paper" style={{ width:320, background:"white", fontFamily:"'Courier New',monospace", fontSize:12, color:"#111", padding:"20px 18px", borderRadius:8, boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ textAlign:"center", marginBottom:10 }}>
              <p style={{ fontWeight:700, fontSize:15 }}>{STORE_NAME}</p>
              <p style={{ fontSize:11, color:"#555" }}>{STORE_ADDR}</p>
              <p style={{ fontSize:11, color:"#555" }}>{STORE_PHONE}</p>
            </div>
            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:2 }}>
              <span>{date.toLocaleDateString("en-PK")} {date.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})}</span>
              <span>Bill #{sale.id?.slice(-6).toUpperCase()}</span>
            </div>
            <div style={{ fontSize:11, marginBottom:4 }}>Customer: {sale.customerName||"Walk-in"} · {sale.paymentMethod||"Cash"}</div>
            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead><tr>
                <th style={{ textAlign:"left", paddingBottom:4, fontSize:10 }}>Item</th>
                <th style={{ textAlign:"center", paddingBottom:4, fontSize:10 }}>Qty</th>
                <th style={{ textAlign:"right", paddingBottom:4, fontSize:10 }}>Rate</th>
                <th style={{ textAlign:"right", paddingBottom:4, fontSize:10 }}>Amt</th>
              </tr></thead>
              <tbody>
                {(sale.items||[]).map((item,i)=>(
                  <tr key={i}>
                    <td style={{ paddingBottom:2, wordBreak:"break-word" }}>{item.name}</td>
                    <td style={{ textAlign:"center" }}>{item.qty}</td>
                    <td style={{ textAlign:"right" }}>{item.price}</td>
                    <td style={{ textAlign:"right", fontWeight:600 }}>{(item.price*item.qty).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>
            <div style={{ display:"flex", flexDirection:"column", gap:2, fontSize:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>Subtotal</span><span>Rs. {subtotal.toFixed(0)}</span></div>
              {flatDiscount>0 && <div style={{ display:"flex", justifyContent:"space-between", color:"#dc2626" }}><span>Discount</span><span>− Rs. {flatDiscount.toFixed(0)}</span></div>}
              {gstAmount>0    && <div style={{ display:"flex", justifyContent:"space-between" }}><span>GST 17%</span><span>Rs. {gstAmount.toFixed(0)}</span></div>}
              {miscCharges>0  && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Misc</span><span>Rs. {miscCharges.toFixed(0)}</span></div>}
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:14, borderTop:"1px solid #ccc", paddingTop:4, marginTop:4 }}>
                <span>TOTAL</span><span>Rs. {total.toFixed(0)}</span>
              </div>
              {returned>0 && <>
                <div style={{ display:"flex", justifyContent:"space-between", color:"#dc2626" }}><span>Returned</span><span>− Rs. {returned.toFixed(0)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700 }}><span>NET</span><span>Rs. {(total-returned).toFixed(0)}</span></div>
              </>}
            </div>
            <div style={{ borderTop:"1px dashed #999", margin:"8px 0" }}/>
            <p style={{ textAlign:"center", fontSize:11, color:"#555" }}>Shukriya! Sehat mand rahein. 🏥</p>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility:hidden !important; }
          #receipt-paper, #receipt-paper * { visibility:visible !important; }
          .receipt-overlay { background:transparent !important; }
          #receipt-paper { position:fixed !important; top:0 !important; left:0 !important; box-shadow:none !important; border-radius:0 !important; width:80mm !important; }
          .no-print { display:none !important; }
        }
      `}</style>
    </>
  );
}

export default function SalesPage() {
  const [sales,       setSales]       = useState([]);
  const [returns,     setReturns]     = useState([]);
  const [expandedId,  setExpandedId]  = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [isMobile,    setIsMobile]    = useState(false);
  const [search,      setSearch]      = useState("");
  const [period,      setPeriod]      = useState("today");

  useEffect(() => watchSales(setSales),     []);
  useEffect(() => watchReturns(setReturns), []);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth<768); }
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  }, []);

  const returnsBySale = useMemo(() => {
    const map = {};
    returns.forEach(r => {
      if (!r.saleId) return;
      if (!map[r.saleId]) map[r.saleId]=[];
      map[r.saleId].push(r);
    });
    return map;
  }, [returns]);

  // Period filtered sales
  const periodSales = useMemo(() => {
    const start = startOf(period);
    return start
      ? sales.filter(s => s.createdAt?.toDate?.()?.getTime() >= start.getTime())
      : sales;
  }, [sales, period]);

  // Search filter on top of period
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return periodSales;
    return periodSales.filter(s =>
      s.customerName?.toLowerCase().includes(t) ||
      s.id?.toLowerCase().includes(t) ||
      s.items?.some(i=>i.name?.toLowerCase().includes(t))
    );
  }, [periodSales, search]);

  // KPI summary for selected period
  const summary = useMemo(() => {
    const gross    = periodSales.reduce((s,x)=>s+(x.total||0),0);
    const returned = periodSales.reduce((s,x)=>s+(x.returnedAmount||0),0);
    const net      = gross - returned;
    const profit   = periodSales.reduce((s,x)=>{
      const cost=(x.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
      return s+(x.total||0)-cost;
    },0);
    const bills    = periodSales.length;
    const avgBill  = bills>0 ? net/bills : 0;
    return { gross, returned, net, profit, bills, avgBill };
  }, [periodSales]);

  // Chart data
  const chartData = useMemo(() => {
    if (period==="today") {
      const hours={};
      const today=new Date().toDateString();
      periodSales.forEach(s=>{
        const h=s.createdAt?.toDate?.()?.getHours()??0;
        const label=`${h}:00`;
        if (!hours[label]) hours[label]={label,net:0,profit:0,bills:0};
        const cost=(s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
        hours[label].net    +=(s.total||0)-(s.returnedAmount||0);
        hours[label].profit +=(s.total||0)-cost;
        hours[label].bills  +=1;
      });
      return Object.values(hours).sort((a,b)=>a.label.localeCompare(b.label));
    }
    if (period==="week") {
      const days={};
      for(let i=6;i>=0;i--){
        const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);
        const key=d.toLocaleDateString("en-PK",{weekday:"short",day:"numeric"});
        days[key]={label:key,net:0,profit:0,bills:0};
      }
      periodSales.forEach(s=>{
        const d=s.createdAt?.toDate?.(); if(!d) return;
        const key=d.toLocaleDateString("en-PK",{weekday:"short",day:"numeric"});
        if(!days[key]) return;
        const cost=(s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
        days[key].net    +=(s.total||0)-(s.returnedAmount||0);
        days[key].profit +=(s.total||0)-cost;
        days[key].bills  +=1;
      });
      return Object.values(days);
    }
    // month / 3months → weekly
    const start=startOf(period);
    const weeks={};
    periodSales.forEach(s=>{
      const d=s.createdAt?.toDate?.(); if(!d) return;
      const wn=Math.floor((d-start)/(7*24*60*60*1000));
      const key=`W${wn+1}`;
      if(!weeks[key]) weeks[key]={label:key,net:0,profit:0,bills:0};
      const cost=(s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
      weeks[key].net    +=(s.total||0)-(s.returnedAmount||0);
      weeks[key].profit +=(s.total||0)-cost;
      weeks[key].bills  +=1;
    });
    return Object.values(weeks).sort((a,b)=>a.label.localeCompare(b.label));
  }, [periodSales, period]);

  const maxChart = Math.max(...chartData.map(c=>c.net),1);

  return (
    <div style={{ padding:isMobile?12:28, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Sales History</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Daily, weekly, monthly sale aur profit</p>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {PERIODS.map(p=>(
          <button key={p.key} onClick={()=>setPeriod(p.key)}
            style={{ fontSize:13, fontWeight:600, padding:"8px 16px", borderRadius:8, cursor:"pointer",
              background:period===p.key?"#0e6e5c":"white",
              color:period===p.key?"white":"#6b7280",
              border:period===p.key?"none":"1px solid #dce6e2" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Gross Sale",    val:`Rs. ${Math.round(summary.gross).toLocaleString()}`,   color:"#2563eb" },
          { label:"Returns",       val:`− Rs. ${Math.round(summary.returned).toLocaleString()}`, color:"#dc2626" },
          { label:"Net Sale",      val:`Rs. ${Math.round(summary.net).toLocaleString()}`,     color:"#0e6e5c", bold:true },
          { label:"Net Profit",    val:`Rs. ${Math.round(summary.profit).toLocaleString()}`,  color:summary.profit>=0?"#0e6e5c":"#dc2626", bold:true },
          { label:"Bills",         val:summary.bills,                                          color:"#374151" },
          { label:"Avg Bill",      val:`Rs. ${Math.round(summary.avgBill)}`,                  color:"#374151" },
        ].map(s=>(
          <div key={s.label} style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"12px 16px" }}>
            <p style={{ fontSize:10, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:4 }}>{s.label}</p>
            <p style={{ fontSize:18, fontWeight:s.bold?800:700, color:s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length>0 && (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:14, padding:20, marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
            <p style={{ fontSize:14, fontWeight:700 }}>
              {period==="today"?"Aaj ka hourly breakdown": period==="week"?"Roz ki sale (last 7 days)": period==="month"?"Is mahine ka weekly": "3 mahine — weekly"}
            </p>
            <div style={{ display:"flex", gap:12, fontSize:11 }}>
              <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:2, background:"#0e6e5c", marginRight:4 }}/>Net Sale</span>
              <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:2, background:"#6ee7b7", marginRight:4 }}/>Profit</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:isMobile?4:10, height:120, overflowX:"auto" }}>
            {chartData.map((d,i)=>{
              const rh=Math.max(4,(d.net/maxChart)*120);
              const ph=Math.max(0,(d.profit/maxChart)*120);
              return (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:isMobile?32:44, flex:"0 0 auto" }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:120 }}>
                    <div title={`Net: Rs.${Math.round(d.net)}`}
                      style={{ width:isMobile?12:16, height:rh, background:"#0e6e5c", borderRadius:"3px 3px 0 0" }}/>
                    <div title={`Profit: Rs.${Math.round(d.profit)}`}
                      style={{ width:isMobile?12:16, height:Math.max(0,ph), background:"#6ee7b7", borderRadius:"3px 3px 0 0" }}/>
                  </div>
                  <span style={{ fontSize:9, color:"#9ca3af", textAlign:"center" }}>{d.label}</span>
                  <span style={{ fontSize:9, color:"#6b7280", fontFamily:"monospace" }}>{d.bills}b</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position:"relative", marginBottom:14 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer naam, bill ID ya medicine search..."
          style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
      </div>

      {/* Table */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Customer","Items","Payment","Total","Return","Net",""].map(h=>(
                <th key={h} style={{ padding:"9px 10px",
                  textAlign:["Total","Return","Net"].includes(h)?"right":"left",
                  fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500,
                  display:isMobile&&["Payment","Return"].includes(h)?"none":"table-cell" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s=>{
              const date     = s.createdAt?.toDate?s.createdAt.toDate():null;
              const returned = s.returnedAmount||0;
              const net      = (s.total||0)-returned;
              const isExp    = expandedId===s.id;
              const saleReturns = returnsBySale[s.id]||[];
              return (
                <>
                  <tr key={s.id} style={{ borderBottom:"1px solid #f0f4f2", cursor:"pointer", background:returned>0?"#fffbf5":"white" }}
                    onClick={()=>setExpandedId(isExp?null:s.id)}>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>
                      {date?<><div>{date.toLocaleDateString("en-PK")}</div><div style={{ color:"#bbb" }}>{date.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})}</div></>:"—"}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      <p style={{ fontWeight:500 }}>{s.customerName||"Walk-in"}</p>
                      {s.hasReturn && <span style={{ fontSize:10, fontWeight:700, background:"#fef3c7", color:"#d97706", padding:"1px 7px", borderRadius:99, display:"inline-flex", alignItems:"center", gap:3 }}><RotateCcw size={9}/> Returned</span>}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ background:"#f0f4f2", borderRadius:6, padding:"2px 8px", fontFamily:"monospace", fontSize:11 }}>{s.items?.length||0} items</span>
                    </td>
                    <td style={{ padding:"9px 10px", display:isMobile?"none":"table-cell" }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:99,
                        background:s.paymentMethod==="Cash"?"#dcfce7":"#dbeafe",
                        color:s.paymentMethod==="Cash"?"#16a34a":"#2563eb" }}>
                        {s.paymentMethod||"Cash"}
                      </span>
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>Rs. {(s.total||0).toFixed(0)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"monospace", color:returned>0?"#dc2626":"#9ca3af", display:isMobile?"none":"table-cell" }}>
                      {returned>0?`− Rs. ${returned.toFixed(0)}`:"—"}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:returned>0?"#d97706":"#0e6e5c" }}>
                      Rs. {net.toFixed(0)}
                    </td>
                    <td style={{ padding:"9px 8px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <button onClick={e=>{e.stopPropagation();setReceiptSale(s);}}
                          style={{ display:"flex", alignItems:"center", gap:4, background:"#f0faf5", border:"1px solid #a7f3d0", color:"#0e6e5c", fontSize:11, fontWeight:600, padding:"4px 8px", borderRadius:6, cursor:"pointer", whiteSpace:"nowrap" }}>
                          <Printer size={12}/> {!isMobile&&"Receipt"}
                        </button>
                        {isExp?<ChevronUp size={14} color="#9ca3af"/>:<ChevronDown size={14} color="#9ca3af"/>}
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={8} style={{ padding:"0 12px 16px", background:"#f8faf9" }}>
                        <div style={{ paddingTop:12 }}>
                          <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse", marginBottom:10 }}>
                            <thead><tr style={{ color:"#9ca3af", fontFamily:"monospace", fontSize:10, textTransform:"uppercase" }}>
                              <th style={{ textAlign:"left", paddingBottom:4 }}>Medicine</th>
                              <th style={{ textAlign:"center", paddingBottom:4 }}>Qty</th>
                              <th style={{ textAlign:"right", paddingBottom:4 }}>Rate</th>
                              <th style={{ textAlign:"right", paddingBottom:4 }}>Amount</th>
                            </tr></thead>
                            <tbody>
                              {(s.items||[]).map((item,i)=>(
                                <tr key={i} style={{ borderTop:"1px solid #e5ede9" }}>
                                  <td style={{ padding:"4px 0" }}>{item.name}</td>
                                  <td style={{ textAlign:"center", padding:"4px 0", color:"#6b7280" }}>{item.qty} units</td>
                                  <td style={{ textAlign:"right", padding:"4px 0", fontFamily:"monospace" }}>Rs. {item.price}</td>
                                  <td style={{ textAlign:"right", padding:"4px 0", fontFamily:"monospace", fontWeight:600 }}>Rs. {(item.price*item.qty).toFixed(0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12, borderTop:"1px dashed #dce6e2", paddingTop:8 }}>
                            <span style={{ color:"#6b7280" }}>Subtotal: <strong>Rs. {(s.subtotal||s.total||0).toFixed(0)}</strong></span>
                            {(s.flatDiscount||s.discount||0)>0 && <span style={{ color:"#dc2626" }}>Disc: − Rs. {(s.flatDiscount||s.discount||0).toFixed(0)}</span>}
                            {(s.gstAmount||0)>0 && <span>GST: Rs. {s.gstAmount.toFixed(0)}</span>}
                            {(s.miscCharges||0)>0 && <span>Misc: Rs. {s.miscCharges.toFixed(0)}</span>}
                            <span style={{ fontWeight:700 }}>Total: Rs. {(s.total||0).toFixed(0)}</span>
                            {returned>0 && <span style={{ color:"#dc2626", fontWeight:700 }}>Return: − Rs. {returned.toFixed(0)}</span>}
                            {returned>0 && <span style={{ color:"#d97706", fontWeight:700 }}>Net: Rs. {net.toFixed(0)}</span>}
                          </div>
                          {saleReturns.length>0 && (
                            <div style={{ marginTop:10, background:"#fff8f0", border:"1px solid #fed7aa", borderRadius:8, padding:"10px 12px" }}>
                              <p style={{ fontSize:11, fontWeight:700, color:"#d97706", marginBottom:6 }}>Return records:</p>
                              {saleReturns.map((r,i)=>(
                                <div key={i} style={{ fontSize:12, display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #fed7aa" }}>
                                  <span style={{ color:"#6b7280" }}>{r.createdAt?.toDate?.()?.toLocaleDateString("en-PK")} — {r.items?.map(i=>`${i.name} x${i.qty}`).join(", ")} ({r.reason||"—"})</span>
                                  <span style={{ color:"#dc2626", fontFamily:"monospace", fontWeight:600 }}>− Rs. {(r.refundAmount||0).toFixed(0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length===0 && (
              <tr><td colSpan={8} style={{ padding:"48px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                {period==="today"?"Aaj koi sale nahi hui abhi tak.":"Is period mein koi sale nahi mili."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {receiptSale && <ReceiptModal sale={receiptSale} onClose={()=>setReceiptSale(null)}/>}
    </div>
  );
}
