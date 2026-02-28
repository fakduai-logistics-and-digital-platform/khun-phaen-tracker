import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { api } from "$lib/apis";

export interface User {
  email: string;
}

export const user = writable<User | null>(null);
export const authLoading = writable(true);

export async function initAuth() {
  if (!browser) return;

  authLoading.set(true);
  try {
    const res = await api.auth.me();

    if (res.ok) {
      const data = await res.json();
      user.set({ email: data.email });
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
