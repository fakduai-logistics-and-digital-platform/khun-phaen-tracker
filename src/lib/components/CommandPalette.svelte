<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import {
    Search,
    CheckCircle,
    Folder,
    Users,
    Calendar,
    Settings,
    LayoutGrid,
    List as ListIcon,
    Trello,
    Layout as LayoutIcon,
    BarChart3,
    Sun,
    Moon,
    ArrowRight,
    Sparkles,
    Flag,
    FileText,
    Video,
    Presentation,
    MessageSquareQuote,
    Settings2,
    Plus,
    Play,
    Bookmark,
  } from "lucide-svelte";
  import type {
    Task,
    Project,
    Assignee,
    FilterOptions,
    CommandPaletteItem,
  } from "$lib/types";
  import {
    getFuzzyScore,
    normalizeForCommandSearch,
  } from "$lib/utils/command-palette";

  export let open = false;
  export let tasks: Task[] = [];
  export let sprints: any[] = [];
  export let projects: Project[] = [];
  export let assignees: Assignee[] = [];

  export let toggleTheme: () => void;
  export let switchView: (id: any) => void;
  export let openTask: (task: Task) => void;
  export let applyGlobalSearch: (q: string) => void;
  export let t: (key: string, values?: any) => string;

  export let createTask: () => void;
  export let startTimer: () => void;
  export let openQuickNotes: () => void;
  export let openBookmarks: () => void;
  export let openWhiteboard: () => void;
  export let dailyReflect: () => void;
  export let openPageSize: () => void;

  const dispatch = createEventDispatcher();
  let commandQuery = "";
  let commandSelectedIndex = 0;
  let commandInputRef: HTMLInputElement;

  function close() {
    dispatch("close");
    commandQuery = "";
    commandSelectedIndex = 0;
  }

  $: if (open && commandInputRef) {
    setTimeout(() => commandInputRef?.focus(), 50);
  }

  function getCommandCategoryLabel(
    category: CommandPaletteItem["category"],
  ): string {
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

  const baseCommandPaletteItems: CommandPaletteItem[] = [
    {
      id: "create-task",
      label: t("commandPalette__create_task_label"),
      description: t("commandPalette__create_task_desc"),
      keywords: ["new task", "add task", "create task"],
      category: "command",
      icon: Plus,
      run: () => createTask(),
    },
    {
      id: "start-timer",
      label: t("commandPalette__start_timer_label"),
      description: t("commandPalette__start_timer_desc"),
      keywords: ["timer", "start timer", "in progress", "focus"],
      category: "command",
      icon: Play,
      run: () => startTimer(),
    },
    {
      id: "view-kanban",
      label: t("page__view_kanban"),
      description: "Switch to Board view",
      keywords: ["board", "kanban", "column", "view"],
      category: "command",
      icon: Trello,
      run: () => switchView("kanban"),
    },
    {
      id: "view-list",
      label: t("page__view_list"),
      description: "Switch to List view",
      keywords: ["table", "rows", "view"],
      category: "command",
      icon: ListIcon,
      run: () => switchView("list"),
    },
    {
      id: "view-calendar",
      label: t("page__view_calendar"),
      description: "Switch to Calendar view",
      keywords: ["schedule", "dates", "view"],
      category: "command",
      icon: Calendar,
      run: () => switchView("calendar"),
    },
    {
      id: "view-table",
      label: t("page__view_table"),
      description: "Switch to Advanced Table view",
      keywords: ["spreadsheet", "grid", "detailed"],
      category: "command",
      icon: LayoutGrid,
      run: () => switchView("table"),
    },
    {
      id: "view-gantt",
      label: t("page__view_gantt"),
      description: "Switch to Gantt Chart view",
      keywords: ["timeline", "roadmap", "schedule"],
      category: "command",
      icon: BarChart3,
      run: () => switchView("gantt"),
    },
    {
      id: "toggle-theme",
      label: t("page__btn_theme"),
      description: "Toggle Light/Dark mode",
      keywords: ["dark", "light", "appearance", "mode"],
      category: "command",
      icon: Sun,
      run: () => toggleTheme(),
    },
    {
      id: "open-quick-notes",
      label: t("commandPalette__quick_notes_label"),
      description: t("commandPalette__quick_notes_desc"),
      keywords: ["quick note", "note", "memo", "sticky"],
      category: "command",
      icon: FileText,
      run: () => openQuickNotes(),
    },
    {
      id: "open-bookmarks",
      label: t("commandPalette__bookmarks_label"),
      description: t("commandPalette__bookmarks_desc"),
      keywords: ["bookmark", "link", "saved links"],
      category: "command",
      icon: Bookmark,
      run: () => openBookmarks(),
    },
    {
      id: "open-whiteboard",
      label: t("commandPalette__whiteboard_label"),
      description: t("commandPalette__whiteboard_desc"),
      keywords: ["whiteboard", "draw", "sketch", "canvas"],
      category: "command",
      icon: Presentation,
      run: () => openWhiteboard(),
    },
    {
      id: "daily-reflect",
      label: t("dailyReflect__title"),
      description: t("dailyReflect__subtitle"),
      keywords: ["standup", "daily report", "summary", "reflect"],
      category: "command",
      icon: MessageSquareQuote,
      run: () => dailyReflect(),
    },
    {
      id: "set-page-size",
      label: t("pagination__set_limit"),
      description: t("pagination__set_limit_desc"),
      keywords: ["pagination", "limit", "page size", "งานต่อหน้า"],
      category: "command",
      icon: Settings2,
      run: () => openPageSize(),
    },
    {
      id: "clear-filters",
      label: t("page__btn_clear"),
      description: "Reset all active filters",
      keywords: ["reset", "all", "filter", "clear"],
      category: "command",
      icon: ArrowRight,
      run: () => {
        dispatch("clearFilters");
      },
    },
  ];

  $: normalizedCommandQuery = normalizeForCommandSearch(commandQuery.trim());

  $: dynamicCommandPaletteItems = (() => {
    if (!normalizedCommandQuery) return [] as CommandPaletteItem[];

    const sprintNameById = new Map(
      sprints
        .filter((sprint) => sprint.id !== undefined)
        .map((sprint) => [String(sprint.id), sprint.name]),
    );

    const taskItems: { score: number; item: CommandPaletteItem }[] = [];
    for (const task of tasks) {
      if (task.id === undefined) continue;
      const sprintName = task.sprint_id
        ? sprintNameById.get(String(task.sprint_id)) || ""
        : "";
      const taskSearchText = normalizeForCommandSearch(
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
      const score = getFuzzyScore(normalizedCommandQuery, taskSearchText);
      if (score === null) continue;

      taskItems.push({
        score,
        item: {
          id: `task-${task.id}`,
          label: t("commandPalette__open_task_label", {
            values: { title: task.title },
          }),
          description: `${task.project || t("commandPalette__no_project")} · ${task.status}`,
          keywords: [
            task.title,
            task.project || "",
            task.category || "",
            task.assignee?.name || "",
            sprintName,
          ],
          category: "task",
          project: task.project || t("commandPalette__no_project"),
          status: task.status,
          icon: CheckCircle,
          run: () => openTask(task),
        },
      });
    }

    const topTaskItems = taskItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.item);

    const projectItems: { score: number; item: CommandPaletteItem }[] = [];
    for (const project of projects) {
      const score = getFuzzyScore(
        normalizedCommandQuery,
        normalizeForCommandSearch(project.name),
      );
      if (score === null) continue;
      projectItems.push({
        score,
        item: {
          id: `project-${project.id ?? project.name}`,
          label: t("commandPalette__filter_project_label", {
            values: { name: project.name },
          }),
          description: t("commandPalette__filter_project_desc"),
          keywords: [project.name, "project", "filter"],
          category: "project",
          project: project.name,
          icon: Folder,
          run: () => {
            dispatch("filterProject", { project: project.name });
          },
        },
      });
    }

    const topProjectItems = projectItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item);

    const assigneeItems: { score: number; item: CommandPaletteItem }[] = [];
    for (const assignee of assignees) {
      if (assignee.id === undefined) continue;
      const score = getFuzzyScore(
        normalizedCommandQuery,
        normalizeForCommandSearch(assignee.name),
      );
      if (score === null) continue;
      assigneeItems.push({
        score,
        item: {
          id: `assignee-${assignee.id}`,
          label: t("commandPalette__filter_assignee_label", {
            values: { name: assignee.name },
          }),
          description: t("commandPalette__filter_assignee_desc"),
          keywords: [assignee.name, "assignee", "worker", "filter"],
          category: "assignee",
          icon: Users,
          run: () => {
            dispatch("filterAssignee", { assigneeId: assignee.id });
          },
        },
      });
    }

    const topAssigneeItems = assigneeItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item);

    const sprintItems: { score: number; item: CommandPaletteItem }[] = [];
    for (const sprint of sprints) {
      const score = getFuzzyScore(
        normalizedCommandQuery,
        normalizeForCommandSearch(sprint.name),
      );
      if (score === null) continue;
      sprintItems.push({
        score,
        item: {
          id: `sprint-filter-${sprint.id}`,
          label: t("commandPalette__go_to_sprint_label", {
            values: { name: sprint.name },
          }),
          description: t("commandPalette__go_to_sprint_desc", {
            values: { name: sprint.name },
          }),
          keywords: [sprint.name, "sprint", "filter"],
          category: "sprint",
          icon: Flag,
          run: () => {
            dispatch("filterSprint", { sprintId: sprint.id });
          },
        },
      });
    }

    const topSprintItems = sprintItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item);

    const quickSearchItem: CommandPaletteItem = {
      id: `search-all-${normalizedCommandQuery}`,
      label: t("commandPalette__search_tasks_label", {
        values: { query: commandQuery.trim() },
      }),
      description: t("commandPalette__search_tasks_desc"),
      keywords: ["search", "find", commandQuery.trim()],
      category: "search",
      icon: Search,
      run: () => applyGlobalSearch(commandQuery.trim()),
    };

    return [
      quickSearchItem,
      ...topTaskItems,
      ...topProjectItems,
      ...topAssigneeItems,
      ...topSprintItems,
    ];
  })();

  $: commandPaletteItems = [
    ...baseCommandPaletteItems,
    ...dynamicCommandPaletteItems,
  ];

  const commandPaletteCategoryOrder: CommandPaletteItem["category"][] = [
    "command",
    "search",
    "task",
    "project",
    "assignee",
    "sprint",
  ];

  $: commandPaletteFilteredItems = (() => {
    if (!normalizedCommandQuery) return commandPaletteItems;

    const scored = commandPaletteItems
      .map((item) => {
        const haystack = normalizeForCommandSearch(
          `${item.label} ${item.description} ${item.keywords.join(" ")}`,
        );
        const score = getFuzzyScore(normalizedCommandQuery, haystack);
        if (score === null) return null;
        return { item, score };
      })
      .filter(
        (entry): entry is { item: CommandPaletteItem; score: number } =>
          entry !== null,
      )
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const deduped: CommandPaletteItem[] = [];
    for (const entry of scored) {
      if (seen.has(entry.item.id)) continue;
      seen.add(entry.item.id);
      deduped.push(entry.item);
    }

    return deduped;
  })();

  $: groupedCommandPaletteItems = commandPaletteCategoryOrder
    .map((category) => ({
      category,
      label: getCommandCategoryLabel(category),
      items: commandPaletteFilteredItems.filter(
        (item) => item.category === category,
      ),
    }))
    .filter((group) => group.items.length > 0);

  function getCommandItemIndex(itemId: string): number {
    return commandPaletteFilteredItems.findIndex((item) => item.id === itemId);
  }

  $: {
    if (commandPaletteFilteredItems.length === 0) {
      commandSelectedIndex = 0;
    } else if (commandSelectedIndex >= commandPaletteFilteredItems.length) {
      commandSelectedIndex = commandPaletteFilteredItems.length - 1;
    }
  }

  async function runItem(item: CommandPaletteItem) {
    await item.run();
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        if (commandPaletteFilteredItems.length > 0) {
          commandSelectedIndex =
            (commandSelectedIndex + 1) % commandPaletteFilteredItems.length;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (commandPaletteFilteredItems.length > 0) {
          commandSelectedIndex =
            (commandSelectedIndex - 1 + commandPaletteFilteredItems.length) %
            commandPaletteFilteredItems.length;
        }
        break;
      case "Enter": {
        event.preventDefault();
        const selectedCommand =
          commandPaletteFilteredItems[commandSelectedIndex];
        if (selectedCommand) {
          void runItem(selectedCommand);
        }
        break;
      }
    }
  }

  function getCommandStatusInfo(status: string) {
    switch (status) {
      case "done":
        return {
          label: t("page__filter_status_done"),
          class:
            "bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
        };
      case "in-progress":
        return {
          label: t("page__filter_status_in_progress"),
          class:
            "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
        };
      case "in-test":
        return {
          label: t("page__filter_status_in_test"),
          class:
            "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
        };
      default:
        return {
          label: t("page__filter_status_todo"),
          class:
            "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
        };
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="fixed inset-0 bg-black/55 flex items-start justify-center z-20000 p-4 pt-[12vh] backdrop-blur-sm"
    on:click|self={close}
    role="button"
    tabindex="-1"
    aria-label="Close command palette"
  >
    <div
      class="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-2xl overflow-hidden"
    >
      <div
        class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
      >
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          ⌨️ {t("commandPalette__title")}
        </p>
        <kbd
          class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300"
          >⌘K / Ctrl+K</kbd
        >
      </div>

      <div class="p-4 border-b border-gray-100 dark:border-gray-800">
        <input
          bind:this={commandInputRef}
          bind:value={commandQuery}
          type="text"
          placeholder={t("commandPalette__placeholder_dynamic")}
          class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div class="max-h-[48vh] overflow-y-auto p-2">
        {#if commandPaletteFilteredItems.length === 0}
          <div
            class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            {t("commandPalette__no_results_dynamic")}
          </div>
        {:else}
          {#each groupedCommandPaletteItems as group}
            <div
              class="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              {group.label}
            </div>
            {#each group.items as item}
              {@const itemIndex = getCommandItemIndex(item.id)}
              <button
                on:click={() => runItem(item)}
                on:mouseenter={() => {
                  if (itemIndex >= 0) commandSelectedIndex = itemIndex;
                }}
                class="w-full text-left px-4 py-3 rounded-xl transition-colors mb-1 {itemIndex ===
                commandSelectedIndex
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'}"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="shrink-0 p-2 rounded-lg {itemIndex ===
                    commandSelectedIndex
                      ? 'bg-primary/20 text-primary'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}"
                  >
                    {#if item.icon}
                      <svelte:component this={item.icon} size={18} />
                    {:else}
                      <Sparkles size={18} />
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                    >
                      {item.label}
                    </p>
                    {#if item.project}
                      <div class="flex items-center gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5 font-bold">
                          <span
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                          >
                            <Folder size={10} />
                            {item.project}
                          </span>

                          {#if item.status}
                            {@const statusInfo = getCommandStatusInfo(
                              item.status,
                            )}
                            {#if statusInfo}
                              <span
                                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border {statusInfo.class}"
                              >
                                {statusInfo.label}
                              </span>
                            {/if}
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <p
                        class="text-xs text-gray-500 dark:text-gray-400 truncate"
                      >
                        {item.description}
                      </p>
                    {/if}
                  </div>
                  <span
                    class="text-[10px] uppercase tracking-wide text-gray-400"
                    >Enter</span
                  >
                </div>
              </button>
            {/each}
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
