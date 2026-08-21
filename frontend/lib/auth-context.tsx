"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { AuthUser } from "@/types";

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextValue {
  idToken: string | null;
  user: AuthUser | null;
  login: (idToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "reachinbox_id_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) login(stored);
  }, []);

  function login(token: string) {
    try {
      const payload = jwtDecode<GoogleJwtPayload>(token);
      // Basic expiry guard — full verification happens server-side on every request.
      setIdToken(token);
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.picture ?? null,
      });
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      logout();
    }
  }

  function logout() {
    setIdToken(null);
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ idToken, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
