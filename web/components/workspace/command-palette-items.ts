import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Calendar,
  Columns3,
  CheckCircle,
  Flag,
  Folder,
  FileText,
  LayoutGrid,
  List as ListIcon,
  MessageSquareQuote,
  Play,
  Plus,
  Presentation,
  Search,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import type { Assignee, CommandPaletteItem, Project, Sprint, Task } from "@/lib/types";
import { getFuzzyScore, normalizeForCommandSearch } from "@/lib/utils/command-palette";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const CATEGORY_ORDER: CommandPaletteItem["category"][] = [
  "command",
  "search",
  "task",
  "project",
  "assignee",
  "sprint",
];

export interface PaletteActions {
  createTask: () => void;
  startTimer: () => void;
  switchView: (id: string) => void;
  toggleTheme: () => void;
  openQuickNotes: () => void;
  openBookmarks: () => void;
  openWhiteboard: () => void;
  dailyReflect: () => void;
  openPageSize: () => void;
  clearFilters: () => void;
  openTask: (task: Task) => void;
  applyGlobalSearch: (query: string) => void;
  filterProject?: (project: string) => void;
  filterAssignee?: (assigneeId: string | number) => void;
  filterSprint?: (sprintId: string | number) => void;
}

export function getCommandStatusInfo(status: string, t: Translate) {
  switch (status) {
    case "done":
      return {
        label: t("page__filter_status_done"),
        className:
          "bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
      };
    case "in-progress":
      return {
        label: t("page__filter_status_in_progress"),
        className:
          "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
      };
    case "in-test":
      return {
        label: t("page__filter_status_in_test"),
        className:
          "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
      };
    default:
      return {
        label: t("page__filter_status_todo"),
        className:
          "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      };
  }
}

export function getCategoryLabel(category: CommandPaletteItem["category"], t: Translate) {
  switch (category) {
    case "command":
      return t("commandPalette__cat_commands");
    case "search":
      return t("commandPalette__cat_search");
    case "task":
      return t("commandPalette__cat_tasks");
    case "project":
      return t("commandPalette__cat_projects");
    case "assignee":
      return t("commandPalette__cat_assignees");
    case "sprint":
      return t("commandPalette__cat_sprints");
    default:
      return "";
  }
}

export function buildBaseItems(t: Translate, a: PaletteActions): CommandPaletteItem[] {
  return [
    {
      id: "create-task",
      label: t("commandPalette__create_task_label"),
      description: t("commandPalette__create_task_desc"),
      keywords: ["new task", "add task", "create task"],
      category: "command",
      icon: Plus,
      run: a.createTask,
    },
    {
      id: "start-timer",
      label: t("commandPalette__start_timer_label"),
      description: t("commandPalette__start_timer_desc"),
      keywords: ["timer", "start timer", "in progress", "focus"],
      category: "command",
      icon: Play,
      run: a.startTimer,
    },
    {
      id: "view-kanban",
      label: t("page__view_kanban"),
      description: t("commandPalette__view_kanban_desc"),
      keywords: ["board", "kanban", "column", "view", "บอร์ด", "คัมบัง"],
      category: "command",
      icon: Columns3,
      run: () => a.switchView("kanban"),
    },
    {
      id: "view-list",
      label: t("page__view_list"),
      description: t("commandPalette__view_list_desc"),
      keywords: ["table", "rows", "view", "รายการ", "ตาราง"],
      category: "command",
      icon: ListIcon,
      run: () => a.switchView("list"),
    },
    {
      id: "view-calendar",
      label: t("page__view_calendar"),
      description: t("commandPalette__view_calendar_desc"),
      keywords: ["schedule", "dates", "view", "ปฏิทิน", "วันที่"],
      category: "command",
      icon: Calendar,
      run: () => a.switchView("calendar"),
    },
    {
      id: "view-table",
      label: t("page__view_table"),
      description: t("commandPalette__view_table_desc"),
      keywords: ["spreadsheet", "grid", "detailed", "ตาราง", "สเปรดชีต"],
      category: "command",
      icon: LayoutGrid,
      run: () => a.switchView("table"),
    },
    {
      id: "view-gantt",
      label: t("page__view_gantt"),
      description: t("commandPalette__view_gantt_desc"),
      keywords: ["timeline", "roadmap", "schedule", "แผนงาน", "ก้านต์"],
      category: "command",
      icon: BarChart3,
      run: () => a.switchView("gantt"),
    },
    {
      id: "toggle-theme",
      label: t("page__btn_theme"),
      description: t("commandPalette__toggle_theme_desc_v2"),
      keywords: ["dark", "light", "appearance", "mode", "ธีม", "สว่าง", "มืด"],
      category: "command",
      icon: Sun,
      run: a.toggleTheme,
    },
    {
      id: "open-quick-notes",
      label: t("commandPalette__quick_notes_label"),
      description: t("commandPalette__quick_notes_desc"),
      keywords: ["quick note", "note", "memo", "sticky"],
      category: "command",
      icon: FileText,
      run: a.openQuickNotes,
    },
    {
      id: "open-bookmarks",
      label: t("commandPalette__bookmarks_label"),
      description: t("commandPalette__bookmarks_desc"),
      keywords: ["bookmark", "link", "saved links"],
      category: "command",
      icon: Bookmark,
      run: a.openBookmarks,
    },
    {
      id: "open-whiteboard",
      label: t("commandPalette__whiteboard_label"),
      description: t("commandPalette__whiteboard_desc"),
      keywords: ["whiteboard", "draw", "sketch", "canvas"],
      category: "command",
      icon: Presentation,
      run: a.openWhiteboard,
    },
    {
      id: "daily-reflect",
      label: t("dailyReflect__title"),
      description: t("dailyReflect__subtitle"),
      keywords: ["standup", "daily report", "summary", "reflect"],
      category: "command",
      icon: MessageSquareQuote,
      run: a.dailyReflect,
    },
    {
      id: "set-page-size",
      label: t("pagination__set_limit"),
      description: t("pagination__set_limit_desc"),
      keywords: ["pagination", "limit", "page size", "งานต่อหน้า"],
      category: "command",
      icon: Settings2,
      run: a.openPageSize,
    },
    {
      id: "clear-filters",
      label: t("commandPalette__clear_filters_label"),
      description: t("commandPalette__clear_filters_desc"),
      keywords: ["reset", "all", "filter", "clear", "ล้าง", "กรอง"],
      category: "command",
      icon: ArrowRight,
      run: a.clearFilters,
    },
  ];
}

type Scored = { score: number; item: CommandPaletteItem };

function top(entries: Scored[], limit: number) {
  return entries
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export interface DynamicItemsInput {
  query: string;
  rawQuery: string;
  tasks: Task[];
  sprints: Sprint[];
  projects: Project[];
  assignees: Assignee[];
  fallbackShortName: string | null;
  t: Translate;
  actions: PaletteActions;
}

export function buildDynamicItems({
  query,
  rawQuery,
  tasks,
  sprints,
  projects,
  assignees,
  fallbackShortName,
  t,
  actions,
}: DynamicItemsInput): CommandPaletteItem[] {
  if (!query) return [];

  const sprintNameById = new Map(sprints.filter((s) => s.id !== undefined).map((s) => [String(s.id), s.name]));

  const taskItems: Scored[] = [];
  for (const task of tasks) {
    if (task.id === undefined) continue;
    const sprintName = task.sprint_id ? sprintNameById.get(String(task.sprint_id)) || "" : "";
    const text = normalizeForCommandSearch(
      [
        task.title,
        task.project || "",
        task.category || "",
        task.notes || "",
        task.assignee?.name || "",
        sprintName,
        task.status,
      ].join(" "),
    );
    const score = getFuzzyScore(query, text);
    if (score === null) continue;

    const prefix = task.workspace_short_name || fallbackShortName || "TASK";
    const idLabel = task.task_number ? `${prefix}-${task.task_number} ` : "";
    taskItems.push({
      score,
      item: {
        id: `task-${task.id}`,
        label: idLabel + task.title,
        description: `${task.project || t("commandPalette__no_project")} · ${getCommandStatusInfo(task.status, t).label}`,
        keywords: [task.title, task.project || "", task.category || "", task.assignee?.name || "", sprintName],
        category: "task",
        project: task.project || t("commandPalette__no_project"),
        status: task.status,
        icon: CheckCircle,
        run: () => actions.openTask(task),
      },
    });
  }

  const projectItems: Scored[] = [];
  for (const project of projects) {
    const score = getFuzzyScore(query, normalizeForCommandSearch(project.name));
    if (score === null) continue;
    projectItems.push({
      score,
      item: {
        id: `project-${project.id ?? project.name}`,
        label: t("commandPalette__filter_project_label", { name: project.name }),
        description: t("commandPalette__filter_project_desc"),
        keywords: [project.name, "project", "filter"],
        category: "project",
        project: project.name,
        icon: Folder,
        run: () => actions.filterProject?.(project.name),
      },
    });
  }

  const assigneeItems: Scored[] = [];
  for (const assignee of assignees) {
    if (assignee.id === undefined) continue;
    const score = getFuzzyScore(query, normalizeForCommandSearch(assignee.name));
    if (score === null) continue;
    assigneeItems.push({
      score,
      item: {
        id: `assignee-${assignee.id}`,
        label: t("commandPalette__filter_assignee_label", { name: assignee.name }),
        description: t("commandPalette__filter_assignee_desc"),
        keywords: [assignee.name, "assignee", "worker", "filter"],
        category: "assignee",
        icon: Users,
        run: () => actions.filterAssignee?.(assignee.id!),
      },
    });
  }

  const sprintItems: Scored[] = [];
  for (const sprint of sprints) {
    const score = getFuzzyScore(query, normalizeForCommandSearch(sprint.name));
    if (score === null) continue;
    sprintItems.push({
      score,
      item: {
        id: `sprint-filter-${sprint.id}`,
        label: t("commandPalette__go_to_sprint_label", { name: sprint.name }),
        description: t("commandPalette__go_to_sprint_desc", { name: sprint.name }),
        keywords: [sprint.name, "sprint", "filter"],
        category: "sprint",
        icon: Flag,
        run: () => actions.filterSprint?.(sprint.id!),
      },
    });
  }

  const quickSearch: CommandPaletteItem = {
    id: `search-all-${query}`,
    label: t("commandPalette__search_tasks_label", { query: rawQuery }),
    description: t("commandPalette__search_tasks_desc"),
    keywords: ["search", "find", rawQuery],
    category: "search",
    icon: Search,
    run: () => actions.applyGlobalSearch(rawQuery),
  };

  return [quickSearch, ...top(taskItems, 6), ...top(projectItems, 3), ...top(assigneeItems, 3), ...top(sprintItems, 3)];
}

export function filterPaletteItems(items: CommandPaletteItem[], query: string): CommandPaletteItem[] {
  if (!query) return items;
  const scored = items
    .map((item) => {
      const haystack = normalizeForCommandSearch(`${item.label} ${item.description} ${item.keywords.join(" ")}`);
      const score = getFuzzyScore(query, haystack);
      return score === null ? null : { item, score };
    })
    .filter((entry): entry is { item: CommandPaletteItem; score: number } => entry !== null)
    .sort((x, y) => y.score - x.score);

  const seen = new Set<string>();
  const deduped: CommandPaletteItem[] = [];
  for (const entry of scored) {
    if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    deduped.push(entry.item);
  }
  return deduped;
}
