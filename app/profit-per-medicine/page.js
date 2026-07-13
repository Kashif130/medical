"use client";

import { useEffect, useState } from "react";
import { fetchProfitPerMedicine } from "@/lib/firebase";
import { TrendingUp, RefreshCw } from "lucide-react";

export default function ProfitPerMedicinePage() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort,    setSort]    = useState("totalProfit"); // totalProfit | margin | totalQty | totalRevenue
  const [isMobile,setIsMobile]= useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const rows = await fetchProfitPerMedicine();
      setData(rows);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const sorted = [...data].sort((a,b) => {
    if (sort==="margin") return Number(b.margin)-Number(a.margin);
    return b[sort]-a[sort];
  });

  const totalRevenue = data.reduce((s,d)=>s+d.totalRevenue,0);
  const totalCost    = data.reduce((s,d)=>s+d.totalCost,0);
  const totalProfit  = data.reduce((s,d)=>s+d.totalProfit,0);
  const totalQty     = data.reduce((s,d)=>s+d.totalQty,0);
  const overallMargin= totalRevenue>0?((totalProfit/totalRevenue)*100).toFixed(1):0;

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:1100 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:800 }}>Profit per Medicine</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Har medicine ka total revenue, cost aur net profit</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, border:"1px solid #dce6e2", background:"white", cursor:"pointer", color:"#374151" }}>
          <RefreshCw size={13} style={{ animation: loading?"spin 1s linear infinite":"none" }}/> Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
        {[
          { label:"Total Revenue",  val:`Rs. ${Math.round(totalRevenue).toLocaleString()}`,  color:"#2563eb" },
          { label:"Total Cost",     val:`Rs. ${Math.round(totalCost).toLocaleString()}`,     color:"#6b7280" },
          { label:"Total Profit",   val:`Rs. ${Math.round(totalProfit).toLocaleString()}`,   color:"#0e6e5c" },
          { label:"Overall Margin", val:`${overallMargin}%`,                                  color: Number(overallMargin)>=20?"#0e6e5c":"#d97706" },
          { label:"Total Units Sold",val:totalQty.toLocaleString(),                           color:"#374151" },
          { label:"Medicines",      val:data.length,                                          color:"#374151" },
        ].map(s=>(
          <div key={s.label} style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"12px 16px" }}>
            <p style={{ fontSize:10, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:4 }}>{s.label}</p>
            <p style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Sort tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[
          { key:"totalProfit",  label:"By Profit" },
          { key:"margin",       label:"By Margin %" },
          { key:"totalRevenue", label:"By Revenue" },
          { key:"totalQty",     label:"By Qty Sold" },
        ].map(s=>(
          <button key={s.key} onClick={()=>setSort(s.key)}
            style={{ fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, cursor:"pointer",
              background:sort===s.key?"#0e6e5c":"white", color:sort===s.key?"white":"#6b7280",
              border:sort===s.key?"none":"1px solid #dce6e2" }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:"60px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Sales data load ho raha hai...</div>
      ) : (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #dce6e2" }}>
                {["#","Medicine","Qty Sold","Revenue","Cost","Profit","Margin","Stock"].map(h=>(
                  <th key={h} style={{ padding:"9px 12px", textAlign:["Revenue","Cost","Profit","Margin"].includes(h)?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500,
                    display: isMobile && ["Cost","Stock"].includes(h)?"none":"table-cell" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m,i)=>{
                const marginNum = Number(m.margin);
                const marginColor= marginNum>=30?"#16a34a": marginNum>=15?"#d97706": marginNum>=0?"#ef4444":"#dc2626";
                const marginBg   = marginNum>=30?"#dcfce7": marginNum>=15?"#fef9c3": marginNum>=0?"#fee2e2":"#fee2e2";
                return (
                  <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                    <td style={{ padding:"9px 12px", color:"#9ca3af", fontFamily:"monospace", fontSize:11 }}>{i+1}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <p style={{ fontWeight:600 }}>{m.name}</p>
                      {m.category && <p style={{ fontSize:11, color:"#9ca3af" }}>{m.category}</p>}
                    </td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace" }}>{m.totalQty}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace" }}>Rs. {Math.round(m.totalRevenue).toLocaleString()}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#6b7280", display:isMobile?"none":"table-cell" }}>Rs. {Math.round(m.totalCost).toLocaleString()}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:m.totalProfit>=0?"#0e6e5c":"#dc2626" }}>
                      Rs. {Math.round(m.totalProfit).toLocaleString()}
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right" }}>
                      <span style={{ fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:99, background:marginBg, color:marginColor }}>
                        {m.margin}%
                      </span>
                    </td>
                    <td style={{ padding:"9px 12px", display:isMobile?"none":"table-cell", color: Number(m.currentStock)<=0?"#dc2626": Number(m.currentStock)<=10?"#d97706":"#374151", fontFamily:"monospace" }}>
                      {m.currentStock}
                    </td>
                  </tr>
                );
              })}
              {sorted.length===0 && (
                <tr><td colSpan={8} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi sale nahi hui abhi tak.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
