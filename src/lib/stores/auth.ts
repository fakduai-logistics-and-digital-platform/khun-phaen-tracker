import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { api } from "$lib/apis";

export interface User {
  email: string;
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
      if (cachedEmail) {
        user.set({ email: cachedEmail });
      }

      // Then quietly verify with backend to ensure the token isn't expired/fake
      const res = await api.auth.me();
      if (res.ok) {
        const data = await res.json();
        user.set({ email: data.email });
        localStorage.setItem("user_email", data.email); // keep cache fresh
      } else {
        // Token is invalid/expired according to backend
        document.cookie = "_khun_ph_token=; path=/; max-age=0; samesite=Lax";
        localStorage.removeItem("user_email");
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
