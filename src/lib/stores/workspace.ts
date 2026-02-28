import { writable, get } from "svelte/store";

/**
 * Stores the current workspace's MongoDB _id ($oid string).
 * Set when user enters a workspace from the dashboard.
 */
export const currentWorkspaceId = writable<string | null>(null);
export const currentWorkspaceName = writable<string>("");

const WS_KEY = "current-workspace-id";
const WS_NAME_KEY = "current-workspace-name";

/** Load workspace ID from localStorage on init */
export function loadWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(WS_KEY);
  const name = localStorage.getItem(WS_NAME_KEY);
  if (id) currentWorkspaceId.set(id);
  if (name) currentWorkspaceName.set(name);
  return id;
}

/** Set and persist workspace ID + name */
export function setWorkspaceId(id: string, name?: string) {
  currentWorkspaceId.set(id);
  localStorage.setItem(WS_KEY, id);
  if (name) {
    currentWorkspaceName.set(name);
    localStorage.setItem(WS_NAME_KEY, name);
  }
}

/** Clear workspace ID (e.g. on logout) */
export function clearWorkspaceId() {
  currentWorkspaceId.set(null);
  localStorage.removeItem(WS_KEY);
  currentWorkspaceName.set("");
  localStorage.removeItem(WS_NAME_KEY);
}

/** Get current workspace ID synchronously (throws if not set) */
export function getWorkspaceId(): string {
  const id = get(currentWorkspaceId);
  if (!id) throw new Error("No workspace selected");
  return id;
}
