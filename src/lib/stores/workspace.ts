import { writable, get } from "svelte/store";

/**
 * Stores the current workspace's MongoDB _id ($oid string).
 * Set when user enters a workspace from the dashboard.
 */
export const currentWorkspaceId = writable<string | null>(null);
export const currentWorkspaceName = writable<string>("");
export const currentWorkspaceOwnerId = writable<string | null>(null);
export const currentWorkspaceColor = writable<string | null>(null);
export const currentWorkspaceIcon = writable<string | null>(null);

const WS_KEY = "current-workspace-id";
const WS_NAME_KEY = "current-workspace-name";
const WS_OWNER_KEY = "current-workspace-owner-id";
const WS_COLOR_KEY = "current-workspace-color";
const WS_ICON_KEY = "current-workspace-icon";

/** Load workspace ID from localStorage on init */
export function loadWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(WS_KEY);
  const name = localStorage.getItem(WS_NAME_KEY);
  const ownerId = localStorage.getItem(WS_OWNER_KEY);
  const color = localStorage.getItem(WS_COLOR_KEY);
  const icon = localStorage.getItem(WS_ICON_KEY);

  if (id) currentWorkspaceId.set(id);
  if (name) currentWorkspaceName.set(name);
  if (ownerId) currentWorkspaceOwnerId.set(ownerId);
  if (color) currentWorkspaceColor.set(color);
  if (icon) currentWorkspaceIcon.set(icon);

  return id;
}

/** Set and persist workspace ID + name */
export function setWorkspaceId(
  id: string,
  name?: string,
  ownerId?: string,
  color?: string,
  icon?: string,
) {
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
  if (color) {
    currentWorkspaceColor.set(color);
    localStorage.setItem(WS_COLOR_KEY, color);
  } else {
    currentWorkspaceColor.set(null);
    localStorage.removeItem(WS_COLOR_KEY);
  }
  if (icon) {
    currentWorkspaceIcon.set(icon);
    localStorage.setItem(WS_ICON_KEY, icon);
  } else {
    currentWorkspaceIcon.set(null);
    localStorage.removeItem(WS_ICON_KEY);
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
  currentWorkspaceColor.set(null);
  localStorage.removeItem(WS_COLOR_KEY);
  currentWorkspaceIcon.set(null);
  localStorage.removeItem(WS_ICON_KEY);
}

/** Get current workspace ID synchronously (throws if not set) */
export function getWorkspaceId(): string {
  const id = get(currentWorkspaceId);
  if (!id) throw new Error("No workspace selected");
  return id;
}
