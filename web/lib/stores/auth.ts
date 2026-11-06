import { writable } from "@/lib/store";

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

/**
 * Store mirror of the React AuthProvider state, for non-React code (db.ts, stores).
 * AuthProvider is the single writer; never set this from elsewhere.
 */
export const user = writable<User | null>(null);
export const authLoading = writable(true);
