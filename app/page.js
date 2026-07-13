"use client";

import { useEffect, useMemo, useState } from "react";
import { watchSales, watchInventory, watchCredits, watchReturns, daysUntil } from "@/lib/firebase";
import {
  ShoppingCart, Package, AlertTriangle, CreditCard,
  TrendingUp, TrendingDown, Clock, CheckCircle2, RotateCcw,
} from "lucide-react";
import Link from "next/link";

function fmt(n) { return Number(n||0).toLocaleString("en-PK"); }

export default function DashboardPage() {
  const [sales,     setSales]     = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [credits,   setCredits]   = useState([]);
  const [returns,   setReturns]   = useState([]);
  const [isMobile,  setIsMobile]  = useState(false);

  useEffect(() => watchSales(setSales),         []);
  useEffect(() => watchInventory(setMedicines), []);
  useEffect(() => watchCredits(setCredits),     []);
  useEffect(() => watchReturns(setReturns),     []);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const now   = new Date();
  const today = now.toDateString();

  const stats = useMemo(() => {
    const todaySales   = sales.filter(s => s.createdAt?.toDate?.()?.toDateString() === today);
    const todayGross   = todaySales.reduce((s,x)  => s + (x.total||0), 0);
    const todayReturn  = todaySales.reduce((s,x)  => s + (x.returnedAmount||0), 0);
    const todayNet     = todayGross - todayReturn;
    const todayProfit  = todaySales.reduce((s,x)  => {
      const cost = (x.items||[]).reduce((c,i) => c + (i.costPrice||0)*i.qty, 0);
      return s + (x.total||0) - cost;
    }, 0);
    const todayBills   = todaySales.length;

    // This month
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const monthSales = sales.filter(s => {
      const d = s.createdAt?.toDate?.();
      return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === monthKey;
    });
    const monthRevenue = monthSales.reduce((s,x) => s + (x.total||0), 0);
    const monthReturned= monthSales.reduce((s,x) => s + (x.returnedAmount||0), 0);
    const monthNet     = monthRevenue - monthReturned;

    // Yesterday comparison
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
    const ydaySales  = sales.filter(s => s.createdAt?.toDate?.()?.toDateString() === yesterday.toDateString());
    const ydayNet    = ydaySales.reduce((s,x) => s + (x.total||0) - (x.returnedAmount||0), 0);
    const vsYday     = ydayNet > 0 ? ((todayNet - ydayNet)/ydayNet*100).toFixed(0) : null;

    // Stock alerts
    const lowStock   = medicines.filter(m => (m.stock??0) <= (m.reorderLevel??10) && (m.stock??0) > 0);
    const outOfStock = medicines.filter(m => (m.stock??0) <= 0);
    const expiring   = medicines.filter(m => { const d = daysUntil(m.expiryDate); return d!==null && d>=0 && d<=30; });
    const expired    = medicines.filter(m => { const d = daysUntil(m.expiryDate); return d!==null && d<0; });

    // Credits
    const pendingCredits = credits.filter(c => c.status !== "paid");
    const totalPending   = pendingCredits.reduce((s,c) => s + (c.remaining||0), 0);

    // Returns today
    const todayReturns = returns.filter(r => r.createdAt?.toDate?.()?.toDateString() === today);
    const todayRefunded= todayReturns.reduce((s,r) => s + (r.refundAmount||0), 0);

    // Last 7 days chart data
    const chart = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const key = d.toDateString();
      const daySales = sales.filter(s => s.createdAt?.toDate?.()?.toDateString()===key);
      chart.push({
        label: d.toLocaleDateString("en-PK",{weekday:"short"}),
        net: daySales.reduce((s,x) => s+(x.total||0)-(x.returnedAmount||0), 0),
        bills: daySales.length,
      });
    }

    // Top selling medicines today
    const medMap = {};
    todaySales.forEach(s => (s.items||[]).forEach(i => {
      medMap[i.name] = (medMap[i.name]||0) + i.qty;
    }));
    const topMeds = Object.entries(medMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

    return {
      todayNet, todayGross, todayReturn, todayProfit, todayBills,
      monthNet, monthRevenue, monthReturned,
      vsYday, ydayNet,
      lowStock, outOfStock, expiring, expired,
      pendingCredits, totalPending,
      todayReturns, todayRefunded,
      chart, topMeds,
    };
  }, [sales, medicines, credits, returns, today]);

  const maxChart = Math.max(...stats.chart.map(c=>c.net), 1);

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:800 }}>Dashboard</h1>
        <p style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>
          {now.toLocaleDateString("en-PK",{weekday:"long", year:"numeric", month:"long", day:"numeric"})}
        </p>
      </div>

      {/* Top KPI row */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <KpiCard
          label="Aaj ki net sale" icon={<ShoppingCart size={16}/>}
          value={`Rs. ${fmt(stats.todayNet)}`}
          sub={`${stats.todayBills} bills · Gross Rs.${fmt(stats.todayGross)}`}
          badge={stats.vsYday!==null ? {
            text: `${stats.vsYday>0?"+":""}${stats.vsYday}% vs kal`,
            color: stats.vsYday>=0?"#16a34a":"#dc2626"
          } : null}
          color="#0e6e5c"
        />
        <KpiCard
          label="Aaj ka profit" icon={<TrendingUp size={16}/>}
          value={`Rs. ${fmt(stats.todayProfit)}`}
          sub={`Margin: ${stats.todayGross>0?(stats.todayProfit/stats.todayGross*100).toFixed(1):0}%`}
          color={stats.todayProfit>=0?"#0e6e5c":"#dc2626"}
        />
        <KpiCard
          label="Is mahine ki net" icon={<TrendingUp size={16}/>}
          value={`Rs. ${fmt(stats.monthNet)}`}
          sub={`Gross Rs.${fmt(stats.monthRevenue)} · Return Rs.${fmt(stats.monthReturned)}`}
          color="#2563eb"
        />
        <KpiCard
          label="Total udhar baaki" icon={<CreditCard size={16}/>}
          value={`Rs. ${fmt(stats.totalPending)}`}
          sub={`${stats.pendingCredits.length} customers`}
          color="#d97706"
          href="/credits"
        />
      </div>

      {/* Alerts row */}
      {(stats.outOfStock.length>0 || stats.expiring.length>0 || stats.expired.length>0 || stats.lowStock.length>0) && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:20 }}>
          {stats.outOfStock.length>0 && (
            <AlertCard href="/inventory" color="#dc2626" bg="#fee2e2"
              icon={<Package size={14}/>}
              title={`${stats.outOfStock.length} Out of stock`}
              sub="Stock khatam — reorder karein"/>
          )}
          {stats.expired.length>0 && (
            <AlertCard href="/expiry-management" color="#dc2626" bg="#fee2e2"
              icon={<AlertTriangle size={14}/>}
              title={`${stats.expired.length} Expired`}
              sub="Shelf se hatayein"/>
          )}
          {stats.expiring.length>0 && (
            <AlertCard href="/expiry-management" color="#d97706" bg="#fef9c3"
              icon={<Clock size={14}/>}
              title={`${stats.expiring.length} Expiring (30d)`}
              sub="Jaldi sell karein"/>
          )}
          {stats.lowStock.length>0 && (
            <AlertCard href="/inventory" color="#d97706" bg="#fef9c3"
              icon={<AlertTriangle size={14}/>}
              title={`${stats.lowStock.length} Low stock`}
              sub="Reorder level pe hain"/>
          )}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"2fr 1fr", gap:20, marginBottom:20 }}>
        {/* 7-day chart */}
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:14, padding:20 }}>
          <p style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Last 7 days — Net Sale</p>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120 }}>
            {stats.chart.map((d,i)=>{
              const h = maxChart>0 ? Math.max(4, (d.net/maxChart)*120) : 4;
              const isToday = i===6;
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:9, color:"#9ca3af", fontFamily:"monospace" }}>
                    {d.net>0?`Rs.${Math.round(d.net/1000)}k`:""}
                  </span>
                  <div style={{ width:"100%", height:h, borderRadius:"4px 4px 0 0",
                    background: isToday?"#0e6e5c": d.net>0?"#a7f3d0":"#f0f4f2",
                    transition:"height 0.3s" }}/>
                  <span style={{ fontSize:10, color: isToday?"#0e6e5c":"#9ca3af", fontWeight: isToday?700:400 }}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's stats */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {stats.todayReturn>0 && (
            <div style={{ background:"#fff8f0", border:"1px solid #fed7aa", borderRadius:12, padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <RotateCcw size={14} color="#d97706"/>
                <p style={{ fontSize:13, fontWeight:700, color:"#d97706" }}>Aaj ke returns</p>
              </div>
              <p style={{ fontSize:20, fontWeight:800, color:"#d97706", fontFamily:"monospace" }}>− Rs. {fmt(stats.todayRefunded)}</p>
              <p style={{ fontSize:11, color:"#9ca3af" }}>{stats.todayReturns.length} return transactions</p>
            </div>
          )}

          {/* Top medicines today */}
          {stats.topMeds.length>0 && (
            <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"14px 16px", flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Aaj ki top medicines</p>
              {stats.topMeds.map(([name,qty],i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #f0f4f2", fontSize:13 }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%" }}>{name}</span>
                  <span style={{ fontFamily:"monospace", fontWeight:600, color:"#0e6e5c", flexShrink:0 }}>{qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending credits table */}
      {stats.pendingCredits.length>0 && (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:14, overflow:"hidden", marginBottom:20 }}>
          <div style={{ padding:"12px 18px", borderBottom:"1px solid #dce6e2", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={{ fontSize:14, fontWeight:700 }}>Pending Udhar</p>
            <Link href="/credits" style={{ fontSize:12, color:"#0e6e5c", fontWeight:600, textDecoration:"none" }}>Sab dekho →</Link>
          </div>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <tbody>
              {stats.pendingCredits.slice(0,5).map(c=>(
                <tr key={c.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                  <td style={{ padding:"9px 18px", fontWeight:500 }}>{c.customerName||"—"}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{c.customerPhone||""}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:"#dc2626" }}>
                    Rs. {fmt(c.remaining)}
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99,
                      background: c.status==="partial"?"#fef9c3":"#fee2e2",
                      color: c.status==="partial"?"#d97706":"#dc2626" }}>
                      {c.status==="partial"?"Partial":"Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Low stock table */}
      {stats.lowStock.length>0 && (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:"12px 18px", borderBottom:"1px solid #dce6e2", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={{ fontSize:14, fontWeight:700 }}>Low Stock — Reorder karein</p>
            <Link href="/inventory" style={{ fontSize:12, color:"#0e6e5c", fontWeight:600, textDecoration:"none" }}>Sab dekho →</Link>
          </div>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <tbody>
              {stats.lowStock.slice(0,5).map(m=>(
                <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                  <td style={{ padding:"9px 18px", fontWeight:500 }}>{m.name}</td>
                  <td style={{ padding:"9px 12px", fontSize:12, color:"#9ca3af" }}>{m.category||"—"}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:"#d97706" }}>
                    {m.stock} left
                  </td>
                  <td style={{ padding:"9px 12px", fontSize:12, color:"#9ca3af" }}>
                    Reorder: {m.reorderLevel||10}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, badge, color="#111", href }) {
  const content = (
    <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"14px 16px", height:"100%" }}>
      <p style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:6 }}>{label}</p>
      <p style={{ fontSize:22, fontWeight:800, color, lineHeight:1.1 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>{sub}</p>}
      {badge && <span style={{ display:"inline-block", marginTop:6, fontSize:11, fontWeight:700,
        padding:"2px 8px", borderRadius:99, background:`${badge.color}20`, color:badge.color }}>{badge.text}</span>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration:"none" }}>{content}</Link> : content;
}

function AlertCard({ title, sub, icon, color, bg, href }) {
  return (
    <Link href={href} style={{ textDecoration:"none" }}>
      <div style={{ background:bg, border:`1px solid ${color}40`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"flex-start", gap:8 }}>
        <span style={{ color, marginTop:1 }}>{icon}</span>
        <div>
          <p style={{ fontSize:12, fontWeight:700, color }}>{title}</p>
          <p style={{ fontSize:11, color }}>{sub}</p>
        </div>
      </div>
    </Link>
  );
}
