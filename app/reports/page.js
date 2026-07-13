"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { watchSales, watchReturns } from "@/lib/firebase";

function dayKey(date) { return date.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [sales,   setSales]   = useState([]);
  const [returns, setReturns] = useState([]);
  const [range,   setRange]   = useState("30");

  useEffect(() => { if (!loading && !isAdmin) router.push("/"); }, [loading, isAdmin, router]);
  useEffect(() => watchSales(setSales),     []);
  useEffect(() => watchReturns(setReturns), []);

  const computed = useMemo(() => {
    const cutoff   = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    const filtered = sales.filter(s => s.createdAt?.toDate && s.createdAt.toDate().getTime() >= cutoff);

    // Return amounts indexed by saleId for fast lookup
    const returnBySale = {};
    returns.forEach(r => {
      if (r.saleId) returnBySale[r.saleId] = (returnBySale[r.saleId]||0) + (r.refundAmount||0);
    });

    // Total returns in range (using return createdAt)
    const returnsInRange = returns.filter(r => r.createdAt?.toDate && r.createdAt.toDate().getTime() >= cutoff);
    const totalReturned  = returnsInRange.reduce((s,r) => s + (r.refundAmount||0), 0);

    let grossRevenue = 0;
    let totalCost    = 0;
    let totalDiscount= 0;
    const byDay = {};

    filtered.forEach(s => {
      const d         = s.createdAt.toDate();
      const key       = dayKey(d);
      const revenue   = s.total || 0;
      const returned  = s.returnedAmount || 0; // already stored on sale doc
      const net       = revenue - returned;
      const cost      = (s.items||[]).reduce((sum,i) => sum + (i.costPrice||0)*i.qty, 0);

      grossRevenue  += revenue;
      totalCost     += cost;
      totalDiscount += (s.flatDiscount||s.discount||0);

      if (!byDay[key]) byDay[key] = { grossRevenue:0, returned:0, netRevenue:0, cost:0, bills:0 };
      byDay[key].grossRevenue += revenue;
      byDay[key].returned     += returned;
      byDay[key].netRevenue   += net;
      byDay[key].cost         += cost;
      byDay[key].bills        += 1;
    });

    const netRevenue = grossRevenue - totalReturned;

    const rows = Object.entries(byDay)
      .sort((a,b) => a[0]<b[0]?1:-1)
      .map(([date,v]) => ({ date, ...v, profit: v.netRevenue - v.cost }));

    return {
      grossRevenue, totalReturned, netRevenue,
      totalCost, totalDiscount,
      netProfit: netRevenue - totalCost,
      billCount: filtered.length,
      returnCount: returnsInRange.length,
      rows,
    };
  }, [sales, returns, range]);

  if (!isAdmin) return null;

  return (
    <div style={{ padding:32, maxWidth:900 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Reports</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Revenue, returns, cost aur net profit</p>
        </div>
        <select value={range} onChange={e=>setRange(e.target.value)}
          style={{ fontSize:13, border:"1px solid #dce6e2", borderRadius:8, padding:"7px 12px", background:"white", outline:"none" }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12, marginBottom:28 }}>
        <Stat label="Gross Revenue"   value={`Rs. ${computed.grossRevenue.toFixed(0)}`}  sub={`${computed.billCount} bills`}/>
        <Stat label="Returns"         value={`− Rs. ${computed.totalReturned.toFixed(0)}`} sub={`${computed.returnCount} returns`} red/>
        <Stat label="Net Revenue"     value={`Rs. ${computed.netRevenue.toFixed(0)}`}    teal/>
        <Stat label="Cost (COGS)"     value={`Rs. ${computed.totalCost.toFixed(0)}`}     sub="purchase cost"/>
        <Stat label="Net Profit"      value={`Rs. ${computed.netProfit.toFixed(0)}`}     teal bold/>
        <Stat label="Discounts given" value={`Rs. ${computed.totalDiscount.toFixed(0)}`} sub="flat disc total"/>
      </div>

      {/* Daily table */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Bills","Gross","Returns","Net Revenue","Cost","Profit"].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:["Gross","Returns","Net Revenue","Cost","Profit"].includes(h)?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.rows.map(r=>(
              <tr key={r.date} style={{ borderBottom:"1px solid #f0f4f2" }}>
                <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12 }}>{r.date}</td>
                <td style={{ padding:"9px 12px" }}>{r.bills}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace" }}>Rs. {r.grossRevenue.toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color: r.returned>0?"#dc2626":"#9ca3af" }}>
                  {r.returned>0 ? `− Rs. ${r.returned.toFixed(0)}` : "—"}
                </td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>Rs. {r.netRevenue.toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#6b7280" }}>Rs. {r.cost.toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color: r.profit>=0?"#0e6e5c":"#dc2626" }}>
                  Rs. {r.profit.toFixed(0)}
                </td>
              </tr>
            ))}
            {computed.rows.length===0 && (
              <tr><td colSpan={7} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Is range mein koi sale nahi hui.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize:12, color:"#9ca3af", marginTop:12 }}>
        * Net Profit = Net Revenue − COGS. Sahi results ke liye inventory mein har medicine ka cost price zaroor bharen.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, red, teal, bold }) {
  return (
    <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"14px 16px" }}>
      <p style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:4 }}>{label}</p>
      <p style={{ fontSize:20, fontWeight: bold?800:700, color: red?"#dc2626": teal?"#0e6e5c":"#111" }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{sub}</p>}
    </div>
  );
}
