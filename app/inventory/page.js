"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  watchInventory, addMedicine, updateMedicine, deleteMedicine, expiryStatus,
} from "@/lib/firebase";
import { Plus, Pencil, Trash2, Search, X, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";

const STATUS_LABEL = { safe:"OK", warning:"Expiring", expired:"Expired", unknown:"—" };
const STATUS_COLOR = { safe:"#16a34a", warning:"#d97706", expired:"#dc2626", unknown:"#9ca3af" };

const emptyForm = {
  name:"", genericName:"", category:"", batchNo:"", stock:"",
  reorderLevel:"10", price:"", costPrice:"",
  expiryDate:"", packSize:"", manufacturer:"", barcode:"",
};

const COL_MAP = {
  name:         ["name","medicine","medicine name","naam"],
  genericName:  ["generic","generic name","salt","molecule"],
  category:     ["category","type","qism"],
  batchNo:      ["batch","batch no","batch number"],
  stock:        ["stock","quantity","qty"],
  reorderLevel: ["reorder","reorder level","min stock"],
  costPrice:    ["cost","cost price","purchase price"],
  price:        ["price","sale price","selling price"],
  expiryDate:   ["expiry","expiry date","exp date","exp"],
  packSize:     ["pack","pack size","size"],
  manufacturer: ["manufacturer","company","brand"],
  barcode:      ["barcode","bar code","sku"],
};

function normalizeHeader(h) { return String(h||"").trim().toLowerCase(); }
function mapRow(headers, row) {
  const result = {};
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    for (let i=0; i<headers.length; i++) {
      if (aliases.includes(normalizeHeader(headers[i]))) {
        result[field] = row[i]!==undefined && row[i]!==null ? String(row[i]).trim() : "";
        break;
      }
    }
  }
  return result;
}
function excelDateToString(val) {
  if (!val) return "";
  if (typeof val==="number") return new Date(Math.round((val-25569)*86400*1000)).toISOString().split("T")[0];
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,"0")}-${dmyMatch[1].padStart(2,"0")}`;
  return str;
}

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search,    setSearch]    = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyForm);
  const [error,     setError]     = useState("");
  const [isMobile,  setIsMobile]  = useState(false);
  const [showBulk,  setShowBulk]  = useState(false);
  const [bulkRows,  setBulkRows]  = useState([]);
  const [bulkErrors,setBulkErrors]= useState([]);
  const [bulkUploading,setBulkUploading] = useState(false);
  const [bulkDone,  setBulkDone]  = useState(null);
  const fileRef = useRef();

  useEffect(() => watchInventory(setMedicines), []);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth<900); }
    check(); window.addEventListener("resize",check);
    return () => window.removeEventListener("resize",check);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter(m =>
      m.name?.toLowerCase().includes(term) ||
      m.genericName?.toLowerCase().includes(term) ||  // Generic name search
      m.category?.toLowerCase().includes(term) ||
      m.batchNo?.toLowerCase().includes(term) ||
      m.manufacturer?.toLowerCase().includes(term) ||
      m.barcode?.includes(term)
    );
  }, [medicines, search]);

  function openAdd() { setForm(emptyForm); setEditingId(null); setError(""); setShowForm(true); }
  function openEdit(m) {
    setForm({
      name:m.name||"", genericName:m.genericName||"", category:m.category||"", batchNo:m.batchNo||"",
      stock:String(m.stock??""), reorderLevel:String(m.reorderLevel??"10"),
      price:String(m.price??""), costPrice:String(m.costPrice??""),
      expiryDate:m.expiryDate||"", packSize:m.packSize||"", manufacturer:m.manufacturer||"", barcode:m.barcode||"",
    });
    setEditingId(m.id); setError(""); setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name||!form.price||form.stock==="") { setError("Naam, price aur stock zaroori hain."); return; }
    const payload = {
      name:form.name.trim(), genericName:form.genericName.trim(), category:form.category.trim(),
      batchNo:form.batchNo.trim(), stock:Number(form.stock), reorderLevel:Number(form.reorderLevel||10),
      price:Number(form.price), costPrice:Number(form.costPrice||0),
      expiryDate:form.expiryDate, packSize:form.packSize.trim(),
      manufacturer:form.manufacturer.trim(), barcode:form.barcode.trim(),
    };
    try {
      if (editingId) { await updateMedicine(editingId,payload); }
      else           { await addMedicine(payload); }
      setShowForm(false);
    } catch(err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (confirm("Yeh medicine delete karein?")) await deleteMedicine(id);
  }

  function downloadTemplate() {
    const headers = ["Name","Generic Name","Category","Pack Size","Manufacturer","Barcode","Batch No","Stock","Reorder Level","Cost Price","Price","Expiry Date"];
    const sample  = ["Panadol 500mg","Paracetamol","Tablet","100S","GSK","6281234567890","BT2024A","200","20","8","12","2027-06-30"];
    const ws = XLSX.utils.aoa_to_sheet([headers,sample]);
    ws["!cols"] = headers.map(()=>({wch:18}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Medicines");
    XLSX.writeFile(wb,"medicine-upload-template.xlsx");
  }

  function handleFileChange(e) {
    const file = e.target.files[0]; if(!file) return;
    setBulkRows([]); setBulkErrors([]); setBulkDone(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb  = XLSX.read(ev.target.result,{type:"array"});
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        if (raw.length<2) { setBulkErrors(["File mein data nahi mila."]); return; }
        const headers  = raw[0];
        const dataRows = raw.slice(1).filter(r=>r.some(c=>c!==""));
        const errors   = [];
        const rows = dataRows.map((row,idx) => {
          const mapped = mapRow(headers,row);
          if (!mapped.name) errors.push(`Row ${idx+2}: Name missing`);
          if (!mapped.price) errors.push(`Row ${idx+2}: Price missing`);
          return { ...mapped, stock:Number(mapped.stock||0), reorderLevel:Number(mapped.reorderLevel||10), price:Number(mapped.price||0), costPrice:Number(mapped.costPrice||0), expiryDate:excelDateToString(mapped.expiryDate) };
        });
        setBulkErrors(errors); setBulkRows(rows);
      } catch(err) { setBulkErrors(["File read nahi ho saki: "+err.message]); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  }

  async function handleBulkUpload() {
    if (bulkRows.length===0) return;
    setBulkUploading(true);
    let success=0, fail=0;
    for (const row of bulkRows) {
      try { await addMedicine(row); success++; }
      catch { fail++; }
    }
    setBulkDone({success,fail}); setBulkUploading(false); setBulkRows([]);
    if (fail===0) setTimeout(()=>setShowBulk(false),1800);
  }

  return (
    <div style={{ padding:isMobile?16:32, maxWidth:1100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:10 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700 }}>Inventory</h1>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Generic name se bhi search ho sakti hai</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{setShowBulk(true);setBulkDone(null);setBulkRows([]);setBulkErrors([]);}}
            style={{ display:"flex", alignItems:"center", gap:6, background:"white", color:"#0e6e5c", fontSize:13, fontWeight:500, padding:"8px 12px", borderRadius:10, border:"1px solid #0e6e5c", cursor:"pointer" }}>
            <Upload size={14}/> {isMobile?"Excel":"Bulk upload"}
          </button>
          <button onClick={openAdd}
            style={{ display:"flex", alignItems:"center", gap:6, background:"#0e6e5c", color:"white", fontSize:13, fontWeight:500, padding:"8px 14px", borderRadius:10, border:"none", cursor:"pointer" }}>
            <Plus size={15}/> {isMobile?"Add":"Add medicine"}
          </button>
        </div>
      </div>

      <div style={{ position:"relative", marginBottom:16 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Brand naam, generic naam (Paracetamol), category, barcode..."
          style={{ width:"100%", paddingLeft:32, paddingRight:12, paddingTop:9, paddingBottom:9, fontSize:13, border:"1px solid #dce6e2", borderRadius:10, background:"white", boxSizing:"border-box", outline:"none" }}/>
      </div>

      {/* Mobile cards */}
      {isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.length===0 && <p style={{ textAlign:"center", color:"#9ca3af", fontSize:13, padding:"40px 0" }}>Koi medicine nahi mili.</p>}
          {filtered.map(m=>{
            const status = expiryStatus(m.expiryDate);
            const low    = (m.stock??0)<=(m.reorderLevel??10);
            return (
              <div key={m.id} style={{ background:"white", border:"1px solid #dce6e2", borderLeft:`3px solid ${STATUS_COLOR[status]}`, borderRadius:12, padding:"14px 14px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
                    <p style={{ fontWeight:600, fontSize:14 }}>{m.name}</p>
                    {m.genericName && <p style={{ fontSize:11, color:"#0e6e5c", fontWeight:500 }}>{m.genericName}</p>}
                    <p style={{ fontSize:11, color:"#9ca3af" }}>{[m.category,m.packSize].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:99, background:status==="safe"?"#dcfce7":status==="warning"?"#fef9c3":"#fee2e2", color:STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                    <button onClick={()=>openEdit(m)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Pencil size={15}/></button>
                    {isAdmin && <button onClick={()=>handleDelete(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Trash2 size={15}/></button>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:10 }}>
                  {[{label:"STOCK",value:m.stock??0,warn:low},{label:"COST",value:`Rs.${m.costPrice||0}`},{label:"SALE",value:`Rs.${m.price}`,teal:true}].map(({label,value,warn,teal})=>(
                    <div key={label} style={{ background:"#f8faf9", border:"1px solid #dce6e2", borderRadius:8, padding:"8px 10px" }}>
                      <p style={{ fontSize:10, color:"#9ca3af", fontFamily:"monospace", margin:"0 0 2px", textTransform:"uppercase" }}>{label}</p>
                      <p style={{ fontSize:14, fontWeight:700, margin:0, color:warn?"#d97706":teal?"#0e6e5c":"#111" }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>
                  <span>Avg: Rs.{Number(m.avgCostPrice??m.costPrice??0).toFixed(2)}</span>
                  <span>Exp: {m.expiryDate||"—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop table */
        <div style={{ background:"white", border:"1px solid #dce6e2", borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #dce6e2" }}>
                {["Medicine / Generic","Batch","Stock","Cost","Avg Cost","Sale","Margin","Expiry","Status",""].map(h=>(
                  <th key={h} style={{ padding:"9px 11px", textAlign:"left", fontSize:11, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m=>{
                const status = expiryStatus(m.expiryDate);
                const low    = (m.stock??0)<=(m.reorderLevel??10);
                const margin = m.price&&m.costPrice ? (((m.price-m.costPrice)/m.price)*100).toFixed(0) : null;
                return (
                  <tr key={m.id} style={{ borderBottom:"1px solid #f0f4f2", borderLeft:`3px solid ${STATUS_COLOR[status]}` }}>
                    <td style={{ padding:"9px 11px" }}>
                      <p style={{ fontWeight:500 }}>{m.name}</p>
                      {m.genericName && <p style={{ fontSize:11, color:"#0e6e5c", fontWeight:500 }}>{m.genericName}</p>}
                      <p style={{ fontSize:11, color:"#9ca3af" }}>{[m.category,m.packSize,m.manufacturer].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td style={{ padding:"9px 11px", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>{m.batchNo||"—"}</td>
                    <td style={{ padding:"9px 11px", fontWeight:low?600:400, color:low?"#d97706":"#111" }}>{m.stock??0}</td>
                    <td style={{ padding:"9px 11px", fontFamily:"monospace", fontSize:12, color:"#6b7280" }}>Rs.{m.costPrice||0}</td>
                    <td style={{ padding:"9px 11px", fontFamily:"monospace", fontSize:12 }}>Rs.{Number(m.avgCostPrice??m.costPrice??0).toFixed(0)}</td>
                    <td style={{ padding:"9px 11px", fontFamily:"monospace" }}>Rs.{m.price}</td>
                    <td style={{ padding:"9px 11px" }}>
                      {margin!==null && (
                        <span style={{ fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:99,
                          background:Number(margin)>=20?"#dcfce7":Number(margin)>=10?"#fef9c3":"#fee2e2",
                          color:Number(margin)>=20?"#16a34a":Number(margin)>=10?"#d97706":"#dc2626" }}>
                          {margin}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding:"9px 11px", fontFamily:"monospace", fontSize:12 }}>{m.expiryDate||"—"}</td>
                    <td style={{ padding:"9px 11px" }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:99, background:status==="safe"?"#dcfce7":status==="warning"?"#fef9c3":"#fee2e2", color:STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                    </td>
                    <td style={{ padding:"9px 11px", textAlign:"right" }}>
                      <button onClick={()=>openEdit(m)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280", marginRight:6 }}><Pencil size={14}/></button>
                      {isAdmin && <button onClick={()=>handleDelete(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280" }}><Trash2 size={14}/></button>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={10} style={{ padding:"40px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Koi medicine nahi mili.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <form onSubmit={handleSave} style={{ background:"white", borderRadius:14, width:"100%", maxWidth:520, padding:24, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>{editingId?"Edit medicine":"Add medicine"}</h2>
              <button type="button" onClick={()=>setShowForm(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={18}/></button>
            </div>
            {error&&<p style={{ fontSize:13, color:"#dc2626", background:"#fee2e2", padding:"8px 12px", borderRadius:8, marginBottom:12 }}>{error}</p>}

            <F label="Brand / Medicine name *"><input className="inp" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></F>
            <F label="Generic name (e.g. Paracetamol, Amoxicillin)">
              <input className="inp" placeholder="Salt / molecule naam" value={form.genericName} onChange={e=>setForm({...form,genericName:e.target.value})}/>
            </F>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
              <F label="Category"><input className="inp" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></F>
              <F label="Pack size"><input className="inp" placeholder="e.g. 100S" value={form.packSize} onChange={e=>setForm({...form,packSize:e.target.value})}/></F>
              <F label="Manufacturer"><input className="inp" value={form.manufacturer} onChange={e=>setForm({...form,manufacturer:e.target.value})}/></F>
              <F label="Barcode"><input className="inp" placeholder="EAN / barcode" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></F>
              <F label="Batch No."><input className="inp" value={form.batchNo} onChange={e=>setForm({...form,batchNo:e.target.value})}/></F>
              <F label="Expiry date"><input type="date" className="inp" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})}/></F>
              <F label="Stock *"><input type="number" className="inp" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></F>
              <F label="Reorder level"><input type="number" className="inp" value={form.reorderLevel} onChange={e=>setForm({...form,reorderLevel:e.target.value})}/></F>
              <F label="Cost price (Rs.)"><input type="number" className="inp" value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})}/></F>
              <F label="Sale price (Rs.) *"><input type="number" className="inp" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></F>
            </div>
            <button type="submit" style={{ marginTop:16, width:"100%", background:"#0e6e5c", color:"white", fontSize:13, fontWeight:600, padding:"11px", borderRadius:10, border:"none", cursor:"pointer" }}>
              {editingId?"Save changes":"Add to inventory"}
            </button>
          </form>
        </div>
      )}

      {/* Bulk modal */}
      {showBulk && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:560, padding:24, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>Bulk upload — Excel</h2>
              <button onClick={()=>setShowBulk(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={18}/></button>
            </div>
            <div style={{ background:"#f0faf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
              <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Step 1 — Template download karein</p>
              <button onClick={downloadTemplate} style={{ display:"flex", alignItems:"center", gap:6, background:"#0e6e5c", color:"white", fontSize:12, fontWeight:500, padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer" }}>
                <Download size={13}/> Template (.xlsx)
              </button>
            </div>
            <div style={{ background:"#f8faf9", border:"2px dashed #dce6e2", borderRadius:10, padding:"20px", textAlign:"center", marginBottom:14, cursor:"pointer" }} onClick={()=>fileRef.current?.click()}>
              <Upload size={22} style={{ color:"#0e6e5c", margin:"0 auto 8px" }}/>
              <p style={{ fontSize:13, fontWeight:500, margin:"0 0 4px" }}>Step 2 — File select karein</p>
              <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>.xlsx ya .xls</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:"none" }}/>
            </div>
            {bulkErrors.length>0 && (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}><AlertCircle size={14} style={{ color:"#dc2626" }}/><p style={{ fontSize:13, fontWeight:600, color:"#dc2626", margin:0 }}>{bulkErrors.length} errors</p></div>
                {bulkErrors.map((e,i)=><p key={i} style={{ fontSize:12, color:"#dc2626", margin:"2px 0" }}>• {e}</p>)}
              </div>
            )}
            {bulkRows.length>0 && (
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:13, fontWeight:600, margin:"0 0 8px", color:"#0e6e5c" }}>✓ {bulkRows.length} medicines ready</p>
                <div style={{ maxHeight:180, overflowY:"auto", border:"1px solid #dce6e2", borderRadius:8 }}>
                  <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                    <thead><tr style={{ background:"#f8faf9" }}>
                      {["Name","Generic","Stock","Price"].map(h=><th key={h} style={{ padding:"6px 10px", textAlign:"left", fontSize:10, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", borderBottom:"1px solid #dce6e2" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{bulkRows.map((r,i)=>(
                      <tr key={i} style={{ borderBottom:"1px solid #f0f4f2" }}>
                        <td style={{ padding:"5px 10px", fontWeight:500 }}>{r.name||"—"}</td>
                        <td style={{ padding:"5px 10px", color:"#0e6e5c", fontSize:11 }}>{r.genericName||"—"}</td>
                        <td style={{ padding:"5px 10px" }}>{r.stock}</td>
                        <td style={{ padding:"5px 10px", fontFamily:"monospace" }}>Rs.{r.price}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {bulkDone && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#f0faf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                <CheckCircle2 size={16} style={{ color:"#16a34a" }}/><p style={{ fontSize:13, fontWeight:500, margin:0, color:"#16a34a" }}>{bulkDone.success} medicines upload ho gayi!{bulkDone.fail>0?` (${bulkDone.fail} fail)`:""}</p>
              </div>
            )}
            {bulkRows.length>0&&!bulkDone&&(
              <button onClick={handleBulkUpload} disabled={bulkUploading||bulkErrors.length>0}
                style={{ width:"100%", background:bulkErrors.length>0?"#9ca3af":"#0e6e5c", color:"white", fontSize:13, fontWeight:600, padding:"11px", borderRadius:10, border:"none", cursor:"pointer" }}>
                {bulkUploading?`Uploading...`:`Upload ${bulkRows.length} medicines`}
              </button>
            )}
          </div>
        </div>
      )}
      <style>{`.inp{width:100%;font-size:13px;padding:8px 10px;border:1px solid #dce6e2;border-radius:8px;background:white;box-sizing:border-box;outline:none}.inp:focus{box-shadow:0 0 0 2px rgba(14,110,92,0.2)}`}</style>
    </div>
  );
}

function F({ label, children }) {
  return (
    <label style={{ display:"block", marginTop:10 }}>
      <span style={{ display:"block", fontSize:10, fontFamily:"monospace", color:"#6b7280", textTransform:"uppercase", marginBottom:4 }}>{label}</span>
      {children}
    </label>
  );
}
