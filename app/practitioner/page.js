"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { watchDailyEarnings, upsertDailyEarning, deleteDailyEarning } from "@/lib/firebase";
import { Wallet, Save, Trash2, Pencil, X } from "lucide-react";

const PARTNER_A_LABEL = "Partner A (70%)";
const PARTNER_B_LABEL = "Partner B (30%)";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD, local-ish enough for daily entry
}
function startOfWeekKey() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0,10);
}
function startOfMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function startOfYearKey() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function DailyEarningsPage() {
  const { profile, isAdmin } = useAuth();
  const [entries, setEntries]   = useState([]);
  const [amount, setAmount]     = useState("");
  const [dateKey, setDateKey]   = useState(todayKey());
  const [note, setNote]         = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => watchDailyEarnings(setEntries), []);

  const existingForDate = entries.find(e => e.dateKey === dateKey);

  useEffect(() => {
    // If an entry already exists for the picked date, load it for editing convenience
    if (existingForDate && editingId !== existingForDate.id) {
      setAmount(String(existingForDate.total));
      setNote(existingForDate.note || "");
      setEditingId(existingForDate.id);
    } else if (!existingForDate && editingId) {
      setAmount(""); setNote(""); setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  async function handleSave() {
    if (!amount || Number(amount) < 0) { setError("Sahi amount likhein."); return; }
    setBusy(true); setError("");
    try {
      await upsertDailyEarning({
        id: editingId,
        dateKey, amount,
        note,
        createdBy: profile ? { id: profile.id, name: profile.name } : null,
      });
      setAmount(""); setNote(""); setEditingId(null);
      setDateKey(todayKey());
    } catch (e) {
      setError(e.message || "Save nahi hua.");
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(entry) {
    setDateKey(entry.dateKey);
    setAmount(String(entry.total));
    setNote(entry.note || "");
    setEditingId(entry.id);
  }

  function handleCancelEdit() {
    setDateKey(todayKey());
    setAmount(""); setNote(""); setEditingId(null);
  }

  const totals = useMemo(() => {
    const wk = startOfWeekKey(), mo = startOfMonthKey(), yr = startOfYearKey(), td = todayKey();
    const sum = (list) => ({
      total:    list.reduce((s,e)=>s+(e.total||0),0),
      partnerA: list.reduce((s,e)=>s+(e.partnerA||0),0),
      partnerB: list.reduce((s,e)=>s+(e.partnerB||0),0),
      count: list.length,
    });
    return {
      today: sum(entries.filter(e => e.dateKey === td)),
      week:  sum(entries.filter(e => e.dateKey >= wk)),
      month: sum(entries.filter(e => e.dateKey >= mo)),
      year:  sum(entries.filter(e => e.dateKey >= yr)),
    };
  }, [entries]);

  return (
    <div style={{ padding:32, maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
          <Wallet size={18} color="#0e6e5c"/> Daily Earnings
        </h1>
        <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>
          Daraz mein jo total paise aaye hain woh yahan roz manually add karein — {PARTNER_A_LABEL} aur {PARTNER_B_LABEL} mein auto divide ho jayega.
        </p>
      </div>

      {/* Entry form */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:20, marginBottom:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={dateKey} onChange={e=>setDateKey(e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Total Amount (Rs.)</label>
            <input type="number" placeholder="e.g. 15000" value={amount} onChange={e=>setAmount(e.target.value)} style={inputStyle}/>
          </div>
        </div>

        <label style={labelStyle}>Note (optional)</label>
        <input placeholder="Koi note..." value={note} onChange={e=>setNote(e.target.value)} style={{ ...inputStyle, marginBottom:12 }}/>

        {amount && Number(amount) >= 0 && (
          <div style={{ display:"flex", gap:16, marginBottom:14, fontSize:13 }}>
            <span style={{ color:"#6b7280" }}>{PARTNER_A_LABEL}: <b style={{ color:"#0e6e5c" }}>Rs. {(Number(amount)*0.70).toFixed(0)}</b></span>
            <span style={{ color:"#6b7280" }}>{PARTNER_B_LABEL}: <b style={{ color:"#0e6e5c" }}>Rs. {(Number(amount)*0.30).toFixed(0)}</b></span>
          </div>
        )}

        {error && <p style={{ color:"#dc2626", fontSize:12.5, marginBottom:10 }}>{error}</p>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSave} disabled={busy} style={{ ...btnPrimary, opacity:busy?0.6:1 }}>
            <Save size={14}/> {editingId ? "Update Entry" : "Save Entry"}
          </button>
          {editingId && (
            <button onClick={handleCancelEdit} style={btnGhost}><X size={14}/> Cancel</button>
          )}
        </div>
        {existingForDate && editingId===existingForDate.id && (
          <p style={{ fontSize:11.5, color:"#9ca3af", marginTop:8 }}>Is date ki entry pehle se maujood hai — save karne par update ho jayegi.</p>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:12, marginBottom:28 }}>
        <SummaryCard title="Today"      data={totals.today}/>
        <SummaryCard title="This Week"  data={totals.week}/>
        <SummaryCard title="This Month" data={totals.month}/>
        <SummaryCard title="This Year"  data={totals.year}/>
      </div>

      {/* Entries table */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Total","Partner A (70%)","Partner B (30%)","Note",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:["Total","Partner A (70%)","Partner B (30%)"].includes(h)?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12 }}>{e.dateKey}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>Rs. {(e.total||0).toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#0e6e5c" }}>Rs. {(e.partnerA||0).toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#0e6e5c" }}>Rs. {(e.partnerB||0).toFixed(0)}</td>
                <td style={{ padding:"9px 12px", fontSize:12, color:"#9ca3af" }}>{e.note||"—"}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", whiteSpace:"nowrap" }}>
                  <button onClick={()=>handleEdit(e)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280", padding:4 }}>
                    <Pencil size={13}/>
                  </button>
                  {isAdmin && (
                    <button onClick={()=>{ if(confirm("Yeh entry delete karni hai?")) deleteDailyEarning(e.id); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", padding:4 }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length===0 && (
              <tr><td colSpan={6} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Abhi koi entry nahi. Upar se add karein.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ title, data }) {
  return (
    <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"14px 16px" }}>
      <p style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:6 }}>{title}</p>
      <p style={{ fontSize:20, fontWeight:800, color:"#0e6e5c", marginBottom:6 }}>Rs. {data.total.toFixed(0)}</p>
      <div style={{ fontSize:11.5, color:"#6b7280", lineHeight:1.6 }}>
        <div>A (70%): <b>Rs. {data.partnerA.toFixed(0)}</b></div>
        <div>B (30%): <b>Rs. {data.partnerB.toFixed(0)}</b></div>
        <div style={{ color:"#9ca3af" }}>{data.count} {data.count===1?"entry":"entries"}</div>
      </div>
    </div>
  );
}

const btnPrimary = {
  display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"white",
  background:"#0e6e5c", border:"none", borderRadius:8, padding:"9px 16px", cursor:"pointer",
};
const btnGhost = {
  display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"#374151",
  background:"white", border:"1px solid #dce6e2", borderRadius:8, padding:"9px 16px", cursor:"pointer",
};
const inputStyle = {
  fontSize:13, padding:"8px 10px", border:"1px solid #dce6e2", borderRadius:8, outline:"none", width:"100%",
};
const labelStyle = {
  fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:4, display:"block", textTransform:"uppercase",
};
