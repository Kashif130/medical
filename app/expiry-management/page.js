"use client";

import { useEffect, useState, useMemo } from "react";
import { watchInventory, daysUntil } from "@/lib/firebase";
import { AlertTriangle, XCircle, Clock, CheckCircle2 } from "lucide-react";

export default function ExpiryManagementPage() {
  const [medicines, setMedicines] = useState([]);
  const [filter, setFilter]       = useState("all"); // all | expired | critical | warning | safe

  useEffect(() => watchInventory(setMedicines), []);

  const categorized = useMemo(() => {
    return medicines.map(m => {
      const d = daysUntil(m.expiryDate);
      let cat = "unknown";
      if (d !== null) {
        if (d < 0)   cat = "expired";
        else if (d <= 30)  cat = "critical";
        else if (d <= 60)  cat = "warning";
        else               cat = "safe";
      }
      return { ...m, daysLeft: d, cat };
    }).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [medicines]);

  const counts = useMemo(() => ({
    expired:  categorized.filter(m=>m.cat==="expired").length,
    critical: categorized.filter(m=>m.cat==="critical").length,
    warning:  categorized.filter(m=>m.cat==="warning").length,
    safe:     categorized.filter(m=>m.cat==="safe").length,
  }), [categorized]);

  const filtered = useMemo(() => {
    if (filter === "all") return categorized.filter(m=>m.cat!=="safe"&&m.cat!=="unknown");
    return categorized.filter(m=>m.cat===filter);
  }, [categorized, filter]);

  const CAT = {
    expired:  { label:"Expired",        bg:"#fee2e2", color:"#dc2626", icon:<XCircle size={14}/> },
    critical: { label:"30 din se kam",  bg:"#fef2f2", color:"#ef4444", icon:<AlertTriangle size={14}/> },
    warning:  { label:"60 din se kam",  bg:"#fef9c3", color:"#d97706", icon:<Clock size={14}/> },
    safe:     { label:"Safe",           bg:"#dcfce7", color:"#16a34a", icon:<CheckCircle2 size={14}/> },
    unknown:  { label:"Date nahi",      bg:"#f3f4f6", color:"#9ca3af", icon:null },
  };

  function generateWhatsAppReminder(m) {
    const msg = `🏥 *Umer Din Medical Store*\n\nAssalam o Alaikum!\n\n*${m.name}* ki expiry date *${m.expiryDate}* hai — sirf *${m.daysLeft} din* bacha hai.\n\nNaya stock mangwana ho toh abhi batayein.\n\n📞 03XX-XXXXXXX`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div style={{ padding:24, maxWidth:1000 }}>
      <h1 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Expiry Management</h1>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>Sirf expiry wali medicines — ek jagah sab kuch</p>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:12, marginBottom:24 }}>
        {[
          { key:"expired",  label:"Expired",       count:counts.expired,  ...CAT.expired },
          { key:"critical", label:"30 din se kam", count:counts.critical, ...CAT.critical },
          { key:"warning",  label:"60 din se kam", count:counts.warning,  ...CAT.warning },
          { key:"safe",     label:"Safe",           count:counts.safe,    ...CAT.safe },
        ].map(c=>(
          <div key={c.key} onClick={()=>setFilter(filter===c.key?"all":c.key)}
            style={{ background:filter===c.key?c.color:"white", border:`2px solid ${filter===c.key?c.color:"#dce6e2"}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s" }}>
            <p style={{ fontSize:28, fontWeight:800, color:filter===c.key?"white":c.color }}>{c.count}</p>
            <p style={{ fontSize:12, fontWeight:600, color:filter===c.key?"rgba(255,255,255,0.85)":c.color }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { key:"all",      label:"Attention needed" },
          { key:"expired",  label:"Expired" },
          { key:"critical", label:"Critical (30d)" },
          { key:"warning",  label:"Warning (60d)" },
          { key:"safe",     label:"Safe" },
        ].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)}
            style={{ fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, cursor:"pointer",
              background:filter===f.key?"#0e6e5c":"white", color:filter===f.key?"white":"#6b7280",
              border:filter===f.key?"none":"1px solid #dce6e2" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Medicine","Category","Stock","Expiry Date","Days Left","Status","WhatsApp Reminder"].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m=>{
              const c = CAT[m.cat];
              return (
                <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2", background: m.cat==="expired"?"#fff5f5": m.cat==="critical"?"#fff8f8":"white" }}>
                  <td style={{ padding:"10px 12px" }}>
                    <p style={{ fontWeight:600 }}>{m.name}</p>
                    {m.batchNo && <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>Batch: {m.batchNo}</p>}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:"#6b7280" }}>{m.category||"—"}</td>
                  <td style={{ padding:"10px 12px", fontWeight:600 }}>{m.stock??0}</td>
                  <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:12 }}>{m.expiryDate||"—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    {m.daysLeft !== null ? (
                      <span style={{ fontFamily:"monospace", fontWeight:700, color: m.daysLeft<0?"#dc2626": m.daysLeft<=30?"#ef4444": m.daysLeft<=60?"#d97706":"#16a34a" }}>
                        {m.daysLeft < 0 ? `${Math.abs(m.daysLeft)}d expired` : `${m.daysLeft}d`}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99, background:c.bg, color:c.color, display:"flex", alignItems:"center", gap:4, width:"fit-content" }}>
                      {c.icon} {c.label}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    {m.daysLeft !== null && m.daysLeft <= 60 && (
                      <a href={generateWhatsAppReminder(m)} target="_blank" rel="noreferrer"
                        style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#25D366", color:"white", fontSize:11, fontWeight:600, padding:"5px 10px", borderRadius:6, textDecoration:"none" }}>
                        💬 Reminder
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && (
              <tr><td colSpan={7} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                {filter==="all" ? "✅ Koi medicine expiry ke qareeb nahi — sab safe hai!" : "Is category mein koi medicine nahi."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
    }
    
