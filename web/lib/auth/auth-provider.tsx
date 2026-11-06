"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/apis";
import { authLoading as authLoadingStore, user as userStore } from "@/lib/stores/auth";

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  position?: string;
}

export interface User {
  id: string;
  email: string;
  user_id: string;
  role: string;
  discord_id?: string;
  profile?: UserProfile;
}

const TOKEN_COOKIE = "_khun_ph_token";

export function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const parts = `; ${document.cookie}`.split(`; ${name}=`);
  return parts.length === 2 ? (parts.pop()?.split(";").shift() ?? null) : null;
}

function readCachedUser(): User | null {
  const email = localStorage.getItem("user_email");
  const id = localStorage.getItem("user_id");
  if (!email || !id) return null;
  const profile = localStorage.getItem("user_profile");
  return {
    id,
    email,
    user_id: localStorage.getItem("user_uuid") || "",
    role: localStorage.getItem("user_role") || "user",
    discord_id: localStorage.getItem("user_discord_id") || undefined,
    profile: profile ? JSON.parse(profile) : undefined,
  };
}

export function persistUser(u: User) {
  localStorage.setItem("user_email", u.email);
  if (u.id) localStorage.setItem("user_id", u.id);
  if (u.user_id) localStorage.setItem("user_uuid", u.user_id);
  localStorage.setItem("user_role", u.role || "user");
  if (u.discord_id) localStorage.setItem("user_discord_id", u.discord_id);
  else localStorage.removeItem("user_discord_id");
  if (u.profile) localStorage.setItem("user_profile", JSON.stringify(u.profile));
}

function clearSession() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=Lax`;
  for (const key of ["user_email", "user_id", "user_uuid", "user_role", "user_discord_id", "user_profile"]) {
    localStorage.removeItem(key);
  }
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getCookie(TOKEN_COOKIE)) {
          if (!cancelled) setUser(null);
          return;
        }
        const cached = readCachedUser();
        if (cached && !cancelled) setUser(cached);

        const res = await api.auth.me();
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const fresh: User = {
            id: data.id,
            email: data.email,
            user_id: data.user_id,
            role: data.role || "user",
            discord_id: data.discord_id,
            profile: data.profile,
          };
          persistUser(fresh);
          setUser(fresh);
        } else {
          clearSession();
          setUser(null);
        }
      } catch (e) {
        console.error("Auth init failed:", e);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((token: string, next: User) => {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=Lax`;
    persistUser(next);
    setUser(next);
    setLoading(false);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      persistUser(next);
      return next;
    });
  }, []);

  // Sign out locally right away; the server-side revoke runs in the background (the request is already built with the token).
  const signOut = useCallback(async () => {
    void api.auth.logout().catch(() => undefined);
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    userStore.set(user);
    authLoadingStore.set(loading);
  }, [user, loading]);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, updateUser }),
    [user, loading, signIn, signOut, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
