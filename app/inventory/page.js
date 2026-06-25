"use client";

import { useEffect, useMemo, useState } from "react";
import {
  watchInventory,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  expiryStatus,
} from "@/lib/firebase";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABEL = { safe: "OK", warning: "Expiring", expired: "Expired", unknown: "—" };
const STATUS_COLOR = { safe: "#16a34a", warning: "#d97706", expired: "#dc2626", unknown: "#9ca3af" };

const emptyForm = {
  name: "", category: "", batchNo: "", stock: "",
  reorderLevel: "10", price: "", costPrice: "",
  expiryDate: "", packSize: "", manufacturer: "",
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => watchInventory(setMedicines), []);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 900); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter(
      (m) =>
        m.name?.toLowerCase().includes(term) ||
        m.category?.toLowerCase().includes(term) ||
        m.batchNo?.toLowerCase().includes(term) ||
        m.manufacturer?.toLowerCase().includes(term) ||
        m.packSize?.toLowerCase().includes(term)
    );
  }, [medicines, search]);

  function openAdd() { setForm(emptyForm); setEditingId(null); setError(""); setShowForm(true); }

  function openEdit(m) {
    setForm({
      name: m.name || "", category: m.category || "", batchNo: m.batchNo || "",
      stock: String(m.stock ?? ""), reorderLevel: String(m.reorderLevel ?? "10"),
      price: String(m.price ?? ""), costPrice: String(m.costPrice ?? ""),
      expiryDate: m.expiryDate || "", packSize: m.packSize || "", manufacturer: m.manufacturer || "",
    });
    setEditingId(m.id); setError(""); setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.price || form.stock === "") { setError("Naam, price aur stock zaroori hain."); return; }
    const payload = {
      name: form.name.trim(), category: form.category.trim(), batchNo: form.batchNo.trim(),
      stock: Number(form.stock), reorderLevel: Number(form.reorderLevel || 10),
      price: Number(form.price), costPrice: Number(form.costPrice || 0),
      expiryDate: form.expiryDate, packSize: form.packSize.trim(), manufacturer: form.manufacturer.trim(),
    };
    try {
      if (editingId) { await updateMedicine(editingId, payload); }
      else { await addMedicine(payload); }
      setShowForm(false);
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (confirm("Yeh medicine inventory se permanently delete kar dein?")) await deleteMedicine(id);
  }

  return (
    <div style={{ padding: isMobile ? "16px" : "32px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Inventory</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Stock levels aur expiry dates manage karein</p>
        </div>
        <button onClick={openAdd} style={{
          display: "flex", alignItems: "center", gap: 6, background: "#0e6e5c",
          color: "white", fontSize: 13, fontWeight: 500, padding: "8px 14px",
          borderRadius: 10, border: "none", cursor: "pointer"
        }}>
          <Plus size={15} /> {isMobile ? "Add" : "Add medicine"}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, category, batch..."
          style={{
            width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            fontSize: 13, border: "1px solid #dce6e2", borderRadius: 10, background: "white",
            boxSizing: "border-box", outline: "none"
          }}
        />
      </div>

      {/* MOBILE: Cards */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "40px 0" }}>
              Koi medicine nahi mili.
            </p>
          )}
          {filtered.map((m) => {
            const status = expiryStatus(m.expiryDate);
            const low = (m.stock ?? 0) <= (m.reorderLevel ?? 10);
            const avg = (m.avgCostPrice ?? m.costPrice ?? 0);
            return (
              <div key={m.id} style={{
                background: "white", border: "1px solid #dce6e2",
                borderLeft: `3px solid ${STATUS_COLOR[status]}`,
                borderRadius: 12, padding: "14px 14px 12px"
              }}>
                {/* Name row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{m.name}</p>
                    {(m.category || m.packSize) && (
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                        {[m.category, m.packSize].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {m.batchNo && (
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0", fontFamily: "monospace" }}>
                        Batch: {m.batchNo}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                      background: status === "safe" ? "#dcfce7" : status === "warning" ? "#fef9c3" : "#fee2e2",
                      color: STATUS_COLOR[status]
                    }}>{STATUS_LABEL[status]}</span>
                    <button onClick={() => openEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}>
                      <Pencil size={15} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                  {[
                    { label: "STOCK", value: m.stock ?? 0, warn: low },
                    { label: "COST", value: `Rs.${m.costPrice || 0}` },
                    { label: "SALE", value: `Rs.${m.price}`, teal: true },
                  ].map(({ label, value, warn, teal }) => (
                    <div key={label} style={{
                      background: "#f8faf9", border: "1px solid #dce6e2",
                      borderRadius: 8, padding: "8px 10px"
                    }}>
                      <p style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", margin: "0 0 2px", textTransform: "uppercase" }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: warn ? "#d97706" : teal ? "#0e6e5c" : "#111827" }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
                  <span>Avg: Rs.{Number(avg).toFixed(2)}</span>
                  <span>Exp: {m.expiryDate || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP: Table */
        <div style={{ background: "white", border: "1px solid #dce6e2", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #dce6e2" }}>
                {["Medicine","Batch","Stock","Cost","Avg Cost","Sale Price","Expiry","Status","Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Actions" ? "right" : "left", fontSize: 11, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const status = expiryStatus(m.expiryDate);
                const low = (m.stock ?? 0) <= (m.reorderLevel ?? 10);
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f0f4f2", borderLeft: `3px solid ${STATUS_COLOR[status]}` }}>
                    <td style={{ padding: "10px 12px" }}>
                      <p style={{ fontWeight: 500, margin: 0 }}>{m.name}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                        {[m.category, m.packSize, m.manufacturer].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{m.batchNo || "—"}</td>
                    <td style={{ padding: "10px 12px", fontWeight: low ? 600 : 400, color: low ? "#d97706" : "#111" }}>{m.stock ?? 0}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>Rs.{m.costPrice || 0}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>Rs.{Number(m.avgCostPrice ?? m.costPrice ?? 0).toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>Rs.{m.price}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{m.expiryDate || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                        background: status === "safe" ? "#dcfce7" : status === "warning" ? "#fef9c3" : "#fee2e2",
                        color: STATUS_COLOR[status]
                      }}>{STATUS_LABEL[status]}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button onClick={() => openEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", marginRight: 8 }}><Pencil size={14} /></button>
                      {isAdmin && <button onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Koi medicine nahi mili.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <form onSubmit={handleSave} style={{
            background: "white", borderRadius: 14, width: "100%", maxWidth: 480,
            padding: 24, maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{editingId ? "Edit medicine" : "Add medicine"}</h2>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={18} /></button>
            </div>
            {error && <p style={{ fontSize: 13, color: "#dc2626", background: "#fee2e2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</p>}

            <Field label="Medicine name *"><input className="inp" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <Field label="Category"><input className="inp" value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></Field>
              <Field label="Pack size"><input className="inp" placeholder="e.g. 1000S" value={form.packSize} onChange={e => setForm({...form, packSize: e.target.value})} /></Field>
              <Field label="Manufacturer"><input className="inp" value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} /></Field>
              <Field label="Batch No."><input className="inp" value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value})} /></Field>
              <Field label="Stock *"><input type="number" className="inp" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} /></Field>
              <Field label="Reorder level"><input type="number" className="inp" value={form.reorderLevel} onChange={e => setForm({...form, reorderLevel: e.target.value})} /></Field>
              <Field label="Cost price (Rs.)"><input type="number" className="inp" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} /></Field>
              <Field label="Sale price (Rs.) *"><input type="number" className="inp" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></Field>
            </div>
            <div style={{ marginTop: 10 }}>
              <Field label="Expiry date"><input type="date" className="inp" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} /></Field>
            </div>
            <button type="submit" style={{
              marginTop: 16, width: "100%", background: "#0e6e5c", color: "white",
              fontSize: 13, fontWeight: 500, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer"
            }}>{editingId ? "Save changes" : "Add to inventory"}</button>
          </form>
        </div>
      )}

      <style>{`.inp { width:100%; font-size:13px; padding:8px 10px; border:1px solid #dce6e2; border-radius:8px; background:white; box-sizing:border-box; outline:none; } .inp:focus { box-shadow: 0 0 0 2px rgba(14,110,92,0.2); }`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginTop: 4 }}>
      <span style={{ display: "block", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
