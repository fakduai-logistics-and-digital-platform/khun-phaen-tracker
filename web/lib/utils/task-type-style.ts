import type { TaskType } from "./branch-name";

/** Colors per task type, shared by the table badge and every type picker so one type always looks the same. */
export const TASK_TYPE_BADGE: Record<TaskType, { label: string; className: string }> = {
  feature: { label: "feat", className: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300" },
  bug: { label: "bug", className: "bg-red-500/15 text-red-700 dark:bg-red-400/15 dark:text-red-300" },
  optimize: { label: "perf", className: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" },
  refactor: { label: "refactor", className: "bg-purple-500/15 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300" },
  docs: { label: "docs", className: "bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300" },
  chore: { label: "chore", className: "bg-gray-500/15 text-gray-700 dark:bg-gray-400/15 dark:text-gray-300" },
  test: { label: "test", className: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" },
  ui: { label: "ui", className: "bg-pink-500/15 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300" },
};

export const TASK_TYPE_ICON_CLASS: Record<TaskType, string> = {
  feature: "text-indigo-500 dark:text-indigo-400",
  bug: "text-red-500 dark:text-red-400",
  optimize: "text-amber-500 dark:text-amber-400",
  refactor: "text-purple-500 dark:text-purple-400",
  docs: "text-sky-500 dark:text-sky-400",
  chore: "text-gray-500 dark:text-gray-400",
  test: "text-emerald-500 dark:text-emerald-400",
  ui: "text-pink-500 dark:text-pink-400",
};
