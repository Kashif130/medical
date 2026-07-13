"use client";

import { useEffect, useMemo, useState } from "react";
import { watchInventory, watchPurchases } from "@/lib/firebase";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function PriceHistoryPage() {
  const [medicines, setMedicines] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [isMobile,  setIsMobile]  = useState(false);

  useEffect(() => watchInventory(setMedicines),  []);
  useEffect(() => watchPurchases(setPurchases),  []);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Build price history per medicine from purchases
  const priceHistory = useMemo(() => {
    const map = {}; // medId -> [{date, costPrice, salePrice, supplierName}]
    purchases.forEach(p => {
      const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
      (p.items||[]).forEach(item => {
        if (!map[item.id]) map[item.id] = [];
        map[item.id].push({
          date,
          dateStr: date.toLocaleDateString("en-PK"),
          costPrice:  item.costPrice  || 0,
          salePrice:  item.salePrice  || 0,
          supplierName: p.supplierName || "—",
          invoiceNo:    p.invoiceNo   || "—",
        });
      });
    });
    // Sort each medicine's history by date asc
    Object.keys(map).forEach(id => map[id].sort((a,b)=>a.date-b.date));
    return map;
  }, [purchases]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return medicines;
    return medicines.filter(m =>
      m.name?.toLowerCase().includes(t) ||
      m.genericName?.toLowerCase().includes(t) ||
      m.category?.toLowerCase().includes(t)
    );
  }, [medicines, search]);

  function priceTrend(history) {
    if (history.length < 2) return "stable";
    const last = history[history.length-1].costPrice;
    const prev = history[history.length-2].costPrice;
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "stable";
  }

  function priceChange(history) {
    if (history.length < 2) return null;
    const last = history[history.length-1].costPrice;
    const first= history[0].costPrice;
    if (first===0) return null;
    return ((last-first)/first*100).toFixed(1);
  }

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:1100 }}>
      <h1 style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>Medicine Price History</h1>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>Har purchase pe cost aur sale price track hota hai</p>

      <div style={{ position:"relative", marginBottom:16 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Medicine naam ya category..."
          style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
      </div>

      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Medicine","Current Cost","Current Sale","Margin","Purchases","Price Trend",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m=>{
              const history = priceHistory[m.id] || [];
              const trend   = priceTrend(history);
              const change  = priceChange(history);
              const margin  = m.price && m.costPrice ? ((m.price - m.costPrice)/m.price*100).toFixed(1) : null;
              return (
                <>
                  <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2", cursor:"pointer", background: selected===m.id?"#f8faf9":"white" }}
                    onClick={()=>setSelected(selected===m.id?null:m.id)}>
                    <td style={{ padding:"10px 12px" }}>
                      <p style={{ fontWeight:600 }}>{m.name}</p>
                      {m.genericName && <p style={{ fontSize:11, color:"#9ca3af" }}>{m.genericName}</p>}
                      <p style={{ fontSize:11, color:"#9ca3af" }}>{[m.category,m.packSize].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>Rs. {m.costPrice||0}</td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontWeight:600, color:"#0e6e5c" }}>Rs. {m.price||0}</td>
                    <td style={{ padding:"10px 12px" }}>
                      {margin!==null ? (
                        <span style={{ fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:99,
                          background: Number(margin)>=20?"#dcfce7": Number(margin)>=10?"#fef9c3":"#fee2e2",
                          color:      Number(margin)>=20?"#16a34a": Number(margin)>=10?"#d97706":"#dc2626" }}>
                          {margin}%
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding:"10px 12px", color:"#6b7280" }}>{history.length} purchases</td>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        {trend==="up"     && <TrendingUp   size={14} color="#dc2626"/>}
                        {trend==="down"   && <TrendingDown size={14} color="#16a34a"/>}
                        {trend==="stable" && <Minus        size={14} color="#9ca3af"/>}
                        {change!==null && (
                          <span style={{ fontSize:11, fontWeight:600, color: Number(change)>0?"#dc2626": Number(change)<0?"#16a34a":"#9ca3af" }}>
                            {Number(change)>0?"+":""}{change}% overall
                          </span>
                        )}
                        {history.length===0 && <span style={{ fontSize:11, color:"#9ca3af" }}>No purchases yet</span>}
                      </div>
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#0e6e5c", fontWeight:600 }}>
                      {history.length>0 ? "Details ↓" : ""}
                    </td>
                  </tr>

                  {/* Expanded price history */}
                  {selected===m.id && history.length>0 && (
                    <tr key={`${m.id}-hist`}>
                      <td colSpan={7} style={{ padding:"0 12px 16px", background:"#f8faf9" }}>
                        <div style={{ paddingTop:12 }}>
                          <p style={{ fontSize:12, fontWeight:700, color:"#6b7280", marginBottom:8 }}>Purchase price history:</p>

                          {/* Mini bar chart */}
                          {history.length>1 && (
                            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:60, marginBottom:14 }}>
                              {history.map((h,i)=>{
                                const max = Math.max(...history.map(x=>x.costPrice),1);
                                const ht  = Math.max(4,(h.costPrice/max)*60);
                                const prev= i>0?history[i-1].costPrice:h.costPrice;
                                const up  = h.costPrice > prev;
                                const dn  = h.costPrice < prev;
                                return (
                                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                                    <span style={{ fontSize:8, color:"#9ca3af" }}>Rs.{h.costPrice}</span>
                                    <div style={{ width:"100%", height:ht, borderRadius:"3px 3px 0 0", background: up?"#fca5a5": dn?"#86efac":"#93c5fd" }}/>
                                    <span style={{ fontSize:8, color:"#9ca3af" }}>{h.date.toLocaleDateString("en-PK",{month:"short",day:"numeric"})}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                            <thead>
                              <tr style={{ color:"#9ca3af", fontFamily:"monospace", fontSize:10, textTransform:"uppercase" }}>
                                <th style={{ textAlign:"left", paddingBottom:4 }}>Date</th>
                                <th style={{ textAlign:"left", paddingBottom:4 }}>Supplier</th>
                                <th style={{ textAlign:"left", paddingBottom:4 }}>Invoice</th>
                                <th style={{ textAlign:"right", paddingBottom:4 }}>Cost Price</th>
                                <th style={{ textAlign:"right", paddingBottom:4 }}>Sale Price</th>
                                <th style={{ textAlign:"right", paddingBottom:4 }}>Change</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...history].reverse().map((h,i,arr)=>{
                                const prev   = arr[i+1]?.costPrice;
                                const diff   = prev!=null ? h.costPrice - prev : null;
                                const pct    = prev && prev>0 ? ((diff/prev)*100).toFixed(1) : null;
                                return (
                                  <tr key={i} style={{ borderTop:"1px solid #e5ede9" }}>
                                    <td style={{ padding:"5px 0", fontFamily:"monospace" }}>{h.dateStr}</td>
                                    <td style={{ padding:"5px 8px" }}>{h.supplierName}</td>
                                    <td style={{ padding:"5px 8px", color:"#9ca3af" }}>{h.invoiceNo}</td>
                                    <td style={{ padding:"5px 0", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>Rs. {h.costPrice}</td>
                                    <td style={{ padding:"5px 0", textAlign:"right", fontFamily:"monospace", color:"#0e6e5c" }}>Rs. {h.salePrice}</td>
                                    <td style={{ padding:"5px 0", textAlign:"right", fontFamily:"monospace",
                                      color: diff===null?"#9ca3af": diff>0?"#dc2626": diff<0?"#16a34a":"#9ca3af" }}>
                                      {diff===null ? "First entry" : diff===0 ? "—" : `${diff>0?"+":""}${diff} (${pct}%)`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length===0 && (
              <tr><td colSpan={7} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi medicine nahi mili.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
