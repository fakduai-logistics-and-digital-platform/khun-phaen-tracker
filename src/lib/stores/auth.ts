import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { api } from "$lib/apis";

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

export const user = writable<User | null>(null);
export const authLoading = writable(true);

export function getCookie(name: string) {
  if (!browser) return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return null;
}

export async function initAuth() {
  if (!browser) return;

  authLoading.set(true);
  try {
    const token = getCookie("_khun_ph_token");
    if (token) {
      // First, set user from local storage for instant UI render
      const cachedEmail = localStorage.getItem("user_email");
      const cachedId = localStorage.getItem("user_id");
      const cachedProfile = localStorage.getItem("user_profile");
      const cachedUserId = localStorage.getItem("user_uuid");

      const cachedRole = localStorage.getItem("user_role");
      const cachedDiscordId = localStorage.getItem("user_discord_id");

      if (cachedEmail && cachedId) {
        user.set({
          id: cachedId,
          email: cachedEmail,
          user_id: cachedUserId || "",
          role: cachedRole || "user",
          discord_id: cachedDiscordId || undefined,
          profile: cachedProfile ? JSON.parse(cachedProfile) : undefined,
        });
      }

      // Then quietly verify with backend to ensure the token isn't expired/fake
      const res = await api.auth.me();
      if (res.ok) {
        const data = await res.json();
        user.set({
          id: data.id,
          email: data.email,
          user_id: data.user_id,
          role: data.role || "user",
          discord_id: data.discord_id,
          profile: data.profile,
        });
        localStorage.setItem("user_email", data.email);
        localStorage.setItem("user_id", data.id);
        localStorage.setItem("user_uuid", data.user_id);
        localStorage.setItem("user_role", data.role || "user");
        if (data.discord_id)
          localStorage.setItem("user_discord_id", data.discord_id);
        else localStorage.removeItem("user_discord_id");
        if (data.profile)
          localStorage.setItem("user_profile", JSON.stringify(data.profile));
      } else {
        // Token is invalid/expired according to backend
        document.cookie = "_khun_ph_token=; path=/; max-age=0; samesite=Lax";
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_id");
        user.set(null);
      }
    } else {
      user.set(null);
    }
  } catch (e) {
    console.error("Auth init failed:", e);
    user.set(null);
  } finally {
    authLoading.set(false);
  }
}
