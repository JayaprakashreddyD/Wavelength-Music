"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "@/lib/api";
import { User } from "@/lib/types";
import { publicConfig } from "@/lib/publicConfig";
import { disconnectSocket } from "@/lib/socket";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  requestEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: User }>("/auth/me");
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // On first load there's no in-memory access token yet, but a refresh
      // cookie may still be valid — try silently before giving up.
      try {
        const res = await fetch(
          `${publicConfig.apiUrl}/auth/refresh`,
          { method: "POST", credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          await refreshUser();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUser]);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>("/auth/login", {
      emailOrUsername,
      password,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await api.post<{ accessToken: string }>("/auth/register", { username, email, password });
    setAccessToken(data.accessToken);
    await refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await api.post<{ accessToken: string }>("/auth/google", { credential });
    setAccessToken(data.accessToken);
    await refreshUser();
  }, [refreshUser]);

  const requestEmailCode = useCallback(async (email: string) => {
    await api.post("/auth/request-code", { email });
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const data = await api.post<{ accessToken: string }>("/auth/verify-code", { email, code });
    setAccessToken(data.accessToken);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    disconnectSocket();
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginWithGoogle, requestEmailCode, verifyEmailCode, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
