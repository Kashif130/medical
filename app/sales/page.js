"use client";

import { useEffect, useMemo, useState } from "react";
import { watchSales } from "@/lib/firebase";

export default function SalesPage() {
  const [sales, setSales] = useState([]);

  useEffect(() => watchSales(setSales), []);

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + (s.total || 0), 0), [sales]);

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Sales history</h1>
          <p className="text-sm text-gray-500 mt-1">Har bill ka record, naye se purane order mein</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-gray-500 uppercase">Total revenue</p>
          <p className="text-xl font-display font-semibold">Rs. {totalRevenue.toFixed(0)}</p>
        </div>
      </header>

      <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="px-5 py-3">Date</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Items</th>
              <th className="px-3 py-3">Sold by</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinic-line">
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3 font-mono text-xs text-gray-600">
                  {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : "—"}
                </td>
                <td className="px-3 py-3">{s.customerName || "Walk-in"}</td>
                <td className="px-3 py-3 text-gray-600 text-xs">
                  {s.items?.map((i) => `${i.name} x${i.qty}`).join(", ")}
                </td>
                <td className="px-3 py-3 text-xs font-medium">{s.createdBy?.name || "—"}</td>
                <td className="px-3 py-3 text-xs">{s.paymentMethod}</td>
                <td className="px-3 py-3 text-right font-mono">Rs. {(s.total || 0).toFixed(0)}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Abhi tak koi sale record nahi hai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
