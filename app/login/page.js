"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithEmail } from "@/lib/firebase";
import { Cross } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginWithEmail(email, password);
      router.push("/");
    } catch (err) {
      setError("Email ya password ghalat hai.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-clinic-line rounded-clinic p-7 space-y-5">
        <div className="flex flex-col items-center text-center gap-1.5 mb-2">
          <div className="w-10 h-10 rounded-clinic bg-clinic-tealDark text-white flex items-center justify-center">
            <Cross size={18} />
          </div>
          <h1 className="font-display font-semibold text-base mt-1">Umer Din Medical Store</h1>
          <p className="text-xs text-gray-500 font-mono">staff &amp; partner login</p>
        </div>

        {error && <p className="text-sm text-clinic-red bg-red-50 px-3 py-2 rounded-clinic">{error}</p>}

        <label className="block">
          <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full text-sm px-3 py-2.5 border border-clinic-line rounded-clinic focus:outline-none focus:ring-2 focus:ring-clinic-teal/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-mono text-gray-500 uppercase block mb-1">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-sm px-3 py-2.5 border border-clinic-line rounded-clinic focus:outline-none focus:ring-2 focus:ring-clinic-teal/30"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-clinic-teal text-white text-sm font-medium py-2.5 rounded-clinic hover:bg-clinic-tealDark disabled:opacity-50"
        >
          {busy ? "Logging in..." : "Log in"}
        </button>

        <p className="text-[11px] text-gray-400 text-center">
          Naya account chahiye to admin/partner se Firebase Console mein banwa lein.
        </p>
      </form>
    </div>
  );
}
