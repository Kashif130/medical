"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  watchPractitionerServices, addPractitionerService, updatePractitionerService, deletePractitionerService,
  watchPractitionerVisits, addPractitionerVisit, deletePractitionerVisit,
} from "@/lib/firebase";
import { Stethoscope, Plus, Trash2, X, Settings, Search } from "lucide-react";

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayKey(date)  { return date.toISOString().slice(0,10); }

const RANGE_LABELS = {
  today:     "Today",
  yesterday: "Yesterday",
  week:      "This Week",
  month:     "This Month",
  year:      "This Year",
};

function getRangeBounds(rangeKey) {
  const now = new Date();
  const todayStart = startOfDay(now);

  if (rangeKey === "today") {
    return { start: todayStart, end: new Date(todayStart.getTime() + 86400000) };
  }
  if (rangeKey === "yesterday") {
    const start = new Date(todayStart.getTime() - 86400000);
    return { start, end: todayStart };
  }
  if (rangeKey === "week") {
    const day = todayStart.getDay(); // 0=Sun
    const start = new Date(todayStart.getTime() - day * 86400000);
    return { start, end: new Date(todayStart.getTime() + 86400000) };
  }
  if (rangeKey === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: new Date(todayStart.getTime() + 86400000) };
  }
  if (rangeKey === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: new Date(todayStart.getTime() + 86400000) };
  }
  return { start: todayStart, end: new Date(todayStart.getTime() + 86400000) };
}

