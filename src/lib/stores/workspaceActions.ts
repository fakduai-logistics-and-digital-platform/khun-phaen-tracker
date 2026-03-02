import {
  addProject,
  updateProject,
  deleteProject,
  addAssignee as addAssigneeDB,
  updateAssignee,
  deleteAssignee,
} from "$lib/db";

type NotifyType = "success" | "error";

type WorkspaceActionDeps = {
  loadData: () => Promise<void>;
  notify: (message: string, type?: NotifyType) => void;
  t: (key: string, options?: any) => string;
  trackRealtime: (reason: string) => void;
};

export function createWorkspaceActions(deps: WorkspaceActionDeps) {
  async function handleAddWorker(
    event: CustomEvent<{ name: string; color: string; user_id?: string }>,
  ) {
    try {
      await addAssigneeDB({
        name: event.detail.name,
        color: event.detail.color,
        user_id: event.detail.user_id,
      });
      await deps.loadData();
      deps.notify(deps.t("page__add_worker_success"));
      deps.trackRealtime("add-worker");
    } catch (e: any) {
      console.error(e);
      deps.notify(`${deps.t("page__add_worker_error")}: ${e.message}`, "error");
    }
  }

  async function handleUpdateWorker(
    event: CustomEvent<{
      id: string | number;
      name: string;
      color: string;
      user_id?: string;
    }>,
  ) {
    try {
      await updateAssignee(event.detail.id, {
        name: event.detail.name,
        color: event.detail.color,
        user_id: event.detail.user_id,
      });
      await deps.loadData();
      deps.notify(deps.t("page__update_worker_success"));
      deps.trackRealtime("update-worker");
    } catch (e: any) {
      console.error(e);
      deps.notify(
        `${deps.t("page__update_worker_error")}: ${e.message}`,
        "error",
      );
    }
  }

  async function handleDeleteWorker(event: CustomEvent<string | number>) {
    try {
      await deleteAssignee(event.detail);
      await deps.loadData();
      deps.notify(deps.t("page__delete_worker_success"));
      deps.trackRealtime("delete-worker");
    } catch (e: any) {
      console.error(e);
      deps.notify(
        `${deps.t("page__delete_worker_error")}: ${e.message}`,
        "error",
      );
    }
  }

  async function handleAddProject(
    event: CustomEvent<{ name: string; repo_url?: string }>,
  ) {
    try {
      await addProject({
        name: event.detail.name,
        repo_url: event.detail.repo_url,
      });
      await deps.loadData();
      deps.notify(deps.t("page__add_project_success"));
      deps.trackRealtime("add-project");
    } catch {
      deps.notify(deps.t("page__add_project_error"), "error");
    }
  }

  async function handleUpdateProject(
    event: CustomEvent<{ id: string | number; name: string; repo_url?: string }>,
  ) {
    try {
      await updateProject(event.detail.id, {
        name: event.detail.name,
        repo_url: event.detail.repo_url,
      });
      await deps.loadData();
      deps.notify(deps.t("page__update_project_success"));
      deps.trackRealtime("update-project");
    } catch {
      deps.notify(deps.t("page__update_project_error"), "error");
    }
  }

  async function handleDeleteProject(event: CustomEvent<string | number>) {
    try {
      await deleteProject(event.detail);
      await deps.loadData();
      deps.notify(deps.t("page__delete_project_success"));
      deps.trackRealtime("delete-project");
    } catch {
      deps.notify(deps.t("page__delete_project_error"), "error");
    }
  }

  return {
    handleAddWorker,
    handleUpdateWorker,
    handleDeleteWorker,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
  };
}
