import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTaskActions } from "./taskActions";
import * as db from "$lib/db";

// Mock DB
vi.mock("$lib/db", () => ({
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getAssignees: vi.fn(),
  addAssignee: vi.fn(),
}));

describe("taskActions", () => {
  let deps: any;
  let actions: any;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      loadData: vi.fn().mockResolvedValue(undefined),
      notify: vi.fn(),
      t: vi.fn((key) => key),
      trackRealtime: vi.fn(),
      getTasks: vi.fn().mockReturnValue([]),
      setTasks: vi.fn(),
      getFilteredTasks: vi.fn().mockReturnValue([]),
      setFilteredTasks: vi.fn(),
      getEditingTask: vi.fn().mockReturnValue(null),
      setEditingTask: vi.fn(),
      setShowForm: vi.fn(),
      setAssignees: vi.fn(),
    };
    actions = createTaskActions(deps);
  });

  it("should add task when editingTask is null", async () => {
    const event = {
      detail: { title: "New Task" },
    } as any;

    await actions.handleAddTask(event);

    expect(db.addTask).toHaveBeenCalledWith(event.detail);
    expect(db.updateTask).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("page__add_task_success");
  });

  it("should update task when editingTask is not null", async () => {
    const editingTask = { id: 123, title: "Old Task" };
    deps.getEditingTask.mockReturnValue(editingTask);

    const event = {
      detail: { title: "Updated Task" },
    } as any;

    await actions.handleAddTask(event);

    expect(db.updateTask).toHaveBeenCalledWith(123, event.detail);
    expect(db.addTask).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("page__update_task_success");
    expect(deps.setEditingTask).toHaveBeenCalledWith(null);
  });
});
