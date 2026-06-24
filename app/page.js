"use client";

import { useEffect, useMemo, useState } from "react";
import { watchInventory, watchSales, expiryStatus } from "@/lib/firebase";
import { AlertTriangle, PackageX, TrendingUp, Pill } from "lucide-react";

function StatCard({ label, value, icon: Icon, tone = "teal" }) {
  const tones = {
    teal: "text-clinic-teal bg-emerald-50",
    amber: "text-clinic-amber bg-amber-50",
    red: "text-clinic-red bg-red-50",
  };
  return (
    <div className="bg-clinic-panel border border-clinic-line rounded-clinic p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-display font-semibold mt-1">{value}</p>
      </div>
      <div className={`p-2 rounded-clinic ${tones[tone]}`}>
        <Icon size={18} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [medicines, setMedicines] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const u1 = watchInventory(setMedicines);
    const u2 = watchSales(setSales);
    return () => {
      u1();
      u2();
    };
  }, []);

  const stats = useMemo(() => {
    const lowStock = medicines.filter((m) => (m.stock ?? 0) <= (m.reorderLevel ?? 10));
    const expiringSoon = medicines.filter((m) => expiryStatus(m.expiryDate) === "warning");
    const expired = medicines.filter((m) => expiryStatus(m.expiryDate) === "expired");
    const today = new Date().toDateString();
    const todaysSales = sales.filter(
      (s) => s.createdAt?.toDate && s.createdAt.toDate().toDateString() === today
    );
    const todaysRevenue = todaysSales.reduce((sum, s) => sum + (s.total || 0), 0);
    return { lowStock, expiringSoon, expired, todaysRevenue, todaysCount: todaysSales.length };
  }, [medicines, sales]);

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-7">
        <h1 className="text-xl font-display font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Aaj ka overview — stock, sales aur expiry alerts ek nazar mein</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Sales" value={`Rs. ${stats.todaysRevenue.toFixed(0)}`} icon={TrendingUp} tone="teal" />
        <StatCard label="Bills Today" value={stats.todaysCount} icon={Pill} tone="teal" />
        <StatCard label="Low Stock Items" value={stats.lowStock.length} icon={PackageX} tone="amber" />
        <StatCard label="Expired Items" value={stats.expired.length} icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-clinic-panel border border-clinic-line rounded-clinic">
          <div className="px-5 py-4 border-b border-clinic-line">
            <h2 className="font-display font-semibold text-sm">Expiring within 60 days</h2>
          </div>
          <div className="divide-y divide-clinic-line max-h-80 overflow-y-auto">
            {stats.expiringSoon.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400">Koi item expiry ke qareeb nahi hai.</p>
            )}
            {stats.expiringSoon.map((m) => (
              <div key={m.id} className="strip strip-warning px-5 py-3 pl-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500 font-mono">Batch {m.batchNo || "-"}</p>
                </div>
                <span className="badge badge-warning font-mono">{m.expiryDate}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-clinic-panel border border-clinic-line rounded-clinic">
          <div className="px-5 py-4 border-b border-clinic-line">
            <h2 className="font-display font-semibold text-sm">Low stock</h2>
          </div>
          <div className="divide-y divide-clinic-line max-h-80 overflow-y-auto">
            {stats.lowStock.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400">Stock levels theek hain.</p>
            )}
            {stats.lowStock.map((m) => (
              <div key={m.id} className="strip strip-warning px-5 py-3 pl-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500 font-mono">Reorder level {m.reorderLevel ?? 10}</p>
                </div>
                <span className="badge badge-warning font-mono">{m.stock ?? 0} left</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
