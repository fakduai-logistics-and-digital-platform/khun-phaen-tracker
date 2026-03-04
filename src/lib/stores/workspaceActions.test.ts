import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWorkspaceActions } from "./workspaceActions";

describe("workspaceActions - Realtime Update", () => {
  let deps: any;
  let actions: any;

  beforeEach(() => {
    deps = {
      loadData: vi.fn(),
      debouncedLoadData: vi.fn(),
      notify: vi.fn(),
      t: vi.fn((k) => k),
      trackRealtime: vi.fn(),
      getAssignees: vi.fn().mockReturnValue([]),
      setAssignees: vi.fn(),
      getProjectList: vi.fn().mockReturnValue([]),
      setProjectList: vi.fn(),
      getProjects: vi.fn().mockReturnValue([]),
      setProjects: vi.fn(),
      setStats: vi.fn(),
      getTasks: vi.fn().mockReturnValue([]),
      setTasks: vi.fn(),
      getFilteredTasks: vi.fn().mockReturnValue([]),
      setFilteredTasks: vi.fn(),
    };
    actions = createWorkspaceActions(deps);
  });

  it("should update task in store instead of reloading when entity is task", async () => {
    const existingTask = { id: "1", title: "Old Title" };
    deps.getTasks.mockReturnValue([existingTask]);
    deps.getFilteredTasks.mockReturnValue([existingTask]);

    const payload = {
      entity: "task",
      action: "update",
      id: "1",
      data: { title: "New Title" },
    };

    await actions.handleRealtimeUpdate(payload);

    expect(deps.setTasks).toHaveBeenCalledWith([
      { id: "1", title: "New Title" },
    ]);
    expect(deps.setFilteredTasks).toHaveBeenCalledWith([
      { id: "1", title: "New Title" },
    ]);
    // Should NOT call loadData or debouncedLoadData for tasks anymore
    expect(deps.loadData).not.toHaveBeenCalled();
    expect(deps.debouncedLoadData).not.toHaveBeenCalled();
  });

  it("should add task to store when action is create", async () => {
    const newTask = { id: "2", title: "New Task" };
    deps.getTasks.mockReturnValue([]);
    deps.getFilteredTasks.mockReturnValue([]);

    const payload = {
      entity: "task",
      action: "create",
      data: newTask,
    };

    await actions.handleRealtimeUpdate(payload);

    expect(deps.setTasks).toHaveBeenCalledWith([newTask]);
    expect(deps.setFilteredTasks).toHaveBeenCalledWith([newTask]);
  });

  it("should remove task from store when action is delete", async () => {
    const taskToDelete = { id: "3", title: "To Delete" };
    deps.getTasks.mockReturnValue([taskToDelete]);
    deps.getFilteredTasks.mockReturnValue([taskToDelete]);

    const payload = {
      entity: "task",
      action: "delete",
      id: "3",
    };

    await actions.handleRealtimeUpdate(payload);

    expect(deps.setTasks).toHaveBeenCalledWith([]);
    expect(deps.setFilteredTasks).toHaveBeenCalledWith([]);
  });
});
