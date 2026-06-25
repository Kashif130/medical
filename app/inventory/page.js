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

const emptyForm = {
  name: "",
  category: "",
  batchNo: "",
  stock: "",
  reorderLevel: "10",
  price: "",
  costPrice: "",
  expiryDate: "",
  packSize: "",
  manufacturer: "",
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => watchInventory(setMedicines), []);

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
      packSize: m.packSize || "",
      manufacturer: m.manufacturer || "",
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
      packSize: form.packSize.trim(),
      manufacturer: form.manufacturer.trim(),
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

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels aur expiry dates manage karein</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-clinic-teal text-white text-sm font-medium px-3 py-2 md:px-4 md:py-2.5 rounded-clinic hover:bg-clinic-tealDark transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Add medicine</span><span className="sm:hidden">Add</span>
        </button>
      </header>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, category, batch..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-clinic-line rounded-clinic bg-white focus:outline-none focus:ring-2 focus:ring-clinic-teal/30"
        />
      </div>

      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="px-5 py-3">Medicine</th>
              <th className="px-3 py-3">Batch</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Cost</th>
              <th className="px-3 py-3">Avg Cost</th>
              <th className="px-3 py-3">Sale Price</th>
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
                <tr key={m.id} className={`strip strip-${status}`}>
                  <td className="px-5 py-3 pl-6">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-gray-400">
                      {[m.category, m.packSize, m.manufacturer].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{m.batchNo || "—"}</td>
                  <td className="px-3 py-3">
                    <span className={low ? "text-clinic-amber font-semibold" : ""}>{m.stock ?? 0}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">Rs. {m.costPrice || 0}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    Rs. {(m.avgCostPrice ?? m.costPrice ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 font-mono">Rs. {m.price}</td>
                  <td className="px-3 py-3 font-mono text-xs">{m.expiryDate || "—"}</td>
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
                <td colSpan={9} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Koi medicine nahi mili. "Add medicine" se naya item shamil karein.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — shown only on mobile */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">
            Koi medicine nahi mili. "Add" se naya item shamil karein.
          </p>
        )}
        {filtered.map((m) => {
          const status = expiryStatus(m.expiryDate);
          const low = (m.stock ?? 0) <= (m.reorderLevel ?? 10);
          return (
            <div
              key={m.id}
              className={`bg-clinic-panel border border-clinic-line rounded-clinic p-4 strip strip-${status}`}
            >
              {/* Top row: name + actions */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-sm">{m.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[m.category, m.packSize, m.manufacturer].filter(Boolean).join(" · ")}
                  </p>
                  {m.batchNo && (
                    <p className="text-xs font-mono text-gray-400 mt-0.5">Batch: {m.batchNo}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge badge-${status} text-xs`}>{STATUS_LABEL[status]}</span>
                  <button onClick={() => openEdit(m)} className="text-gray-500 hover:text-clinic-teal p-1">
                    <Pencil size={15} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(m.id)} className="text-gray-500 hover:text-clinic-red p-1">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2 border border-clinic-line">
                  <p className="text-gray-400 uppercase font-mono mb-0.5">Stock</p>
                  <p className={`font-bold text-sm ${low ? "text-clinic-amber" : "text-gray-800"}`}>
                    {m.stock ?? 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-clinic-line">
                  <p className="text-gray-400 uppercase font-mono mb-0.5">Cost</p>
                  <p className="font-semibold text-gray-800">Rs.{m.costPrice || 0}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-clinic-line">
                  <p className="text-gray-400 uppercase font-mono mb-0.5">Sale</p>
                  <p className="font-semibold text-clinic-teal">Rs.{m.price}</p>
                </div>
              </div>

              {/* Avg cost + expiry row */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 font-mono">
                <span>Avg: Rs.{(m.avgCostPrice ?? m.costPrice ?? 0).toFixed(2)}</span>
                <span>Exp: {m.expiryDate || "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-clinic w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
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
              <Field label="Pack size (e.g. 1000S)">
                <input className="input" placeholder="e.g. 1000S" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Manufacturer">
                <input className="input" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
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
              <Field label="Cost price (Rs.)">
                <input type="number" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </Field>
              <Field label="Selling price (Rs.) *">
                <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
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
