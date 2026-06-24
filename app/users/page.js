"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { watchUsers, updateUserProfile } from "@/lib/firebase";
import { ShieldCheck, ShieldOff } from "lucide-react";

export default function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  useEffect(() => watchUsers(setUsers), []);

  async function toggleRole(u) {
    const newRole = u.role === "admin" ? "staff" : "admin";
    if (
      confirm(
        newRole === "admin"
          ? `${u.name} ko partner/admin access dena hai?`
          : `${u.name} ko staff access par downgrade karna hai?`
      )
    ) {
      await updateUserProfile(u.id, { role: newRole });
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-display font-semibold">Staff &amp; Roles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Partner (admin) access se delete &amp; reports control hota hai. Naya account Firebase Console se banayein —
          login karne ke baad woh yahan automatically dikh jayega.
        </p>
      </header>

      <div className="bg-clinic-panel border border-clinic-line rounded-clinic overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinic-line text-left text-xs uppercase text-gray-500 font-mono">
              <th className="px-5 py-3">Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinic-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-3 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                <td className="px-3 py-3">
                  <span className={`badge ${u.role === "admin" ? "badge-safe" : "badge-unknown"}`}>{u.role}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => toggleRole(u)}
                    className="flex items-center gap-1.5 ml-auto text-xs font-medium border border-clinic-line px-3 py-1.5 rounded-clinic hover:border-clinic-teal hover:text-clinic-teal"
                  >
                    {u.role === "admin" ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                    {u.role === "admin" ? "Make staff" : "Make admin"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">
                  Koi staff account nahi mila.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
