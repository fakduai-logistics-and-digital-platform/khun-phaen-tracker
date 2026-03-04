import {
  addProject,
  updateProject,
  deleteProject,
  addAssignee as addAssigneeDB,
  updateAssignee,
  deleteAssignee,
  getStats,
} from "$lib/db";
import type { Project, Assignee, Task } from "$lib/types";

type NotifyType = "success" | "error";

type WorkspaceActionDeps = {
  loadData: () => Promise<void>;
  debouncedLoadData: () => void;
  notify: (message: string, type?: NotifyType) => void;
  t: (key: string, options?: any) => string;
  trackRealtime: (reason: string) => void;
  getAssignees: () => Assignee[];
  setAssignees: (assignees: Assignee[]) => void;
  getProjectList: () => Project[];
  setProjectList: (projects: Project[]) => void;
  getProjects: () => string[];
  setProjects: (projects: string[]) => void;
  setStats: (stats: any) => void;
  getTasks: () => Task[];
  setTasks: (tasks: Task[]) => void;
  getFilteredTasks: () => Task[];
  setFilteredTasks: (tasks: Task[]) => void;
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
    event: CustomEvent<{
      id: string | number;
      name: string;
      repo_url?: string;
    }>,
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

  async function handleRealtimeUpdate(payload: any) {
    const { entity, action, id, data } = payload;
    let statNeedsUpdate = false;

    if (entity === "task") {
      statNeedsUpdate = true;
      const currentTasks = deps.getTasks();
      const currentFiltered = deps.getFilteredTasks();

      if (action === "create" && data) {
        if (!currentTasks.find((t) => String(t.id) === String(data.id))) {
          deps.setTasks([...currentTasks, data]);
          deps.setFilteredTasks([...currentFiltered, data]);
        }
      } else if (action === "update" && id && data) {
        const updateMapper = (t: Task) =>
          String(t.id) === String(id) ? { ...t, ...data } : t;
        deps.setTasks(currentTasks.map(updateMapper));
        deps.setFilteredTasks(currentFiltered.map(updateMapper));
      } else if (action === "delete" && id) {
        const deleteFilter = (t: Task) => String(t.id) !== String(id);
        deps.setTasks(currentTasks.filter(deleteFilter));
        deps.setFilteredTasks(currentFiltered.filter(deleteFilter));
      }
    } else if (entity === "assignee") {
      let currentAssignees = deps.getAssignees();
      if (action === "create" && data) {
        if (!currentAssignees.find((a) => a.id === data.id)) {
          deps.setAssignees([...currentAssignees, data]);
        }
      } else if (action === "update" && id && data) {
        deps.setAssignees(
          currentAssignees.map((a) =>
            String(a.id) === String(id) ? { ...a, ...data } : a,
          ),
        );
      } else if (action === "delete" && id) {
        deps.setAssignees(
          currentAssignees.filter((a) => String(a.id) !== String(id)),
        );
      }
      deps.debouncedLoadData();
    } else if (entity === "project") {
      let currentProjectList = deps.getProjectList();
      let currentProjects = deps.getProjects();

      if (action === "create" && data) {
        if (!currentProjectList.find((p) => p.id === data.id)) {
          deps.setProjectList([...currentProjectList, data]);
        }
        if (!currentProjects.includes(data.name)) {
          deps.setProjects([...currentProjects, data.name]);
        }
      } else if (action === "update" && id && data) {
        const oldProject = currentProjectList.find(
          (p) => String(p.id) === String(id),
        );
        deps.setProjectList(
          currentProjectList.map((p) =>
            String(p.id) === String(id) ? { ...p, ...data } : p,
          ),
        );
        if (oldProject && data.name && oldProject.name !== data.name) {
          deps.setProjects(
            currentProjects.map((name) =>
              name === oldProject.name ? data.name : name,
            ),
          );
          deps.debouncedLoadData();
        }
      } else if (action === "delete" && id) {
        const deletedProject = currentProjectList.find(
          (p) => String(p.id) === String(id),
        );
        deps.setProjectList(
          currentProjectList.filter((p) => String(p.id) !== String(id)),
        );
        if (deletedProject) {
          deps.setProjects(
            currentProjects.filter((name) => name !== deletedProject.name),
          );
        }
      }
    }

    if (statNeedsUpdate) {
      try {
        const stats = await getStats();
        deps.setStats(stats);
      } catch (e) {
        console.warn("⚠️ getStats failed:", e);
      }
    }
  }

  return {
    handleAddWorker,
    handleUpdateWorker,
    handleDeleteWorker,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleRealtimeUpdate,
  };
}
