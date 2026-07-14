"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  watchDailyEarnings, upsertDailyEarning, deleteDailyEarning,
  watchDailyExpenses, addDailyExpense, deleteDailyExpense,
} from "@/lib/firebase";
import { Wallet, Save, Trash2, Pencil, X, Receipt, Plus } from "lucide-react";

const PARTNER_A_LABEL = "Partner A (70%)";
const PARTNER_B_LABEL = "Partner B (30%)";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function startOfWeekKey() {
  const d = new Date();
  const day = d.getDay();
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
  const [expenses, setExpenses] = useState([]);

  // Earning form state
  const [amount, setAmount]     = useState("");
  const [dateKey, setDateKey]   = useState(todayKey());
  const [note, setNote]         = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");

  // Expense form state
  const [expDate, setExpDate]   = useState(todayKey());
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expBusy, setExpBusy]   = useState(false);
  const [expError, setExpError] = useState("");

  useEffect(() => watchDailyEarnings(setEntries), []);
  useEffect(() => watchDailyExpenses(setExpenses), []);

  const existingForDate = entries.find(e => e.dateKey === dateKey);

  useEffect(() => {
    if (existingForDate && editingId !== existingForDate.id) {
      setAmount(String(existingForDate.total));
      setNote(existingForDate.note || "");
      setEditingId(existingForDate.id);
    } else if (!existingForDate && editingId) {
      setAmount(""); setNote(""); setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  async function handleSaveEarning() {
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

  function handleEditEarning(entry) {
    setDateKey(entry.dateKey);
    setAmount(String(entry.total));
    setNote(entry.note || "");
    setEditingId(entry.id);
  }

  function handleCancelEdit() {
    setDateKey(todayKey());
    setAmount(""); setNote(""); setEditingId(null);
  }

  async function handleAddExpense() {
    if (!expTitle.trim()) { setExpError("Kharche ka naam likhein."); return; }
    if (!expAmount || Number(expAmount) <= 0) { setExpError("Sahi amount likhein."); return; }
    setExpBusy(true); setExpError("");
    try {
      await addDailyExpense({
        dateKey: expDate, title: expTitle.trim(), amount: expAmount,
        createdBy: profile ? { id: profile.id, name: profile.name } : null,
      });
      setExpTitle(""); setExpAmount("");
    } catch (e) {
      setExpError(e.message || "Kharcha save nahi hua.");
    } finally {
      setExpBusy(false);
    }
  }

  // ── Combine earnings + expenses by date, then compute net + splits ──
  function computeForRange(fromKey) {
    const earn = entries.filter(e => e.dateKey >= fromKey).reduce((s,e)=>s+(e.total||0),0);
    const exp  = expenses.filter(e => e.dateKey >= fromKey).reduce((s,e)=>s+(e.amount||0),0);
    const net  = earn - exp;
    return {
      earning: earn,
      expense: exp,
      expenseA: exp*0.5, expenseB: exp*0.5,
      net,
      partnerA: net*0.70, partnerB: net*0.30,
    };
  }

  const totals = useMemo(() => ({
    today: computeForRange(todayKey()),
    week:  computeForRange(startOfWeekKey()),
    month: computeForRange(startOfMonthKey()),
    year:  computeForRange(startOfYearKey()),
  }), [entries, expenses]);

  const expensesForDate = expenses.filter(e => e.dateKey === expDate);
  const expTotalForDate = expensesForDate.reduce((s,e)=>s+(e.amount||0),0);

  return (
    <div style={{ padding:32, maxWidth:900 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
          <Wallet size={18} color="#0e6e5c"/> Daily Earnings
        </h1>
        <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>
          Daraz ki total earning aur roz ka kharcha add karein — kharcha 50/50 divide hoga, aur bachi hui net earning {PARTNER_A_LABEL} / {PARTNER_B_LABEL} mein.
        </p>
      </div>

      {/* Earning form */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:20, marginBottom:20 }}>
        <p style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Daraz Earning</p>
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

        {error && <p style={{ color:"#dc2626", fontSize:12.5, marginBottom:10 }}>{error}</p>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSaveEarning} disabled={busy} style={{ ...btnPrimary, opacity:busy?0.6:1 }}>
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

      {/* Expense form */}
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, padding:20, marginBottom:24 }}>
        <p style={{ fontSize:13, fontWeight:700, marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
          <Receipt size={14} color="#dc2626"/> Kharcha (Expenses)
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr 1fr auto", gap:10, marginBottom:10, alignItems:"end" }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={expDate} onChange={e=>setExpDate(e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Kis cheez pe</label>
            <input placeholder="e.g. Bijli bill, Cleaning" value={expTitle} onChange={e=>setExpTitle(e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Amount (Rs.)</label>
            <input type="number" placeholder="e.g. 500" value={expAmount} onChange={e=>setExpAmount(e.target.value)} style={inputStyle}/>
          </div>
          <button onClick={handleAddExpense} disabled={expBusy} style={{ ...btnPrimary, opacity:expBusy?0.6:1, height:36 }}>
            <Plus size={14}/> Add
          </button>
        </div>
        {expError && <p style={{ color:"#dc2626", fontSize:12.5, marginBottom:10 }}>{expError}</p>}

        {/* Expenses list for the picked date */}
        {expensesForDate.length > 0 && (
          <div style={{ marginTop:8, borderTop:"1px solid #f0f4f2", paddingTop:10 }}>
            {expensesForDate.map(e => (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", fontSize:13 }}>
                <span style={{ color:"#374151" }}>{e.title}</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontFamily:"monospace", color:"#dc2626" }}>− Rs. {(e.amount||0).toFixed(0)}</span>
                  <button onClick={()=>{ if(confirm("Kharcha delete karna hai?")) deleteDailyExpense(e.id); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:2 }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, fontWeight:700, marginTop:6, paddingTop:6, borderTop:"1px dashed #e5e7eb" }}>
              <span>Total kharcha ({expDate})</span>
              <span style={{ fontFamily:"monospace", color:"#dc2626" }}>Rs. {expTotalForDate.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px,1fr))", gap:12, marginBottom:28 }}>
        <SummaryCard title="Today"      data={totals.today}/>
        <SummaryCard title="This Week"  data={totals.week}/>
        <SummaryCard title="This Month" data={totals.month}/>
        <SummaryCard title="This Year"  data={totals.year}/>
      </div>

      {/* Earnings table */}
      <p style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Earnings History</p>
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden", marginBottom:24 }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Earning","Note",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:h==="Earning"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12 }}>{e.dateKey}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>Rs. {(e.total||0).toFixed(0)}</td>
                <td style={{ padding:"9px 12px", fontSize:12, color:"#9ca3af" }}>{e.note||"—"}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", whiteSpace:"nowrap" }}>
                  <button onClick={()=>handleEditEarning(e)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280", padding:4 }}>
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
              <tr><td colSpan={4} style={{ padding:"30px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Abhi koi entry nahi.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* All expenses table */}
      <p style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Expenses History</p>
      <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #dce6e2" }}>
              {["Date","Kharcha","Amount",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:h==="Amount"?"right":"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} style={{ borderBottom:"1px solid #f0f4f2" }}>
                <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:12 }}>{e.dateKey}</td>
                <td style={{ padding:"9px 12px" }}>{e.title}</td>
                <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#dc2626" }}>− Rs. {(e.amount||0).toFixed(0)}</td>
                <td style={{ padding:"9px 12px", textAlign:"right" }}>
                  {isAdmin && (
                    <button onClick={()=>{ if(confirm("Yeh kharcha delete karna hai?")) deleteDailyExpense(e.id); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", padding:4 }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {expenses.length===0 && (
              <tr><td colSpan={4} style={{ padding:"30px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Abhi koi kharcha nahi.</td></tr>
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

      <div style={{ fontSize:12, color:"#374151", marginBottom:2 }}>Earning: <b>Rs. {data.earning.toFixed(0)}</b></div>
      <div style={{ fontSize:12, color:"#dc2626", marginBottom:6 }}>Kharcha: <b>− Rs. {data.expense.toFixed(0)}</b></div>

      <p style={{ fontSize:19, fontWeight:800, color:"#0e6e5c", marginBottom:6 }}>Net: Rs. {data.net.toFixed(0)}</p>

      <div style={{ fontSize:11.5, color:"#6b7280", lineHeight:1.7, borderTop:"1px dashed #e5e7eb", paddingTop:6 }}>
        <div>Kharcha A (50%): <b style={{ color:"#dc2626" }}>− Rs. {data.expenseA.toFixed(0)}</b></div>
        <div>Kharcha B (50%): <b style={{ color:"#dc2626" }}>− Rs. {data.expenseB.toFixed(0)}</b></div>
        <div style={{ marginTop:4 }}>A share (70% of net): <b style={{ color:"#0e6e5c" }}>Rs. {data.partnerA.toFixed(0)}</b></div>
        <div>B share (30% of net): <b style={{ color:"#0e6e5c" }}>Rs. {data.partnerB.toFixed(0)}</b></div>
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
