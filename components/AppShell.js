"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
    if (!loading && user && isLoginPage) {
      router.push("/");
    }
  }, [loading, user, isLoginPage, router]);

  if (isLoginPage) {
    return children;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400 font-mono">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar profile={profile} />
      <main className="flex-1 min-h-screen">{children}</main>
    </div>
  );
}
