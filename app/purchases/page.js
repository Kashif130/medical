"use client";

import { useEffect, useMemo, useState } from "react";
import {
  watchInventory,
  watchSuppliers,
  watchPurchases,
  createPurchase,
  expiryStatus,
} from "@/lib/firebase";
import { Search, Plus, Trash2, PackagePlus, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const emptyHeader = {
  supplierName: "",
  supplierId: null,
  invoiceNo: "",
  orderCode: "",
  supplyDate: "",
  remarks: "",
  misc: "",
};

export default function PurchasesPage() {
  const { profile, user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [header, setHeader] = useState(emptyHeader);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => watchInventory(setMedicines), []);
  useEffect(() => watchSuppliers(setSuppliers), []);
  useEffect(() => watchPurchases(setPurchases), []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return medicines.filter((m) => m.name?.toLowerCase().includes(term)).slice(0, 8);
  }, [medicines, search]);

  function addItem(med) {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === med.id);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: med.id,
          name: med.name,
          qty: 1,
          costPrice: med.costPrice || 0,
          salePrice: med.price || 0,
          avgCostPrice: med.avgCostPrice || med.costPrice || 0,
          currentStock: med.stock || 0,
        },
      ];
    });
    setSearch("");
  }

  function updateItem(id, field, val) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: Number(val) || 0 } : i))
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function selectSupplier(e) {
    const id = e.target.value;
    if (!id) {
      setHeader((h) => ({ ...h, supplierId: null, supplierName: "" }));
      return;
    }
    const sup = suppliers.find((s) => s.id === id);
    setHeader((h) => ({ ...h, supplierId: id, supplierName: sup?.name || "" }));
  }

  const itemsTotal = items.reduce((s, i) => s + i.costPrice * i.qty, 0);
  const grandTotal = itemsTotal + Number(header.misc || 0);

  async function handleSubmit() {
    if (items.length === 0) {
      setError("Kam az kam ek item add karein.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await createPurchase({
        ...header,
        items: items.map(({ id, name, qty, costPrice, salePrice }) => ({
          id, name, qty, costPrice, salePrice,
        })),
        misc: Number(header.misc || 0),
        createdBy: { uid: user?.uid || null, name: profile?.name || "Unknown" },
      });
      setHeader(emptyHeader);
      setItems([]);
      setSuccess("Purchase entry save ho gayi. Stock update ho gaya hai.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: form */}
      <div className="lg:col-span-2 space-y-5">
        <header>
          <h1 className="text-xl font-display font-semibold">Purchase Entry</h1>
          <p className="text-sm text-gray-500 mt-1">Supplier se maal aaya — stock in karein</p>
        </header>

        {/* Purchase header */}
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic p-5 space-y-4">
          <h2 className="font-display font-semibold text-sm">Purchase Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <select
                className="input"
                value={header.supplierId || ""}
                onChange={selectSupplier}
              >
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Invoice No.">
              <input
                className="input"
                value={header.invoiceNo}
                onChange={(e) => setHeader({ ...header, invoiceNo: e.target.value })}
              />
            </Field>
            <Field label="Supply Date">
              <input
                type="date"
                className="input"
                value={header.supplyDate}
                onChange={(e) => setHeader({ ...header, supplyDate: e.target.value })}
              />
            </Field>
            <Field label="Order Code">
              <input
                className="input"
                value={header.orderCode}
                onChange={(e) => setHeader({ ...header, orderCode: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Remarks">
            <input
              className="input"
              value={header.remarks}
              onChange={(e) => setHeader({ ...header, remarks: e.target.value })}
            />
          </Field>
        </div>

        {/* Item search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Medicine ka naam type karein..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-clinic-line rounded-clinic bg-white focus:outline-none focus:ring-2 focus:ring-clinic-teal/30"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-clinic-line rounded-clinic shadow-sm overflow-hidden">
              {results.map((m) => {
                const status = expiryStatus(m.expiryDate);
                return (
                  <button
                    key={m.id}
                    onClick={() => addItem(m)}
                    className={`strip strip-${status} w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-clinic-bg`}
                  >
                    <span className="pl-2 text-sm">{m.name}</span>
                    <span className="text-xs font-mono text-gray-500">
                      Stock: {m.stock} · Cost: Rs.{m.costPrice}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
                <th className="px-4 py-2.5">Medicine</th>
                <th className="px-2 py-2.5 w-20">Qty</th>
                <th className="px-2 py-2.5 w-28">Cost Price</th>
                <th className="px-2 py-2.5 w-28">Sale Price</th>
                <th className="px-2 py-2.5 w-24 text-right">Amount</th>
                <th className="px-2 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinic-line">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Upar search se medicine add karein
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      Avg cost: Rs.{item.avgCostPrice} · Stock: {item.currentStock}
                    </p>
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                      className="input w-full"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={item.costPrice}
                      onChange={(e) => updateItem(item.id, "costPrice", e.target.value)}
                      className="input w-full"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={item.salePrice}
                      onChange={(e) => updateItem(item.id, "salePrice", e.target.value)}
                      className="input w-full"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-sm">
                    Rs. {(item.costPrice * item.qty).toFixed(0)}
                  </td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-clinic-red">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(error || success) && (
          <p className={`text-sm px-3 py-2 rounded-clinic ${error ? "text-clinic-red bg-red-50" : "text-clinic-teal bg-emerald-50"}`}>
            {error || success}
          </p>
        )}
      </div>

      {/* Right: summary */}
      <div>
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic p-5 sticky top-6 space-y-4">
          <h2 className="font-display font-semibold text-sm">Purchase Summary</h2>

          <Field label="Misc charges (Rs.)">
            <input
              type="number"
              min="0"
              className="input"
              value={header.misc}
              onChange={(e) => setHeader({ ...header, misc: e.target.value })}
              placeholder="0"
            />
          </Field>

          <div className="border-t border-clinic-line pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Items total</span>
              <span className="font-mono">Rs. {itemsTotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Misc (+)</span>
              <span className="font-mono">Rs. {Number(header.misc || 0).toFixed(0)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1">
              <span>Grand Total</span>
              <span className="font-mono">Rs. {grandTotal.toFixed(0)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {items.length} item(s) · Stock in hoga aur avg cost update ho ga
          </p>

          <button
            onClick={handleSubmit}
            disabled={items.length === 0 || busy}
            className="w-full flex items-center justify-center gap-2 bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark disabled:opacity-40"
          >
            <PackagePlus size={16} />
            {busy ? "Saving..." : "Save purchase"}
          </button>
        </div>
      </div>

      {/* Purchase history */}
      <div className="lg:col-span-3">
        <h2 className="font-display font-semibold mb-3">Purchase History</h2>
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
                <th className="px-5 py-3">Date</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">Invoice #</th>
                <th className="px-3 py-3">Items</th>
                <th className="px-3 py-3 text-right">Grand Total</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinic-line">
              {purchases.slice(0, 30).map((p) => (
                <>
                  <tr key={p.id} className="hover:bg-clinic-bg">
                    <td className="px-5 py-3 font-mono text-xs">
                      {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("en-PK") : "—"}
                    </td>
                    <td className="px-3 py-3">{p.supplierName || "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{p.invoiceNo || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{p.items?.length || 0} items</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">
                      Rs. {(p.grandTotal || 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="text-gray-400 hover:text-clinic-teal"
                      >
                        {expandedId === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={6} className="px-5 pb-3 pt-0 bg-clinic-bg">
                        <table className="w-full text-xs mt-2">
                          <thead>
                            <tr className="text-gray-500 font-mono uppercase">
                              <th className="text-left py-1">Medicine</th>
                              <th className="text-left py-1">Qty</th>
                              <th className="text-left py-1">Cost</th>
                              <th className="text-left py-1">Sale Price</th>
                              <th className="text-right py-1">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(p.items || []).map((i, idx) => (
                              <tr key={idx} className="border-t border-clinic-line/50">
                                <td className="py-1">{i.name}</td>
                                <td className="py-1">{i.qty}</td>
                                <td className="py-1 font-mono">Rs. {i.costPrice}</td>
                                <td className="py-1 font-mono">Rs. {i.salePrice}</td>
                                <td className="py-1 font-mono text-right">Rs. {(i.costPrice * i.qty).toFixed(0)}</td>
                              </tr>
                            ))}
                            {p.misc > 0 && (
                              <tr className="border-t border-clinic-line text-gray-500">
                                <td colSpan={4} className="py-1">Misc charges</td>
                                <td className="py-1 font-mono text-right">Rs. {p.misc}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {p.remarks && <p className="text-gray-400 mt-2">Remarks: {p.remarks}</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                    Koi purchase entry nahi. Upar se stock in karein.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
