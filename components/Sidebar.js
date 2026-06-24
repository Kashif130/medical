"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Boxes, ShoppingCart, Receipt, Cross, Users, BarChart3, LogOut } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "Billing", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/sales", label: "Sales History", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/users", label: "Staff & Roles", icon: Users, adminOnly: true },
];

export default function Sidebar({ profile }) {
  const pathname = usePathname();
  const { logout, isAdmin } = useAuth();

  return (
    <aside className="w-60 shrink-0 bg-clinic-tealDark text-white flex flex-col min-h-screen">
      <div className="px-5 py-6 flex items-center gap-2 border-b border-white/10">
        <Cross size={20} className="text-emerald-300" />
        <div>
          <p className="font-display font-semibold text-sm leading-tight">Umer Din Medical</p>
          <p className="text-[11px] text-emerald-200/70 font-mono">store POS</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-clinic text-sm font-medium transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-emerald-100/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium leading-tight">{profile?.name || "..."}</p>
            <p className="text-[11px] font-mono text-emerald-200/60 uppercase">{profile?.role || "staff"}</p>
          </div>
          <button onClick={logout} className="text-emerald-200/70 hover:text-white" title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
