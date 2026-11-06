const ROOMS_KEY = "workspace-rooms";
const LEGACY_KEY = "sync-room-code";

function readRooms(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Sync room of a workspace. Kept in localStorage instead of the URL. */
export function getWorkspaceRoom(workspaceId: string): string | null {
  const stored = readRooms()[workspaceId];
  if (stored) return stored;
  return typeof localStorage === "undefined" ? null : localStorage.getItem(LEGACY_KEY);
}

export function setWorkspaceRoom(workspaceId: string, room: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ROOMS_KEY, JSON.stringify({ ...readRooms(), [workspaceId]: room }));
  localStorage.setItem(LEGACY_KEY, room);
}

/**
 * Invite links still carry `?room=`. Store it, drop it from the address bar, and return the room.
 */
export function consumeRoomParam(workspaceId: string): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const room = url.searchParams.get("room");
  if (room) {
    setWorkspaceRoom(workspaceId, room);
    url.searchParams.delete("room");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    return room;
  }
  return getWorkspaceRoom(workspaceId);
}
