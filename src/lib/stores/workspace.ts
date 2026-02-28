import { writable, get } from "svelte/store";

/**
 * Stores the current workspace's MongoDB _id ($oid string).
 * Set when user enters a workspace from the dashboard.
 */
export const currentWorkspaceId = writable<string | null>(null);
export const currentWorkspaceName = writable<string>("");
export const currentWorkspaceOwnerId = writable<string | null>(null);

const WS_KEY = "current-workspace-id";
const WS_NAME_KEY = "current-workspace-name";
const WS_OWNER_KEY = "current-workspace-owner-id";

/** Load workspace ID from localStorage on init */
export function loadWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(WS_KEY);
  const name = localStorage.getItem(WS_NAME_KEY);
  const ownerId = localStorage.getItem(WS_OWNER_KEY);
  if (id) currentWorkspaceId.set(id);
  if (name) currentWorkspaceName.set(name);
  if (ownerId) currentWorkspaceOwnerId.set(ownerId);
  return id;
}

/** Set and persist workspace ID + name */
export function setWorkspaceId(id: string, name?: string, ownerId?: string) {
  currentWorkspaceId.set(id);
  localStorage.setItem(WS_KEY, id);
  if (name) {
    currentWorkspaceName.set(name);
    localStorage.setItem(WS_NAME_KEY, name);
  }
  if (ownerId) {
    currentWorkspaceOwnerId.set(ownerId);
    localStorage.setItem(WS_OWNER_KEY, ownerId);
  }
}

/** Clear workspace ID (e.g. on logout) */
export function clearWorkspaceId() {
  currentWorkspaceId.set(null);
  localStorage.removeItem(WS_KEY);
  currentWorkspaceName.set("");
  localStorage.removeItem(WS_NAME_KEY);
  currentWorkspaceOwnerId.set(null);
  localStorage.removeItem(WS_OWNER_KEY);
}

/** Get current workspace ID synchronously (throws if not set) */
export function getWorkspaceId(): string {
  const id = get(currentWorkspaceId);
  if (!id) throw new Error("No workspace selected");
  return id;
}
