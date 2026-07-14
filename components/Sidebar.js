"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Boxes, ShoppingCart, Receipt, Cross,
  Users, BarChart3, LogOut, Truck, PackagePlus,
  RotateCcw, CreditCard, AlertTriangle, TrendingUp, Clock, Stethoscope,
} from "lucide-react";

const NAV = [
  { href:"/",                   label:"Dashboard",        icon:LayoutDashboard },
  { href:"/billing",            label:"Billing",          icon:ShoppingCart },
  { href:"/practitioner",       label:"Practitioner",     icon:Stethoscope },
  { href:"/inventory",          label:"Inventory",        icon:Boxes },
  { href:"/purchases",          label:"Purchases",        icon:PackagePlus },
  { href:"/suppliers",          label:"Suppliers",        icon:Truck },
  { href:"/sales",              label:"Sales History",    icon:Receipt },
  { href:"/returns",            label:"Returns",          icon:RotateCcw },
  { href:"/credits",            label:"Udhar / Credit",   icon:CreditCard },
  { href:"/expiry-management",  label:"Expiry Alerts",    icon:AlertTriangle },
  { href:"/price-history",      label:"Price History",    icon:Clock },
  { href:"/profit-per-medicine",label:"Profit Analysis",  icon:TrendingUp },
  { href:"/reports",            label:"Reports",          icon:BarChart3,  adminOnly:true },
  { href:"/users",              label:"Staff & Roles",    icon:Users,      adminOnly:true },
];

export default function Sidebar({ profile }) {
  const pathname = usePathname();
  const { logout, isAdmin } = useAuth();

  return (
    <aside style={{ width:220, flexShrink:0, background:"#0a5c4a", color:"white",
      display:"flex", flexDirection:"column", minHeight:"100vh" }}>

      {/* Logo */}
      <div style={{ padding:"18px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)",
        display:"flex", alignItems:"center", gap:10 }}>
        <Cross size={20} color="#6ee7b7"/>
        <div>
          <p style={{ fontWeight:700, fontSize:13, margin:0 }}>Umer Din Medical</p>
          <p style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontFamily:"monospace", margin:0 }}>store POS</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
        {NAV.filter(item => !item.adminOnly || isAdmin).map(({ href, label, icon:Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"8px 12px", borderRadius:8,
              fontSize:13, fontWeight:500, textDecoration:"none", marginBottom:1,
              background: active?"rgba(255,255,255,0.12)":"transparent",
              color: active?"white":"rgba(255,255,255,0.7)",
              transition:"background 0.15s, color 0.15s",
            }}>
              <Icon size={15}/>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.1)",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ fontSize:13, fontWeight:500, margin:0 }}>{profile?.name||"..."}</p>
          <p style={{ fontSize:10, fontFamily:"monospace", color:"rgba(255,255,255,0.45)",
            textTransform:"uppercase", margin:0 }}>{profile?.role||"staff"}</p>
        </div>
        <button onClick={logout} title="Log out"
          style={{ background:"none", border:"none", cursor:"pointer",
            color:"rgba(255,255,255,0.5)", padding:4 }}>
          <LogOut size={16}/>
        </button>
      </div>
    </aside>
  );
}
