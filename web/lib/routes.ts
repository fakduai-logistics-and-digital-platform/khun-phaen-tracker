import { MY_TASKS_WORKSPACE_ID } from "@/lib/stores/workspace";

const MY_TASKS_SLUG = "my-tasks";

/** Query value for a workspace id; the personal "my tasks" workspace gets a readable slug. */
export function workspaceSlug(id: string) {
  return id === MY_TASKS_WORKSPACE_ID ? MY_TASKS_SLUG : id;
}

/** Inverse of `workspaceSlug`, for the `ws` query param. */
export function workspaceIdFromSlug(slug: string) {
  return slug === MY_TASKS_SLUG ? MY_TASKS_WORKSPACE_ID : slug;
}

/**
 * The app is a static export, so ids travel in the query string (`/workspaces/?ws=<id>`) instead of the path.
 * `extra` adds more query params (e.g. `{ task: "..." }`).
 */
function build(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `${path}/?${query.toString()}`;
}

export function workspacePath(id: string, ...segments: string[]) {
  return build(["/workspaces", ...segments].join("/"), { ws: workspaceSlug(id) });
}

export function taskPath(workspaceId: string, taskId: string | number) {
  return build("/workspaces/task", { ws: workspaceSlug(workspaceId), id: taskId });
}

export function publicTestCasesPath(workspaceId: string, projectId?: string) {
  return build("/public/test-cases", projectId ? { ws: workspaceId, project: projectId } : { ws: workspaceId });
}
