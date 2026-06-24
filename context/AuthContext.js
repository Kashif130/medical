"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { watchAuth, ensureUserProfile, logout as firebaseLogout } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchAuth(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);
        } catch (err) {
          console.error("Could not load user profile", err);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const isAdmin = profile?.role === "admin";

  async function logout() {
    await firebaseLogout();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