export default function PractitionerPage() {
  const { profile, isAdmin } = useAuth();
  const [services, setServices]     = useState([]);
  const [visits, setVisits]         = useState([]);
  const [range, setRange]           = useState("today");
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showServiceMgr, setShowServiceMgr] = useState(false);
  const [search, setSearch]         = useState("");

  useEffect(() => watchPractitionerServices(setServices), []);
  useEffect(() => watchPractitionerVisits(setVisits), []);

  const { start, end } = getRangeBounds(range);

  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (!v.createdAt?.toDate) return false;
      const t = v.createdAt.toDate().getTime();
      return t >= start.getTime() && t < end.getTime();
    });
  }, [visits, start, end]);

  const searchedVisits = useMemo(() => {
    if (!search.trim()) return filteredVisits;
    const q = search.toLowerCase();
    return filteredVisits.filter(v =>
      (v.patientName||"").toLowerCase().includes(q) ||
      (v.patientPhone||"").includes(q)
    );
  }, [filteredVisits, search]);

  const summary = useMemo(() => {
    const totalEarnings = filteredVisits.reduce((s,v) => s + (v.total||0), 0);
    const totalDiscount = filteredVisits.reduce((s,v) => s + (v.discount||0), 0);
    const visitCount     = filteredVisits.length;

    const byDay = {};
    filteredVisits.forEach(v => {
      const key = dayKey(v.createdAt.toDate());
      if (!byDay[key]) byDay[key] = { earnings:0, visits:0 };
      byDay[key].earnings += v.total||0;
      byDay[key].visits   += 1;
    });
    const rows = Object.entries(byDay).sort((a,b)=> a[0]<b[0]?1:-1).map(([date,v]) => ({ date, ...v }));

    return { totalEarnings, totalDiscount, visitCount, rows };
  }, [filteredVisits]);

  return (
    <div style={{ padding:32, maxWidth:960 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
            <Stethoscope size={18} color="#0e6e5c"/> Practitioner
          </h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Doctor consultation aur services ka hisab</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setShowServiceMgr(true)} style={btnGhost}>
            <Settings size={14}/> Services
          </button>
          <button onClick={()=>setShowVisitForm(true)} style={btnPrimary}>
            <Plus size={14}/> New Visit
          </button>
        </div>
      </div>

      {/* Range selector */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {Object.entries(RANGE_LABELS).map(([key,label]) => (
          <button key={key} onClick={()=>setRange(key)} style={{
            fontSize:12.5, fontWeight:600, padding:"7px 14px", borderRadius:20, cursor:"pointer",
            border: range===key ? "1px solid #0e6e5c" : "1px solid #dce6e2",
            background: range===key ? "#0e6e5c" : "white",
            color: range===key ? "white" : "#374151",
          }}>{label}</button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12, marginBottom:28 }}>
        <Stat label={`${RANGE_LABELS[range]} Earnings`} value={`Rs. ${summary.totalEarnings.toFixed(0)}`} teal bold/>
        <Stat label="Visits" value={summary.visitCount} />
        <Stat label="Discounts given" value={`Rs. ${summary.totalDiscount.toFixed(0)}`} sub="total waived"/>
        <Stat label="Avg per visit" value={`Rs. ${summary.visitCount ? (summary.totalEarnings/summary.visitCount).toFixed(0) : 0}`} />
      </div>

      {/* Daily breakdown table (only useful for multi-day ranges) */}
      {(range==="week"||range==="month"||range==="year") && (
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden", marginBottom:24 }}>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #dce6e2" }}>
                {["Date","Visits","Earnings"].map(h=>(
                  <th key={h} style={{ padding:"9px 12px", textAlign:h==="Earnings"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map(r => (
                <tr key={r.date} style={{ borderBottom:"1px solid #f0f4f2" }}>
                  <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12 }}>{r.date}</td>
                  <td style={{ padding:"9px 12px" }}>{r.visits}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>Rs. {r.earnings.toFixed(0)}</td>
                </tr>
              ))}
              {summary.rows.length===0 && (
                <tr><td colSpan={3} style={{ padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Is range mein koi visit nahi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Visit list */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <div style={{ position:"relative", flex:1, maxWidth:280 }}>
          <Search size={14} style={{ position:"absolute", left:10, top:9, color:"#9ca3af" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Patient naam ya phone search karein"
            style={{ width:"100%", fontSize:13, padding:"7px 10px 7px 30px", border:"1px solid #dce6e2", borderRadius:8, outline:"none" }}/>
        </div>
      </div>

      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Time","Patient","Services","Amount",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:h==="Amount"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {searchedVisits.map(v => (
              <tr key={v.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12, color:"#6b7280" }}>
                  {v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("en-PK",{ dateStyle:"short", timeStyle:"short" }) : "—"}
                </td>
                <td style={{ padding:"9px 12px" }}>
                  <div style={{ fontWeight:600 }}>{v.patientName||"Walk-in"}</div>
                  {v.patientPhone && <div style={{ fontSize:11, color:"#9ca3af" }}>{v.patientPhone}</div>}
                </td>
                <td style={{ padding:"9px 12px", fontSize:12, color:"#4b5563" }}>
                  {(v.services||[]).map(s=>s.name).join(", ")}
                </td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:"#0e6e5c" }}>
                  Rs. {(v.total||0).toFixed(0)}
                </td>
                <td style={{ padding:"9px 12px", textAlign:"right" }}>
                  {isAdmin && (
                    <button onClick={()=>{ if(confirm("Yeh visit delete karni hai?")) deletePractitionerVisit(v.id); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", padding:4 }}>
                      <Trash2 size={14}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {searchedVisits.length===0 && (
              <tr><td colSpan={5} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi visit nahi mili.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showVisitForm && (
        <VisitForm services={services} onClose={()=>setShowVisitForm(false)} profile={profile}/>
      )}
      {showServiceMgr && (
        <ServiceManager services={services} onClose={()=>setShowServiceMgr(false)}/>
      )}
    </div>
  );
}

function VisitForm({ services, onClose, profile }) {
  const [patientName, setPatientName]   = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selected, setSelected]         = useState([]); // [{id,name,fee}]
  const [discount, setDiscount]         = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes]               = useState("");
  const [busy, setBusy]                 = useState(false);
  const [error, setError]               = useState("");

  const activeServices = services.filter(s => s.active !== false);
  const subtotal = selected.reduce((s,i)=>s+Number(i.fee||0),0);
  const total    = Math.max(0, subtotal - Number(discount||0));

  function toggleService(svc) {
    setSelected(prev => {
      const exists = prev.find(s => s.id === svc.id);
      if (exists) return prev.filter(s => s.id !== svc.id);
      return [...prev, { id: svc.id, name: svc.name, fee: svc.fee }];
    });
  }

  async function handleSave() {
    if (selected.length === 0) { setError("Kam se kam ek service select karein."); return; }
    setBusy(true); setError("");
    try {
      await addPractitionerVisit({
        patientName, patientPhone, services: selected,
        discount, paymentMethod, notes,
        createdBy: profile ? { id: profile.id, name: profile.name } : null,
      });
      onClose();
    } catch (e) {
      setError(e.message || "Visit save nahi hui.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth:460 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>New Practitioner Visit</h2>
          <button onClick={onClose} style={iconBtn}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <input placeholder="Patient naam" value={patientName} onChange={e=>setPatientName(e.target.value)} style={inputStyle}/>
          <input placeholder="Phone (optional)" value={patientPhone} onChange={e=>setPatientPhone(e.target.value)} style={inputStyle}/>
        </div>

        <p style={{ fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8, textTransform:"uppercase" }}>Services</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
          {activeServices.map(svc => {
            const isSel = selected.some(s => s.id === svc.id);
            return (
              <button key={svc.id} onClick={()=>toggleService(svc)} style={{
                fontSize:12.5, padding:"7px 12px", borderRadius:8, cursor:"pointer",
                border: isSel ? "1px solid #0e6e5c" : "1px solid #dce6e2",
                background: isSel ? "#e6f4f1" : "white",
                color: isSel ? "#0e6e5c" : "#374151", fontWeight:isSel?600:500,
              }}>
                {svc.name} — Rs. {svc.fee}
              </button>
            );
          })}
          {activeServices.length===0 && (
            <p style={{ fontSize:12.5, color:"#9ca3af" }}>Koi service nahi mili. Pehle "Services" se add karein.</p>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={labelStyle}>Discount (Rs.)</label>
            <input type="number" value={discount} onChange={e=>setDiscount(e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Payment</label>
            <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} style={inputStyle}>
              <option>Cash</option><option>Card</option><option>Online</option>
            </select>
          </div>
        </div>

        <textarea placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)}
          style={{ ...inputStyle, width:"100%", minHeight:60, marginBottom:14, resize:"vertical" }}/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid #f0f4f2", marginBottom:14 }}>
          <span style={{ fontSize:13, color:"#6b7280" }}>Subtotal: Rs. {subtotal.toFixed(0)}</span>
          <span style={{ fontSize:17, fontWeight:800, color:"#0e6e5c" }}>Total: Rs. {total.toFixed(0)}</span>
        </div>

        {error && <p style={{ color:"#dc2626", fontSize:12.5, marginBottom:10 }}>{error}</p>}

        <button onClick={handleSave} disabled={busy} style={{ ...btnPrimary, width:"100%", justifyContent:"center", padding:"10px", opacity:busy?0.6:1 }}>
          {busy ? "Saving..." : "Save Visit"}
        </button>
      </div>
    </div>
  );
}

function ServiceManager({ services, onClose }) {
  const [name, setName] = useState("");
  const [fee, setFee]   = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!name.trim() || !fee) { setError("Naam aur fee dono zaroori hain."); return; }
    setError("");
    await addPractitionerService({ name: name.trim(), fee: Number(fee) });
    setName(""); setFee("");
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth:420 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>Manage Services</h2>
          <button onClick={onClose} style={iconBtn}><X size={18}/></button>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input placeholder="Service naam (e.g. Checkup)" value={name} onChange={e=>setName(e.target.value)} style={{ ...inputStyle, flex:1 }}/>
          <input placeholder="Fee" type="number" value={fee} onChange={e=>setFee(e.target.value)} style={{ ...inputStyle, width:90 }}/>
          <button onClick={handleAdd} style={btnPrimary}><Plus size={14}/></button>
        </div>
        {error && <p style={{ color:"#dc2626", fontSize:12.5, marginBottom:10 }}>{error}</p>}

        <div style={{ maxHeight:300, overflowY:"auto" }}>
          {services.map(svc => (
            <div key={svc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 4px", borderBottom:"1px solid #f0f4f2" }}>
              <div>
                <p style={{ fontSize:13.5, fontWeight:600 }}>{svc.name}</p>
                <p style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>Rs. {svc.fee}</p>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <label style={{ fontSize:11, display:"flex", alignItems:"center", gap:4, color:"#6b7280" }}>
                  <input type="checkbox" checked={svc.active!==false} onChange={e=>updatePractitionerService(svc.id,{active:e.target.checked})}/>
                  Active
                </label>
                <button onClick={()=>{ if(confirm("Delete karein?")) deletePractitionerService(svc.id); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", padding:4 }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
          {services.length===0 && <p style={{ fontSize:13, color:"#9ca3af", textAlign:"center", padding:"20px 0" }}>Abhi koi service nahi. Upar se add karein.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, teal, bold }) {
  return (
    <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:"14px 16px" }}>
      <p style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af", textTransform:"uppercase", marginBottom:4 }}>{label}</p>
      <p style={{ fontSize:20, fontWeight: bold?800:700, color: teal?"#0e6e5c":"#111" }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{sub}</p>}
    </div>
  );
}

const btnPrimary = {
  display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"white",
  background:"#0e6e5c", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer",
};
const btnGhost = {
  display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"#374151",
  background:"white", border:"1px solid #dce6e2", borderRadius:8, padding:"8px 14px", cursor:"pointer",
};
const overlayStyle = {
  position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex",
  alignItems:"center", justifyContent:"center", zIndex:50, padding:16,
};
const modalStyle = {
  background:"white", borderRadius:14, padding:24, width:"100%", maxHeight:"90vh", overflowY:"auto",
};
const inputStyle = {
  fontSize:13, padding:"8px 10px", border:"1px solid #dce6e2", borderRadius:8, outline:"none", width:"100%",
};
const labelStyle = {
  fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:4, display:"block", textTransform:"uppercase",
};
const iconBtn = {
  background:"none", border:"none", cursor:"pointer", color:"#6b7280", padding:4,
};
