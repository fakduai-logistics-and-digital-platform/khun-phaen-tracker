import { writable } from "svelte/store";
import type { Sprint } from "$lib/types";
import {
  getSprints as fetchSprints,
  addSprint as createSprint,
  updateSprint as patchSprint,
  deleteSprint as removeSprint,
} from "$lib/db";

export type { Sprint };

function createSprintStore() {
  const { subscribe, set, update } = writable<Sprint[]>([]);

  return {
    subscribe,
    set,
    add: async (
      sprint: Omit<Sprint, "id" | "created_at">,
    ): Promise<Sprint> => {
      const newSprint = await createSprint(sprint);
      update((list) => [...list, newSprint]);
      return newSprint;
    },
    update: async (
      id: string | number,
      updates: Partial<Sprint>,
    ): Promise<void> => {
      await patchSprint(id, updates);
      update((list) =>
        list.map((s) =>
          String(s.id) === String(id) ? { ...s, ...updates } : s,
        ),
      );
    },
    complete: async (id: string | number): Promise<void> => {
      const today = new Date().toISOString().split("T")[0];
      await patchSprint(id, {
        status: "completed",
        completed_at: today,
      });
      update((list) =>
        list.map((s) =>
          String(s.id) === String(id)
            ? { ...s, status: "completed" as const, completed_at: today }
            : s,
        ),
      );
    },
    delete: async (id: string | number): Promise<void> => {
      await removeSprint(id);
      update((list) => list.filter((s) => String(s.id) !== String(id)));
    },
    refresh: async (): Promise<void> => {
      try {
        const list = await fetchSprints();
        set(list);
      } catch (e) {
        console.error("Failed to refresh sprints:", e);
      }
    },
    getActiveSprint: (): Sprint | null => {
      let activeSprint: Sprint | null = null;
      const unsubscribe = subscribe((list) => {
        activeSprint = list.find((s) => s.status === "active") || null;
      });
      unsubscribe();
      return activeSprint;
    },
  };
}

export const sprints = createSprintStore();

// Archive tasks that are done when sprint completes
export function archiveCompletedTasks(sprintId: string | number) {
  const event = new CustomEvent("archive-sprint-tasks", {
    detail: { sprintId },
  });
  document.dispatchEvent(event);
}
