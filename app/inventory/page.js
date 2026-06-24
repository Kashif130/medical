"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  watchInventory,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  expiryStatus,
} from "@/lib/firebase";
import { Plus, Pencil, Trash2, Search, X, Upload, Download, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";

const STATUS_LABEL = { safe: "OK", warning: "Expiring", expired: "Expired", unknown: "—" };

const emptyForm = {
  name: "",
  category: "",
  batchNo: "",
  stock: "",
  reorderLevel: "10",
  price: "",
  costPrice: "",
  expiryDate: "",
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // Bulk upload state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileRef = useRef();

  useEffect(() => watchInventory(setMedicines), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter(
      (m) =>
        m.name?.toLowerCase().includes(term) ||
        m.category?.toLowerCase().includes(term) ||
        m.batchNo?.toLowerCase().includes(term)
    );
  }, [medicines, search]);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(m) {
    setForm({
      name: m.name || "",
      category: m.category || "",
      batchNo: m.batchNo || "",
      stock: String(m.stock ?? ""),
      reorderLevel: String(m.reorderLevel ?? "10"),
      price: String(m.price ?? ""),
      costPrice: String(m.costPrice ?? ""),
      expiryDate: m.expiryDate || "",
    });
    setEditingId(m.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.price || form.stock === "") {
      setError("Naam, price aur stock zaroori hain.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      batchNo: form.batchNo.trim(),
      stock: Number(form.stock),
      reorderLevel: Number(form.reorderLevel || 10),
      price: Number(form.price),
      costPrice: Number(form.costPrice || 0),
      expiryDate: form.expiryDate,
    };
    try {
      if (editingId) {
        await updateMedicine(editingId, payload);
      } else {
        await addMedicine(payload);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (confirm("Yeh medicine inventory se permanently delete kar dein?")) {
      await deleteMedicine(id);
    }
  }

  // ── Excel template download ──
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "category", "batchNo", "stock", "reorderLevel", "sellingPrice", "costPrice", "expiryDate"],
      ["Panadol 500mg", "Tablet", "BT001", 100, 10, 50, 35, "2026-12-31"],
      ["Amoxil 250mg", "Capsule", "BT002", 200, 20, 120, 90, "2027-06-30"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medicines");
    XLSX.writeFile(wb, "medicines-template.xlsx");
  }

  // ── Excel file parse ──
  function handleFileChange(e) {
    setBulkError("");
    setBulkRows([]);
    setBulkDone(false);
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (raw.length === 0) {
          setBulkError("File khali hai ya format galat hai.");
          return;
        }

        const parsed = raw.map((row, i) => {
          // Normalize column names (case-insensitive)
          const r = {};
          Object.keys(row).forEach((k) => { r[k.toLowerCase().trim()] = row[k]; });

          // expiryDate: Excel date serial or string
          let expiry = r["expirydate"] || r["expiry"] || r["expiry date"] || "";
          if (typeof expiry === "number") {
            const d = XLSX.SSF.parse_date_code(expiry);
            expiry = `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
          } else if (expiry) {
            expiry = String(expiry).trim();
          }

          return {
            _row: i + 2,
            name: String(r["name"] || "").trim(),
            category: String(r["category"] || "").trim(),
            batchNo: String(r["batchno"] || r["batch"] || r["batch no"] || "").trim(),
            stock: Number(r["stock"] || 0),
            reorderLevel: Number(r["reorderlevel"] || r["reorder level"] || r["reorder"] || 10),
            price: Number(r["sellingprice"] || r["selling price"] || r["price"] || 0),
            costPrice: Number(r["costprice"] || r["cost price"] || r["cost"] || 0),
            expiryDate: expiry,
            _valid: !!r["name"] && (Number(r["sellingprice"] || r["selling price"] || r["price"] || 0) > 0),
          };
        });

        setBulkRows(parsed);
      } catch (err) {
        setBulkError("File read nahi ho sake: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleBulkUpload() {
    const valid = bulkRows.filter((r) => r._valid);
    if (valid.length === 0) {
      setBulkError("Koi valid medicine nahi mili. Name aur Selling Price zaroori hain.");
      return;
    }
    setBulkUploading(true);
    setBulkError("");
    try {
      for (const row of valid) {
        const { _row, _valid, ...payload } = row;
        await addMedicine(payload);
      }
      setBulkDone(true);
    } catch (err) {
      setBulkError("Upload mein error: " + err.message);
    }
    setBulkUploading(false);
  }

  function closeBulk() {
    setShowBulk(false);
    setBulkRows([]);
    setBulkError("");
    setBulkDone(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels aur expiry dates manage karein</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 border border-clinic-teal text-clinic-teal text-sm font-medium px-4 py-2.5 rounded-clinic hover:bg-clinic-teal/10 transition-colors"
          >
            <Upload size={16} /> Bulk upload
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-clinic-teal text-white text-sm font-medium px-4 py-2.5 rounded-clinic hover:bg-clinic-tealDark transition-colors"
          >
            <Plus size={16} /> Add medicine
          </button>
        </div>
      </header>

      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, category, batch..."
          className="input pl-9 w-full"
        />
      </div>

      <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="w-2 py-3 pl-3"></th>
              <th className="px-5 py-3">Medicine</th>
              <th className="px-3 py-3">Batch</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Expiry</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinic-line">
            {filtered.map((m) => {
              const status = expiryStatus(m.expiryDate);
              const low = (m.stock ?? 0) <= (m.reorderLevel ?? 10);
              return (
                <tr key={m.id}>
                  <td className="pl-3 py-3 w-2">
                    <div style={{width:'4px', borderRadius:'4px', height:'36px', background: status==='safe'?'#1E8E5A':status==='warning'?'#B6741A':status==='expired'?'#B3261E':'#DCE6E2'}}></div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.category}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{m.batchNo || "-"}</td>
                  <td className="px-3 py-3">
                    <span className={low ? "text-clinic-amber font-semibold" : ""}>{m.stock ?? 0}</span>
                  </td>
                  <td className="px-3 py-3 font-mono">Rs. {m.price}</td>
                  <td className="px-3 py-3 font-mono text-xs">{m.expiryDate || "-"}</td>
                  <td className="px-3 py-3">
                    <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
                  </td>
                  <td className="px-3 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(m)} className="text-gray-500 hover:text-clinic-teal">
                      <Pencil size={15} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(m.id)} className="text-gray-500 hover:text-clinic-red">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Koi medicine nahi mili. "Add medicine" se naya item shamil karein.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Single Add/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-clinic w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold">{editingId ? "Edit medicine" : "Add medicine"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-sm text-clinic-red bg-red-50 px-3 py-2 rounded-clinic">{error}</p>}

            <Field label="Medicine name *">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label="Batch No.">
                <input className="input" value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock (units) *">
                <input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </Field>
              <Field label="Reorder level">
                <input type="number" className="input" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price (Rs.) *">
                <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Cost price (Rs.)">
                <input type="number" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </Field>
            </div>
            <Field label="Expiry date">
              <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>

            <button type="submit" className="w-full bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark">
              {editingId ? "Save changes" : "Add to inventory"}
            </button>
          </form>
        </div>
      )}

      {/* ── Bulk Upload Modal ── */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-clinic w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold">Bulk Upload — Excel</h2>
              <button onClick={closeBulk} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* Step 1 - Template */}
            <div className="bg-gray-50 rounded-clinic p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Step 1: Template download karo</p>
              <p className="text-xs text-gray-500">Is template mein apni medicines fill karo phir upload karo.</p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-clinic-teal border border-clinic-teal px-3 py-2 rounded-clinic hover:bg-clinic-teal/10"
              >
                <Download size={15} /> medicines-template.xlsx download karo
              </button>
            </div>

            {/* Step 2 - Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Step 2: Bhari huwi file upload karo</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-clinic file:border file:border-clinic-teal file:text-sm file:text-clinic-teal file:bg-white hover:file:bg-clinic-teal/10"
              />
            </div>

            {bulkError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-clinic">
                <AlertCircle size={15} /> {bulkError}
              </div>
            )}

            {/* Preview table */}
            {bulkRows.length > 0 && !bulkDone && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Preview — {bulkRows.filter(r => r._valid).length}/{bulkRows.length} valid medicines
                </p>
                <div className="overflow-x-auto border border-clinic-line rounded-clinic">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-clinic-line text-gray-500 uppercase font-mono">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Batch</th>
                        <th className="px-3 py-2 text-left">Stock</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">Expiry</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-clinic-line">
                      {bulkRows.map((row) => (
                        <tr key={row._row} className={row._valid ? "" : "bg-red-50"}>
                          <td className="px-3 py-2 text-gray-400">{row._row}</td>
                          <td className="px-3 py-2 font-medium">{row.name || <span className="text-red-500">Missing!</span>}</td>
                          <td className="px-3 py-2">{row.category || "-"}</td>
                          <td className="px-3 py-2">{row.batchNo || "-"}</td>
                          <td className="px-3 py-2">{row.stock}</td>
                          <td className="px-3 py-2">{row.price > 0 ? `Rs. ${row.price}` : <span className="text-red-500">Missing!</span>}</td>
                          <td className="px-3 py-2">{row.expiryDate || "-"}</td>
                          <td className="px-3 py-2">
                            {row._valid
                              ? <span className="text-green-600 font-medium">✓ OK</span>
                              : <span className="text-red-500">Skip</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading}
                  className="w-full bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark disabled:opacity-60"
                >
                  {bulkUploading
                    ? `Uploading... (${bulkRows.filter(r => r._valid).length} medicines)`
                    : `Upload ${bulkRows.filter(r => r._valid).length} medicines`}
                </button>
              </div>
            )}

            {/* Success */}
            {bulkDone && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle size={40} className="text-green-500" />
                <p className="font-semibold text-gray-800">
                  {bulkRows.filter(r => r._valid).length} medicines successfully add ho gayi!
                </p>
                <button
                  onClick={closeBulk}
                  className="bg-clinic-teal text-white text-sm font-medium px-6 py-2.5 rounded-clinic hover:bg-clinic-tealDark"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid #dce6e2;
          border-radius: 10px;
          background: white;
        }
        .input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(14, 110, 92, 0.25);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-mono text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
      {children}
    </label>
  );
}
