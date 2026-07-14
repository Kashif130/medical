"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchProfitPerMedicine, watchSales, watchReturns } from "@/lib/firebase";
import { TrendingUp, RefreshCw, Calendar } from "lucide-react";

// ── Date range helpers ────────────────────────────────────
function startOf(period) {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "3months") {
    const d = new Date(now); d.setMonth(d.getMonth()-3); d.setDate(1); d.setHours(0,0,0,0); return d;
  }
  return null; // all time
}

const PERIODS = [
  { key:"today",   label:"Aaj" },
  { key:"week",    label:"7 Din" },
  { key:"month",   label:"Is Mahina" },
  { key:"3months", label:"3 Mahine" },
  { key:"all",     label:"Sab" },
];

export default function ProfitPerMedicinePage() {
  const [allData,   setAllData]   = useState([]);
  const [sales,     setSales]     = useState([]);
  const [returns,   setReturns]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sort,      setSort]      = useState("totalProfit");
  const [period,    setPeriod]    = useState("month");
  const [isMobile,  setIsMobile]  = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Watch sales realtime for period filtering
  useEffect(() => {
    const { watchSales: ws, watchReturns: wr } = require("@/lib/firebase");
    const u1 = ws(setSales);
    const u2 = wr(setReturns);
    return () => { u1(); u2(); };
  }, []);

  async function load() {
    setLoading(true);
    try { setAllData(await fetchProfitPerMedicine()); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Period-filtered profit calculation from sales
  const periodData = useMemo(() => {
    const start = startOf(period);
    const filteredSales = start
      ? sales.filter(s => s.createdAt?.toDate?.()?.getTime() >= start.getTime())
      : sales;

    // Returns in period
    const filteredReturns = start
      ? returns.filter(r => r.createdAt?.toDate?.()?.getTime() >= start.getTime())
      : returns;

    const returnBySale = {};
    filteredReturns.forEach(r => {
      if (r.saleId) returnBySale[r.saleId] = (returnBySale[r.saleId]||0) + (r.refundAmount||0);
    });

    const map = {};
    filteredSales.forEach(s => {
      (s.items||[]).forEach(item => {
        if (!map[item.id]) map[item.id] = {
          id: item.id, name: item.name,
          totalQty: 0, totalRevenue: 0, totalCost: 0,
        };
        map[item.id].totalQty     += item.qty;
        map[item.id].totalRevenue += item.price * item.qty;
        map[item.id].totalCost    += (item.costPrice||0) * item.qty;
      });
    });

    // Deduct returns
    filteredReturns.forEach(r => {
      (r.items||[]).forEach(item => {
        if (map[item.id]) {
          map[item.id].totalRevenue -= (item.price||0) * (item.qty||0);
          map[item.id].totalCost    -= (item.costPrice||0) * (item.qty||0);
          map[item.id].totalQty     -= (item.qty||0);
        }
      });
    });

    return Object.values(map)
      .filter(m => m.totalQty > 0)
      .map(m => ({
        ...m,
        totalProfit: m.totalRevenue - m.totalCost,
        margin: m.totalRevenue > 0
          ? ((m.totalRevenue - m.totalCost) / m.totalRevenue * 100).toFixed(1)
          : "0",
        currentStock: allData.find(d => d.id === m.id)?.currentStock ?? "—",
        category:     allData.find(d => d.id === m.id)?.category    || "",
      }))
      .sort((a,b) => {
        if (sort === "margin")       return Number(b.margin) - Number(a.margin);
        if (sort === "totalQty")     return b.totalQty - a.totalQty;
        if (sort === "totalRevenue") return b.totalRevenue - a.totalRevenue;
        return b.totalProfit - a.totalProfit;
      });
  }, [sales, returns, period, sort, allData]);

  // Summary
  const totalRevenue = periodData.reduce((s,d) => s + d.totalRevenue, 0);
  const totalCost    = periodData.reduce((s,d) => s + d.totalCost,    0);
  const totalProfit  = periodData.reduce((s,d) => s + d.totalProfit,  0);
  const totalQty     = periodData.reduce((s,d) => s + d.totalQty,     0);
  const overallMargin= totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0;

  // Daily/weekly/monthly summary chart
  const chartData = useMemo(() => {
    if (period === "today") {
      // Hourly breakdown
      const hours = {};
      const today = new Date().toDateString();
      sales.filter(s => s.createdAt?.toDate?.()?.toDateString() === today).forEach(s => {
        const h = s.createdAt.toDate().getHours();
        const label = `${h}:00`;
        if (!hours[label]) hours[label] = { label, revenue:0, profit:0, bills:0 };
        const cost = (s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
        hours[label].revenue += s.total||0;
        hours[label].profit  += (s.total||0) - cost;
        hours[label].bills   += 1;
      });
      return Object.values(hours).sort((a,b)=>a.label.localeCompare(b.label));
    }
    if (period === "week") {
      // Daily last 7 days
      const days = {};
      for (let i=6;i>=0;i--) {
        const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
        const key = d.toLocaleDateString("en-PK",{weekday:"short", month:"short", day:"numeric"});
        days[key] = { label:key, revenue:0, profit:0, bills:0 };
      }
      sales.forEach(s => {
        const d = s.createdAt?.toDate?.();
        if (!d) return;
        const diff = (new Date() - d) / (1000*60*60*24);
        if (diff > 7) return;
        const key = d.toLocaleDateString("en-PK",{weekday:"short", month:"short", day:"numeric"});
        if (!days[key]) return;
        const cost = (s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
        days[key].revenue += s.total||0;
        days[key].profit  += (s.total||0) - cost;
        days[key].bills   += 1;
      });
      return Object.values(days);
    }
    if (period === "month" || period === "3months") {
      // Weekly buckets
      const weeks = {};
      const start = startOf(period);
      sales.filter(s => s.createdAt?.toDate?.()?.getTime() >= start.getTime()).forEach(s => {
        const d = s.createdAt.toDate();
        const weekNum = Math.floor((d - start) / (7*24*60*60*1000));
        const key = `Week ${weekNum+1}`;
        if (!weeks[key]) weeks[key] = { label:key, revenue:0, profit:0, bills:0 };
        const cost = (s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
        weeks[key].revenue += s.total||0;
        weeks[key].profit  += (s.total||0) - cost;
        weeks[key].bills   += 1;
      });
      return Object.values(weeks).sort((a,b)=>a.label.localeCompare(b.label));
    }
    // All time — monthly
    const months = {};
    sales.forEach(s => {
      const d = s.createdAt?.toDate?.();
      if (!d) return;
      const key = d.toLocaleDateString("en-PK",{year:"numeric",month:"short"});
      if (!months[key]) months[key] = { label:key, revenue:0, profit:0, bills:0 };
      const cost = (s.items||[]).reduce((c,i)=>c+(i.costPrice||0)*i.qty,0);
      months[key].revenue += s.total||0;
      months[key].profit  += (s.total||0) - cost;
      months[key].bills   += 1;
    });
    return Object.values(months).sort((a,b)=>a.label.localeCompare(b.label));
  }, [sales, period]);

  const maxChart = Math.max(...chartData.map(c=>c.revenue), 1);

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:800 }}>Profit Analysis</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Revenue, cost aur net profit — daily, weekly, monthly</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, border:"1px solid #dce6e2", background:"white", cursor:"pointer", color:"#374151" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/> Refresh
        </button>
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

      {/* Summary KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:12, marginBottom:24 }}>
        {[
          { label:"Net Revenue",    val:`Rs. ${Math.round(totalRevenue).toLocaleString()}`,  color:"#2563eb" },
          { label:"Total Cost",     val:`Rs. ${Math.round(totalCost).toLocaleString()}`,     color:"#6b7280" },
          { label:"Net Profit",     val:`Rs. ${Math.round(totalProfit).toLocaleString()}`,   color: totalProfit>=0?"#0e6e5c":"#dc2626", bold:true },
          { label:"Margin",         val:`${overallMargin}%`,                                  color: Number(overallMargin)>=20?"#0e6e5c":"#d97706" },
          { label:"Units Sold",     val:totalQty.toLocaleString(),                           color:"#374151" },
          { label:"Medicines",      val:periodData.length,                                   color:"#374151" },
        ].map(s=>(
          <div key={s.label} style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"12px 16px" }}>
            <p style={{ fontSize:10, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:4 }}>{s.label}</p>
            <p style={{ fontSize:20, fontWeight:s.bold?800:700, color:s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:14, padding:20, marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <p style={{ fontSize:14, fontWeight:700 }}>
              {period==="today"?"Hourly breakdown": period==="week"?"Daily (last 7 days)": period==="month"?"Weekly (this month)": period==="3months"?"Weekly (last 3 months)":"Monthly overview"}
            </p>
            <div style={{ display:"flex", gap:16, fontSize:11 }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"#0e6e5c", display:"inline-block" }}/> Revenue</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"#6ee7b7", display:"inline-block" }}/> Profit</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:isMobile?4:8, height:140, overflowX:"auto" }}>
            {chartData.map((d,i)=>{
              const rh = Math.max(4, (d.revenue/maxChart)*140);
              const ph = Math.max(0, (d.profit/maxChart)*140);
              return (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth: isMobile?36:48, flex:"0 0 auto" }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:140 }}>
                    <div title={`Revenue: Rs.${Math.round(d.revenue)}`}
                      style={{ width:isMobile?12:16, height:rh, background:"#0e6e5c", borderRadius:"3px 3px 0 0" }}/>
                    <div title={`Profit: Rs.${Math.round(d.profit)}`}
                      style={{ width:isMobile?12:16, height:Math.max(0,ph), background:"#6ee7b7", borderRadius:"3px 3px 0 0" }}/>
                  </div>
                  <span style={{ fontSize:9, color:"#9ca3af", textAlign:"center", lineHeight:1.2, maxWidth:48 }}>{d.label}</span>
                  <span style={{ fontSize:9, color:"#6b7280", fontFamily:"monospace" }}>{d.bills}b</span>
                </div>
              );
            })}
          </div>
          {/* Tooltip hint */}
          <p style={{ fontSize:11, color:"#9ca3af", marginTop:8 }}>
            {chartData.reduce((s,d)=>s+d.bills,0)} total bills · Rs. {Math.round(chartData.reduce((s,d)=>s+d.revenue,0)).toLocaleString()} gross · Profit Rs. {Math.round(chartData.reduce((s,d)=>s+d.profit,0)).toLocaleString()}
          </p>
        </div>
      )}

      {/* Sort tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[
          { key:"totalProfit",  label:"By Profit" },
          { key:"margin",       label:"By Margin %" },
          { key:"totalRevenue", label:"By Revenue" },
          { key:"totalQty",     label:"By Units Sold" },
        ].map(s=>(
          <button key={s.key} onClick={()=>setSort(s.key)}
            style={{ fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, cursor:"pointer",
              background:sort===s.key?"#0e6e5c":"white", color:sort===s.key?"white":"#6b7280",
              border:sort===s.key?"none":"1px solid #dce6e2" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding:"60px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Data load ho raha hai...</div>
      ) : (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #dce6e2" }}>
                {["#","Medicine","Units Sold","Revenue","Cost","Profit","Margin","Stock"].map(h=>(
                  <th key={h} style={{ padding:"9px 12px",
                    textAlign:["Revenue","Cost","Profit","Margin"].includes(h)?"right":"left",
                    fontSize:11, fontFamily:"monospace", color:"#6b7280",
                    textTransform:"uppercase", fontWeight:500,
                    display:isMobile && ["Cost","Stock"].includes(h)?"none":"table-cell" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodData.map((m,i)=>{
                const mn = Number(m.margin);
                const mc = mn>=30?"#16a34a": mn>=15?"#d97706":"#ef4444";
                const mb = mn>=30?"#dcfce7": mn>=15?"#fef9c3":"#fee2e2";
                return (
                  <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                    <td style={{ padding:"9px 12px", color:"#9ca3af", fontFamily:"monospace", fontSize:11 }}>{i+1}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <p style={{ fontWeight:600 }}>{m.name}</p>
                      {m.category && <p style={{ fontSize:11, color:"#9ca3af" }}>{m.category}</p>}
                    </td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace" }}>{m.totalQty} units</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace" }}>Rs. {Math.round(m.totalRevenue).toLocaleString()}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#6b7280", display:isMobile?"none":"table-cell" }}>Rs. {Math.round(m.totalCost).toLocaleString()}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:m.totalProfit>=0?"#0e6e5c":"#dc2626" }}>
                      Rs. {Math.round(m.totalProfit).toLocaleString()}
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right" }}>
                      <span style={{ fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:99, background:mb, color:mc }}>{m.margin}%</span>
                    </td>
                    <td style={{ padding:"9px 12px", display:isMobile?"none":"table-cell",
                      color:Number(m.currentStock)<=0?"#dc2626":Number(m.currentStock)<=10?"#d97706":"#374151",
                      fontFamily:"monospace" }}>
                      {m.currentStock}
                    </td>
                  </tr>
                );
              })}
              {periodData.length===0 && (
                <tr><td colSpan={8} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                  Is period mein koi sale nahi hui.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
