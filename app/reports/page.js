"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { watchSales } from "@/lib/firebase";

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

export default function ReportsPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [sales, setSales] = useState([]);
  const [range, setRange] = useState("30"); // days

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  useEffect(() => watchSales(setSales), []);

  const computed = useMemo(() => {
    const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    const filtered = sales.filter((s) => s.createdAt?.toDate && s.createdAt.toDate().getTime() >= cutoff);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;
    const byDay = {};

    filtered.forEach((s) => {
      const d = s.createdAt.toDate();
      const key = dayKey(d);
      const revenue = s.total || 0;
      const cost = (s.items || []).reduce((sum, i) => sum + (i.costPrice || 0) * i.qty, 0);
      totalRevenue += revenue;
      totalCost += cost;
      totalDiscount += s.discount || 0;
      if (!byDay[key]) byDay[key] = { revenue: 0, cost: 0, bills: 0 };
      byDay[key].revenue += revenue;
      byDay[key].cost += cost;
      byDay[key].bills += 1;
    });

    const rows = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, v]) => ({ date, ...v, profit: v.revenue - v.cost }));

    return {
      totalRevenue,
      totalCost,
      totalDiscount,
      totalProfit: totalRevenue - totalCost,
      billCount: filtered.length,
      rows,
    };
  }, [sales, range]);

  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Partners ke liye revenue, cost aur profit ka breakdown</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="text-sm border border-clinic-line rounded-clinic px-3 py-2 bg-white"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Revenue" value={`Rs. ${computed.totalRevenue.toFixed(0)}`} />
        <Stat label="Cost (COGS)" value={`Rs. ${computed.totalCost.toFixed(0)}`} />
        <Stat label="Net Profit" value={`Rs. ${computed.totalProfit.toFixed(0)}`} tone="profit" />
        <Stat label="Bills" value={computed.billCount} />
      </div>

      <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="px-5 py-3">Date</th>
              <th className="px-3 py-3">Bills</th>
              <th className="px-3 py-3">Revenue</th>
              <th className="px-3 py-3">Cost</th>
              <th className="px-3 py-3 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinic-line">
            {computed.rows.map((r) => (
              <tr key={r.date}>
                <td className="px-5 py-3 font-mono text-xs">{r.date}</td>
                <td className="px-3 py-3">{r.bills}</td>
                <td className="px-3 py-3 font-mono">Rs. {r.revenue.toFixed(0)}</td>
                <td className="px-3 py-3 font-mono text-gray-500">Rs. {r.cost.toFixed(0)}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-clinic-teal">
                  Rs. {r.profit.toFixed(0)}
                </td>
              </tr>
            ))}
            {computed.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Is range mein koi sale nahi hui.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Note: profit calculation har medicine ke "Cost price" field par depend karta hai. Inventory mein cost price
        zaroor bharein taake yeh numbers sahi aayein.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-clinic-panel border border-clinic-line rounded-clinic p-5">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-display font-semibold mt-1 ${tone === "profit" ? "text-clinic-teal" : ""}`}>
        {value}
      </p>
    </div>
  );
}
