"use client";

import { useEffect, useState } from "react";
import { watchSuppliers, addSupplier, updateSupplier, deleteSupplier } from "@/lib/firebase";
import { Plus, Pencil, Trash2, X, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  ntn: "",
  remarks: "",
};

export default function SuppliersPage() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => watchSuppliers(setSuppliers), []);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(s) {
    setForm({
      name: s.name || "",
      phone: s.phone || "",
      address: s.address || "",
      ntn: s.ntn || "",
      remarks: s.remarks || "",
    });
    setEditingId(s.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Supplier ka naam zaroori hai.");
      return;
    }
    try {
      if (editingId) {
        await updateSupplier(editingId, { ...form, name: form.name.trim() });
      } else {
        await addSupplier({ ...form, name: form.name.trim() });
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (confirm("Is supplier ko delete karein?")) {
      await deleteSupplier(id);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Medicine suppliers aur distributors manage karein</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-clinic-teal text-white text-sm font-medium px-4 py-2.5 rounded-clinic hover:bg-clinic-tealDark transition-colors"
        >
          <Plus size={16} /> Add supplier
        </button>
      </header>

      <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="px-5 py-3">Supplier</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">NTN</th>
              <th className="px-3 py-3">Address</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinic-line">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Truck size={15} className="text-clinic-teal shrink-0" />
                    <span className="font-medium">{s.name}</span>
                  </div>
                  {s.remarks && <p className="text-xs text-gray-400 pl-6 mt-0.5">{s.remarks}</p>}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{s.phone || "—"}</td>
                <td className="px-3 py-3 font-mono text-xs">{s.ntn || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500">{s.address || "—"}</td>
                <td className="px-3 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(s)} className="text-gray-500 hover:text-clinic-teal">
                    <Pencil size={15} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(s.id)} className="text-gray-500 hover:text-clinic-red">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Koi supplier nahi. "Add supplier" se shamil karein.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-clinic w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold">{editingId ? "Edit supplier" : "Add supplier"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-sm text-clinic-red bg-red-50 px-3 py-2 rounded-clinic">{error}</p>}

            <Field label="Supplier name *">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="NTN / Tax ID">
                <input className="input" value={form.ntn} onChange={(e) => setForm({ ...form, ntn: e.target.value })} />
              </Field>
            </div>
            <Field label="Address">
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Remarks">
              <input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>

            <button type="submit" className="w-full bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark">
              {editingId ? "Save changes" : "Add supplier"}
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
