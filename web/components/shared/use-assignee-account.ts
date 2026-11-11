"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/apis";
import { useStore } from "@/lib/store";
import { currentWorkspaceId } from "@/lib/stores/workspace";

export type AssigneeAccount = {
  user_id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  position?: string | null;
};

const CACHE_MS = 60_000;
const cache = new Map<
  string,
  { at: number; accounts: Promise<Record<string, AssigneeAccount>> }
>();

function loadAccounts(workspaceId: string) {
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.accounts;
  const accounts = api.auth
    .listUserProfiles(workspaceId)
    .then(async (res) => {
      if (!res.ok) throw new Error(`profiles ${res.status}`);
      const data = (await res.json()) as { profiles?: AssigneeAccount[] };
      return Object.fromEntries(
        (data.profiles ?? []).map((p) => [p.user_id, p]),
      );
    })
    .catch((error) => {
      cache.delete(workspaceId);
      throw error;
    });
  cache.set(workspaceId, { at: Date.now(), accounts });
  return accounts;
}

/** Real name, email and position of the user an assignee is linked to; undefined until loaded or when not linked. */
export function useAssigneeAccount(userId: string | undefined) {
  const workspaceId = useStore(currentWorkspaceId);
  const [account, setAccount] = useState<AssigneeAccount>();

  useEffect(() => {
    if (!userId || !workspaceId) return;
    let cancelled = false;
    loadAccounts(workspaceId)
      .then((accounts) => {
        if (!cancelled) setAccount(accounts[userId]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, workspaceId]);

  return account;
}
