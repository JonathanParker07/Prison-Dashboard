// contexts/AuthContext.tsx
"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@/types";
import { authService } from "@/services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    prison_name?: string
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  sessionReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionReady, setSessionReady] = useState<boolean>(false);

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  // Restore session on mount
  useEffect(() => {
    const rawToken = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");

    if (rawToken) {
      setToken(rawToken);
      fetchMe(rawToken).finally(() => setSessionReady(true));
    } else {
      setSessionReady(true);
    }

    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser) as User);
      } catch {
        console.warn("Failed to parse stored user");
      }
    }
  }, []);

  // Fetch current user from backend
  const fetchMe = async (tokenToUse?: string) => {
    try {
      const me = await authService.getMe();
      if (me) {
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      }
    } catch (err) {
      console.error("fetchMe failed", err);
      logout(); // ✅ safe now
    }
  };

  // Login flow
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await authService.login(email, password);

      if (!resp?.access_token) {
        throw new Error("Login failed: no token returned");
      }

      localStorage.setItem("token", resp.access_token);
      setToken(resp.access_token);

      if (resp.user) {
        // Use user from login response immediately
        setUser(resp.user as User);
        localStorage.setItem("user", JSON.stringify(resp.user));
      } else {
        // Otherwise fetch user
        await fetchMe(resp.access_token);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        throw new Error(
          detail.map((d: any) => (d.msg ? d.msg : JSON.stringify(d))).join(", ")
        );
      } else if (typeof detail === "string") {
        throw new Error(detail);
      } else {
        throw new Error(error?.message ?? "Login failed");
      }
    } finally {
      setIsLoading(false);
      setSessionReady(true);
    }
  };

  // Register then login
  const register = async (
    name: string,
    email: string,
    password: string,
    prison_name?: string
  ) => {
    setIsLoading(true);
    try {
      await authService.register(name, email, password, prison_name);
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, isLoading, sessionReady }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
  