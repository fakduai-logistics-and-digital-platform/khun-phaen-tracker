"use client";

import { useEffect, useState } from "react";
import { consumeRoomParam } from "@/lib/room";

/** Sync room for a workspace; `undefined` until read on the client, `null` when none is stored. */
export function useWorkspaceRoom(workspaceId: string | undefined) {
  const [room, setRoom] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setRoom(workspaceId ? consumeRoomParam(workspaceId) : null);
  }, [workspaceId]);
  return room;
}
