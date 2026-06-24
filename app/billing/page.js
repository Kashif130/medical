"use client";

import { useEffect, useMemo, useState } from "react";
import { watchInventory, checkoutSale, expiryStatus } from "@/lib/firebase";
import { Search, Plus, Minus, Trash2, ReceiptText, Printer } from "lucide-react";
import Receipt from "@/components/Receipt";
import { useAuth } from "@/context/AuthContext";

export default function BillingPage() {
  const { profile, user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [error, setError] = useState("");
  const [lastBill, setLastBill] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchInventory(setMedicines), []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return medicines.filter((m) => m.name?.toLowerCase().includes(term)).slice(0, 8);
  }, [medicines, search]);

  function addToCart(med) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === med.id);
      if (existing) {
        return prev.map((i) => (i.id === med.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: med.id, name: med.name, price: med.price, costPrice: med.costPrice || 0, qty: 1, maxStock: med.stock }];
    });
    setSearch("");
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(i.maxStock, i.qty + delta)) } : i))
        .filter(Boolean)
    );
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  async function handleCheckout() {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const saleId = await checkoutSale({
        items: cart.map(({ id, name, price, costPrice, qty }) => ({ id, name, price, costPrice, qty })),
        customerName,
        customerPhone,
        total,
        discount: Number(discount || 0),
        paymentMethod,
        createdBy: { uid: user?.uid || null, name: profile?.name || "Unknown" },
      });
      setLastBill({
        id: saleId,
        date: new Date(),
        items: cart,
        subtotal,
        discount: Number(discount || 0),
        total,
        customerName,
        paymentMethod,
        soldBy: profile?.name || "Unknown",
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <header className="mb-6">
          <h1 className="text-xl font-display font-semibold">Billing</h1>
          <p className="text-sm text-gray-500 mt-1">Medicine search karein aur cart mein add karein</p>
        </header>

        <div className="relative mb-3">
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
                const outOfStock = (m.stock ?? 0) <= 0;
                return (
                  <button
                    key={m.id}
                    disabled={outOfStock}
                    onClick={() => addToCart(m)}
                    className={`strip strip-${status} w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-clinic-bg disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <span className="pl-2 text-sm">{m.name}</span>
                    <span className="text-xs font-mono text-gray-500">
                      Rs. {m.price} · {outOfStock ? "out of stock" : `${m.stock} left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-clinic-panel border border-clinic-line rounded-clinic">
          <div className="px-5 py-3 border-b border-clinic-line">
            <h2 className="font-display font-semibold text-sm">Cart</h2>
          </div>
          <div className="divide-y divide-clinic-line">
            {cart.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Cart khali hai. Upar search se items add karein.</p>
            )}
            {cart.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-gray-500 font-mono">Rs. {item.price} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-clinic-line rounded-clinic">
                    <button onClick={() => changeQty(item.id, -1)} className="px-2 py-1 text-gray-500 hover:text-clinic-teal">
                      <Minus size={13} />
                    </button>
                    <span className="px-2 text-sm font-mono">{item.qty}</span>
                    <button onClick={() => changeQty(item.id, 1)} className="px-2 py-1 text-gray-500 hover:text-clinic-teal">
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-sm font-mono w-20 text-right">Rs. {(item.price * item.qty).toFixed(0)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-clinic-red">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {lastBill && (
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-clinic p-5 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-clinic-teal font-medium mb-2">
                <ReceiptText size={16} /> Bill complete — Rs. {lastBill.total.toFixed(0)} ({lastBill.paymentMethod})
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-medium border border-clinic-teal text-clinic-teal px-3 py-1.5 rounded-clinic hover:bg-clinic-teal hover:text-white transition-colors"
              >
                <Printer size={13} /> Print receipt
              </button>
            </div>
            <p className="text-gray-600 text-xs">
              {lastBill.items.length} item(s) sold to {lastBill.customerName || "Walk-in"}. Stock auto-update ho gaya hai.
            </p>
          </div>
        )}

        <Receipt bill={lastBill} />
      </div>

      <div>
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic p-5 sticky top-6 space-y-4">
          <h2 className="font-display font-semibold text-sm">Checkout</h2>

          <label className="block">
            <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Customer name</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="checkout-input" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Phone (optional)</span>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="checkout-input" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Discount (Rs.)</span>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="checkout-input" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Payment method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="checkout-input">
              <option>Cash</option>
              <option>Card</option>
              <option>Mobile wallet</option>
            </select>
          </label>

          <div className="border-t border-clinic-line pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-mono">Rs. {subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Discount</span>
              <span className="font-mono">- Rs. {Number(discount || 0).toFixed(0)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1">
              <span>Total</span>
              <span className="font-mono">Rs. {total.toFixed(0)}</span>
            </div>
          </div>

          {error && <p className="text-xs text-clinic-red bg-red-50 px-3 py-2 rounded-clinic">{error}</p>}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || busy}
            className="w-full bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark disabled:opacity-40"
          >
            {busy ? "Processing..." : "Complete sale"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .checkout-input {
          width: 100%;
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid #dce6e2;
          border-radius: 10px;
          background: white;
        }
        .checkout-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(14, 110, 92, 0.25);
        }
      `}</style>
    </div>
  );
}
