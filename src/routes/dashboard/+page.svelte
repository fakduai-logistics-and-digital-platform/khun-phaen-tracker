<script lang="ts">
  import { onMount } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { locale } from "$lib/i18n";
  import { user, authLoading } from "$lib/stores/auth";
  import { _ } from "$lib/i18n";
  import { api } from "$lib/apis";
  import {
    MY_TASKS_WORKSPACE_ID,
    setWorkspaceId,
  } from "$lib/stores/workspace";
  import WorkspaceSettings from "$lib/components/WorkspaceSettings.svelte";
  import {
    Plus,
    LayoutTemplate,
    ArrowRight,
    Loader2,
    FolderOpen,
    Pencil,
    Trash2,
    Search,
    ArrowUpDown,
    LayoutGrid,
    List,
    Star,
    Clock,
    Layers,
    Copy,
    Check,
    Briefcase,
    Code2,
    Rocket,
    Zap,
    Heart,
    Target,
    Globe,
    Book,
    Camera,
    Coffee,
    Music,
    Smile,
  } from "lucide-svelte";

  interface Workspace {
    id: string;
    name: string;
    short_name?: string;
    room_code: string;
    created_at: string;
    owner_id: string;
    color?: string;
    icon?: string;
  }

  interface RecentEntry {
    id: string;
    name: string;
    timestamp: number;
  }

  // --- Core state ---
  let workspaces: Workspace[] = [];
  let loading = true;
  let creating = false;
  let newWorkspaceName = "";
  let showCreateModal = false;
  let error = "";

  // Edit
  let showEditModal = false;
  let editingWorkspace: Workspace | null = null;
  let editWorkspaceName = "";
  let updating = false;

  // Delete
  let showDeleteModal = false;
  let deletingWorkspace: Workspace | null = null;
  let deleting = false;

  // --- New feature state ---
  let searchQuery = "";
  let sortBy: "name_asc" | "name_desc" | "newest" | "oldest" | "recent" =
    "newest";
  let viewMode: "grid" | "list" = "grid";
  let pinnedIds: string[] = [];
  let recentEntries: RecentEntry[] = [];
  let workspaceTaskCounts: Record<string, number | null> = {};
  let showSortDropdown = false;
  let copiedId: string | null = null;
  const myTasksHub: Workspace = {
    id: MY_TASKS_WORKSPACE_ID,
    name: "โฟกัสฮับ",
    short_name: "FOCUS",
    room_code: "my-tasks",
    created_at: new Date().toISOString(),
    owner_id: "",
    color: "#0f766e",
    icon: "Target",
  };

  // Color/Icon options
  const COLORS = [
    { name: "Slate", value: "#64748b" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
  ];

  const ICON_OPTIONS_LIST = [
    { name: "Default", component: LayoutTemplate, key: "LayoutTemplate" },
    { name: "Work", component: Briefcase, key: "Briefcase" },
    { name: "Dev", component: Code2, key: "Code2" },
    { name: "Project", component: Rocket, key: "Rocket" },
    { name: "Fast", component: Zap, key: "Zap" },
    { name: "Heart", component: Heart, key: "Heart" },
    { name: "Goal", component: Target, key: "Target" },
    { name: "Global", component: Globe, key: "Globe" },
    { name: "Study", component: Book, key: "Book" },
    { name: "Photo", component: Camera, key: "Camera" },
    { name: "Relax", component: Coffee, key: "Coffee" },
    { name: "Art", component: Music, key: "Music" },
    { name: "Personal", component: Smile, key: "Smile" },
  ];

  const ICON_MAP: Record<string, any> = {
    LayoutTemplate: LayoutTemplate,
    Briefcase: Briefcase,
    Code2: Code2,
    Rocket: Rocket,
    Zap: Zap,
    Heart: Heart,
    Target: Target,
    Globe: Globe,
    Book: Book,
    Camera: Camera,
    Coffee: Coffee,
    Music: Music,
    Smile: Smile,
  };

  function getIcon(key?: string) {
    return ICON_MAP[key || "LayoutTemplate"] || LayoutTemplate;
  }

  let newWorkspaceColor = "#6366f1"; // Indigo
  let newWorkspaceIcon = "LayoutTemplate";

  let editWorkspaceColor = "#6366f1";
  let editWorkspaceIcon = "LayoutTemplate";

  async function copyWorkspaceLink(wsId: string, roomCode: string) {
    try {
      const link = `${window.location.origin}${base}/workspace/${wsId}?room=${roomCode}`;
      await navigator.clipboard.writeText(link);
      copiedId = wsId;
      setTimeout(() => {
        if (copiedId === wsId) copiedId = null;
      }, 1500);
    } catch {}
  }

  // --- localStorage helpers ---
  function loadPinned() {
    try {
      const raw = localStorage.getItem("pinned-workspaces");
      pinnedIds = raw ? JSON.parse(raw) : [];
    } catch {
      pinnedIds = [];
    }
  }
  function savePinned() {
    localStorage.setItem("pinned-workspaces", JSON.stringify(pinnedIds));
  }
  function loadRecent() {
    try {
      const raw = localStorage.getItem("recent-workspaces");
      recentEntries = raw ? JSON.parse(raw) : [];
    } catch {
      recentEntries = [];
    }
  }
  function saveRecent() {
    localStorage.setItem("recent-workspaces", JSON.stringify(recentEntries));
  }
  function loadViewMode() {
    const raw = localStorage.getItem("dashboard-view-mode");
    if (raw === "list" || raw === "grid") viewMode = raw;
  }
  function saveViewMode() {
    localStorage.setItem("dashboard-view-mode", viewMode);
  }

  function togglePin(wsId: string) {
    if (pinnedIds.includes(wsId)) {
      pinnedIds = pinnedIds.filter((id) => id !== wsId);
    } else {
      pinnedIds = [...pinnedIds, wsId];
    }
    savePinned();
  }

  function trackRecent(ws: Workspace) {
    recentEntries = [
      { id: ws.id, name: ws.name, timestamp: Date.now() },
      ...recentEntries.filter((r) => r.id !== ws.id),
    ].slice(0, 5);
    saveRecent();
  }

  // --- Fetch ---
  onMount(() => {
    loadPinned();
    loadRecent();
    loadViewMode();

    const unsubscribe = authLoading.subscribe((isLoading) => {
      if (!isLoading) {
        if (!$user) {
          goto(`${base}/login`);
        } else {
          fetchWorkspaces();
        }
      }
    });
    return unsubscribe;
  });

  async function fetchWorkspaces() {
    loading = true;
    error = "";
    try {
      const res = await api.workspaces.getList();
      const data = await res.json();
      if (res.ok) {
        workspaces = data.workspaces || [];
        // Fetch task counts in parallel (fire-and-forget)
        fetchAllTaskCounts();
      } else {
        error = data.error || "Failed to load workspaces";
      }
    } catch (e) {
      error = "Network error fetching workspaces";
    } finally {
      loading = false;
    }
  }

  async function fetchAllTaskCounts() {
    try {
      const res = await api.workspaces.getStats();
      const data = await res.json();
      if (res.ok && data.task_counts) {
        workspaceTaskCounts = data.task_counts;
      }
    } catch {
      // silently skip
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;
    creating = true;
    error = "";
    try {
      const res = await api.workspaces.create(
        newWorkspaceName,
        newWorkspaceColor,
        newWorkspaceIcon,
      );
      const data = await res.json();
      if (res.ok && data.workspace) {
        workspaces = [...workspaces, data.workspace];
        showCreateModal = false;
        newWorkspaceName = "";
        newWorkspaceColor = "#6366f1";
        newWorkspaceIcon = "LayoutTemplate";
      } else {
        error = data.error || "Failed to create workspace";
      }
    } catch (e) {
      error = "Network error creating workspace";
    } finally {
      creating = false;
    }
  }

  function openEditModal(ws: Workspace) {
    editingWorkspace = ws;
    editWorkspaceName = ws.name;
    editWorkspaceColor = ws.color || "#6366f1";
    editWorkspaceIcon = ws.icon || "LayoutTemplate";
    showEditModal = true;
  }

  async function updateWorkspace() {
    if (!editingWorkspace || !editingWorkspace.id || !editWorkspaceName.trim())
      return;
    updating = true;
    error = "";
    try {
      const res = await api.workspaces.update(
        editingWorkspace.id,
        editWorkspaceName,
        editWorkspaceColor,
        editWorkspaceIcon,
      );
      if (res.ok) {
        workspaces = workspaces.map((ws) =>
          ws.id === editingWorkspace!.id
            ? {
                ...ws,
                name: editWorkspaceName,
                color: editWorkspaceColor,
                icon: editWorkspaceIcon,
              }
            : ws,
        );
        showEditModal = false;
        editingWorkspace = null;
        editWorkspaceName = "";
      } else {
        const data = await res.json();
        error = data.error || $_("dashboard__error_update");
      }
    } catch (e) {
      error = $_("dashboard__error_update");
    } finally {
      updating = false;
    }
  }

  function openDeleteModal(ws: Workspace) {
    deletingWorkspace = ws;
    showDeleteModal = true;
  }

  async function deleteWorkspace() {
    if (!deletingWorkspace || !deletingWorkspace.id) return;
    deleting = true;
    error = "";
    try {
      const res = await api.workspaces.delete(deletingWorkspace.id);
      if (res.ok) {
        workspaces = workspaces.filter((ws) => ws.id !== deletingWorkspace!.id);
        // Clean up pinned & recent
        pinnedIds = pinnedIds.filter((id) => id !== deletingWorkspace!.id);
        savePinned();
        recentEntries = recentEntries.filter(
          (r) => r.id !== deletingWorkspace!.id,
        );
        saveRecent();
        showDeleteModal = false;
        deletingWorkspace = null;
      } else {
        const data = await res.json();
        error = data.error || $_("dashboard__error_delete");
      }
    } catch (e) {
      error = $_("dashboard__error_delete");
    } finally {
      deleting = false;
    }
  }

  function enterWorkspace(workspace: Workspace) {
    if (workspace.id === MY_TASKS_WORKSPACE_ID) {
      setWorkspaceId(
        workspace.id,
        workspace.name,
        workspace.owner_id,
        workspace.color,
        workspace.icon,
        workspace.short_name,
      );
      goto(`${base}/workspace/${workspace.id}`);
      return;
    }
    trackRecent(workspace);
    if (workspace.id) {
      setWorkspaceId(
        workspace.id,
        workspace.name,
        workspace.owner_id,
        workspace.color,
        workspace.icon,
        workspace.short_name,
      );
    }
    localStorage.setItem("sync-room-code", workspace.room_code);
    localStorage.setItem(
      "backend-server-url",
      import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:3002",
    );
    const targetUrl = `${base}/workspace/${workspace.id}?room=${workspace.room_code}`;
    window.location.href = targetUrl;
  }

  // --- Reactive: filter + sort ---
  $: filteredWorkspaces = (() => {
    let result = workspaces;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((ws) => ws.name.toLowerCase().includes(q));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "newest":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "recent": {
          const aRecent =
            recentEntries.find((r) => r.id === a.id)?.timestamp ?? 0;
          const bRecent =
            recentEntries.find((r) => r.id === b.id)?.timestamp ?? 0;
          return bRecent - aRecent;
        }
        default:
          return 0;
      }
    });

    return result;
  })();

  $: pinnedWorkspaces = filteredWorkspaces.filter((ws) =>
    pinnedIds.includes(ws.id),
  );
  $: unpinnedWorkspaces = filteredWorkspaces.filter(
    (ws) => !pinnedIds.includes(ws.id),
  );
  $: recentWorkspaces = recentEntries
    .map((r) => workspaces.find((ws) => ws.id === r.id))
    .filter((ws): ws is Workspace => !!ws)
    .slice(0, 5);

  // Format date
  function formatCreatedAt(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if ($locale === "th") {
        return d.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "2-digit",
        });
      }
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // Sort options for dropdown
  const sortOptions = [
    { value: "newest", key: "dashboard__sort_newest" },
    { value: "oldest", key: "dashboard__sort_oldest" },
    { value: "name_asc", key: "dashboard__sort_name_asc" },
    { value: "name_desc", key: "dashboard__sort_name_desc" },
    { value: "recent", key: "dashboard__sort_recent" },
  ] as const;
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 rounded-2xl">
  <div class="w-full mx-auto space-y-6">
    <!-- Header Section -->
    <header class="overflow-hidden rounded-[30px] border border-slate-200 bg-white text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-slate-950 dark:text-white dark:shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
      <div class="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.20),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_48%,_#c7d2fe_100%)] px-6 py-7 dark:bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.28),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_48%,_#1e1b4b_100%)] sm:px-8">
        <div
          class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div class="min-w-0">
            <div class="mb-4 inline-flex rounded-2xl bg-white/70 p-3 text-slate-700 ring-1 ring-slate-200/80 backdrop-blur dark:bg-white/10 dark:text-white dark:ring-white/15">
              <Layers size={22} />
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <h1
                class="text-2xl md:text-3xl font-bold tracking-tight"
              >
                {$_("dashboard__title")}
              </h1>
              <span class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                {workspaces.length} {$_("dashboard__stats_total_workspaces")}
              </span>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300/85 md:text-base">
              {#if $user}
                {$_("dashboard__welcome").replace("{email}", $user.email)}
              {:else}
                {$_("dashboard__loading_user")}
              {/if}
            </p>
          </div>

          <div class="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[300px]">
            <button
              type="button"
              on:click={() => enterWorkspace(myTasksHub)}
              class="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-teal-950 shadow-[0_10px_24px_rgba(15,118,110,0.08)] transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 active:scale-95 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-100 dark:shadow-[0_14px_30px_rgba(13,148,136,0.12)] dark:hover:bg-teal-500/15 dark:hover:text-white"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-400/12 dark:text-teal-200">
                  <Target size={17} />
                </div>
                <span class="truncate text-sm font-semibold">
                  {$_("dashboard__hub_name")}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-400/14 dark:text-teal-100/90">
                  {workspaceTaskCounts[MY_TASKS_WORKSPACE_ID] ?? 0}
                </span>
                <ArrowRight
                  size={16}
                  class="text-teal-700 dark:text-teal-100/80"
                />
              </div>
            </button>

            <button
              on:click={() => (showCreateModal = true)}
              class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-300 bg-[linear-gradient(135deg,_#635bff,_#4f46e5)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(99,91,255,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(99,91,255,0.30)] active:scale-95 dark:border-indigo-400/20 dark:bg-indigo-500 dark:ring-indigo-400/30 dark:hover:bg-indigo-400"
            >
              <Plus size={18} />
              {$_("dashboard__btn_create")}
            </button>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            >
              <Layers size={18} />
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {$_("dashboard__stats_total_workspaces")}
              </p>
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {workspaces.length}
              </p>
            </div>
          </div>
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            >
              <Star size={18} />
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {$_("dashboard__stats_pinned")}
              </p>
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {pinnedIds.filter((id) => workspaces.some((ws) => ws.id === id))
                  .length}
              </p>
            </div>
          </div>
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              <Clock size={18} />
            </div>
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {$_("dashboard__stats_recent")}
              </p>
              <p class="text-lg font-bold text-slate-900 dark:text-white">
                {recentWorkspaces.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    {#if loading || $authLoading}
      <div
        class="flex flex-col items-center justify-center py-20 text-slate-400"
      >
        <Loader2 class="w-10 h-10 animate-spin mb-4" />
        <p>{$_("dashboard__loading_projects")}</p>
      </div>
    {:else if error}
      <div
        class="p-4 bg-red-50 text-red-600 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl"
      >
        {error}
      </div>
    {:else if workspaces.length === 0}
      <div
        class="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50"
      >
        <FolderOpen
          class="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-4"
        />
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white mb-2">
          {$_("dashboard__empty_title")}
        </h3>
        <p class="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          {$_("dashboard__empty_desc")}
        </p>
        <button
          on:click={() => (showCreateModal = true)}
          class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 text-sm font-semibold rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
        >
          <Plus size={16} />
          {$_("dashboard__btn_new")}
        </button>
      </div>
    {:else}
      <!-- Search / Sort / View Toggle Toolbar -->
      <div
        class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end"
      >
        <div class="relative sm:w-56">
          <Search
            size={16}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={$_("dashboard__search_placeholder")}
            class="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <div class="relative">
          <button
            type="button"
            on:click={() => (showSortDropdown = !showSortDropdown)}
            class="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowUpDown size={14} class="text-slate-400 shrink-0" />
            <span
              >{$_(
                sortOptions.find((o) => o.value === sortBy)?.key ??
                  "dashboard__sort_newest",
              )}</span
            >
          </button>

          {#if showSortDropdown}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="fixed inset-0 z-10"
              on:click={() => (showSortDropdown = false)}
            ></div>
            <div
              class="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-20 animate-fade-in"
            >
              {#each sortOptions as opt}
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm transition-colors {sortBy ===
                  opt.value
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                  on:click={() => {
                    sortBy = opt.value;
                    showSortDropdown = false;
                  }}
                >
                  {$_(opt.key)}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div
          class="flex border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
        >
          <button
            on:click={() => {
              viewMode = "grid";
              saveViewMode();
            }}
            class="p-2 transition-colors {viewMode === 'grid'
              ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}"
            title={$_("dashboard__view_grid")}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            on:click={() => {
              viewMode = "list";
              saveViewMode();
            }}
            class="p-2 transition-colors border-l border-slate-200 dark:border-slate-800 {viewMode ===
            'list'
              ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}"
            title={$_("dashboard__view_list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <!-- Recently Opened (horizontal scroll) -->
      {#if recentWorkspaces.length > 0 && !searchQuery.trim()}
        <section>
          <h2
            class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5"
          >
            <Clock size={12} />
            {$_("dashboard__recent_section")}
          </h2>
          <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {#each recentWorkspaces as ws}
              <button
                on:click={() => enterWorkspace(ws)}
                class="shrink-0 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 hover:shadow-md transition-shadow text-left group"
              >
                <div class="flex items-center gap-2.5 mb-2">
                  <div
                    class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style="background-color: {ws.color
                      ? ws.color + '1a'
                      : '#10b9811a'}; color: {ws.color || '#10b981'}"
                  >
                    <svelte:component this={getIcon(ws.icon)} size={14} />
                  </div>
                  <span
                    class="text-sm font-semibold text-slate-900 dark:text-white truncate"
                    >{ws.name}</span
                  >
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-slate-400">
                    {formatCreatedAt(ws.created_at)}
                  </span>
                  <ArrowRight
                    size={12}
                    class="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <hr class="border-slate-200 dark:border-slate-800" />

      <!-- No results -->
      {#if filteredWorkspaces.length === 0}
        <div class="text-center py-12">
          <Search
            class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3"
          />
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {$_("dashboard__no_results")}
          </p>
        </div>
      {:else}
        <!-- Pinned Section -->
        {#if pinnedWorkspaces.length > 0}
          <section>
            <h2
              class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5"
            >
              <Star size={12} />
              {$_("dashboard__pinned_section")}
            </h2>
            {#if viewMode === "grid"}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each pinnedWorkspaces as ws}
                  {@const isPinned = true}
                  {@const isOwner = $user && ws.owner_id === $user.id}
                  {@const taskCount = workspaceTaskCounts[ws.id]}
                  <div class="relative group">
                    <button
                      on:click={() => enterWorkspace(ws)}
                      class="w-full text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-indigo-500"
                    >
                      <div class="mb-3">
                        <div
                          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style="background-color: {ws.color
                            ? ws.color + '1a'
                            : '#6366f11a'}; color: {ws.color || '#6366f1'}"
                        >
                          <svelte:component this={getIcon(ws.icon)} size={20} />
                        </div>
                      </div>
                      <h3
                        class="text-base font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2"
                      >
                        {ws.name}
                      </h3>
                      <div class="flex items-center gap-2 flex-wrap mb-3">
                        <span class="text-[11px] text-slate-400">
                          {$_("dashboard__card_created").replace(
                            "{date}",
                            formatCreatedAt(ws.created_at),
                          )}
                        </span>
                        {#if taskCount !== undefined && taskCount !== null}
                          <span
                            class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            {$_("dashboard__card_tasks").replace(
                              "{count}",
                              String(taskCount),
                            )}
                          </span>
                        {/if}
                        {#if isOwner}
                          <span
                            class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          >
                            {$_("dashboard__card_owner_badge")}
                          </span>
                        {:else}
                          <span
                            class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            {$_("dashboard__card_member_badge")}
                          </span>
                        {/if}
                      </div>
                      <div
                        class="mt-auto pt-3 flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50"
                      >
                        <span
                          class="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors"
                        >
                          {$_("dashboard__btn_open")}
                          <ArrowRight
                            size={14}
                            class="group-hover:translate-x-1 transition-transform"
                          />
                        </span>
                      </div>
                    </button>

                    <!-- Actions overlay -->
                    <div
                      class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-0.5"
                    >
                      <button
                        on:click|stopPropagation={() => togglePin(ws.id)}
                        class="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                        title={$_("dashboard__btn_unpin")}
                      >
                        <Star size={15} fill="currentColor" />
                      </button>
                      <button
                        on:click|stopPropagation={() =>
                          copyWorkspaceLink(ws.id, ws.room_code)}
                        class="p-1.5 rounded-lg transition-colors {copiedId ===
                        ws.id
                          ? 'text-emerald-500'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                        title={copiedId === ws.id
                          ? $_("dashboard__copy_success")
                          : $_("dashboard__btn_copy_link")}
                      >
                        {#if copiedId === ws.id}
                          <Check size={15} />
                        {:else}
                          <Copy size={15} />
                        {/if}
                      </button>
                      {#if isOwner}
                        <button
                          on:click|stopPropagation={() => openEditModal(ws)}
                          class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title={$_("dashboard__btn_edit")}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          on:click|stopPropagation={() => openDeleteModal(ws)}
                          class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                          title={$_("dashboard__btn_delete")}
                        >
                          <Trash2 size={15} />
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <!-- List view for pinned -->
              <div class="space-y-2">
                {#each pinnedWorkspaces as ws}
                  {@const isOwner = $user && ws.owner_id === $user.id}
                  {@const taskCount = workspaceTaskCounts[ws.id]}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div
                    on:click={() => enterWorkspace(ws)}
                    class="w-full text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-4 group cursor-pointer"
                  >
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style="background-color: {ws.color
                        ? ws.color + '1a'
                        : '#6366f11a'}; color: {ws.color || '#6366f1'}"
                    >
                      <svelte:component this={getIcon(ws.icon)} size={18} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3
                        class="text-sm font-semibold text-slate-900 dark:text-white truncate"
                      >
                        {ws.name}
                      </h3>
                      <p class="text-[11px] text-slate-400">
                        {$_("dashboard__card_created").replace(
                          "{date}",
                          formatCreatedAt(ws.created_at),
                        )}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      {#if taskCount !== undefined && taskCount !== null}
                        <span
                          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        >
                          {$_("dashboard__card_tasks").replace(
                            "{count}",
                            String(taskCount),
                          )}
                        </span>
                      {/if}
                      {#if isOwner}
                        <span
                          class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          >{$_("dashboard__card_owner_badge")}</span
                        >
                      {:else}
                        <span
                          class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"
                          >{$_("dashboard__card_member_badge")}</span
                        >
                      {/if}
                      <button
                        on:click|stopPropagation={() => togglePin(ws.id)}
                        class="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                        title={$_("dashboard__btn_unpin")}
                      >
                        <Star size={14} fill="currentColor" />
                      </button>
                      <button
                        on:click|stopPropagation={() =>
                          copyWorkspaceLink(ws.id, ws.room_code)}
                        class="p-1 rounded-lg transition-colors {copiedId ===
                        ws.id
                          ? 'text-emerald-500'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                        title={copiedId === ws.id
                          ? $_("dashboard__copy_success")
                          : $_("dashboard__btn_copy_link")}
                      >
                        {#if copiedId === ws.id}
                          <Check size={14} />
                        {:else}
                          <Copy size={14} />
                        {/if}
                      </button>
                      {#if isOwner}
                        <button
                          on:click|stopPropagation={() => openEditModal(ws)}
                          class="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                          title={$_("dashboard__btn_edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          on:click|stopPropagation={() => openDeleteModal(ws)}
                          class="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title={$_("dashboard__btn_delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      {/if}
                      <ArrowRight
                        size={14}
                        class="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        <!-- All Workspaces Section -->
        {#if unpinnedWorkspaces.length > 0}
          <section>
            {#if pinnedWorkspaces.length > 0}
              <h2
                class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5"
              >
                <Layers size={12} />
                {$_("dashboard__all_section")}
              </h2>
            {/if}

            {#if viewMode === "grid"}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each unpinnedWorkspaces as ws}
                  {@const isOwner = $user && ws.owner_id === $user.id}
                  {@const taskCount = workspaceTaskCounts[ws.id]}
                  <div class="relative group">
                    <button
                      on:click={() => enterWorkspace(ws)}
                      class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-indigo-500"
                    >
                      <div class="mb-3">
                        <div
                          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style="background-color: {ws.color
                            ? ws.color + '1a'
                            : '#6366f11a'}; color: {ws.color || '#6366f1'}"
                        >
                          <svelte:component this={getIcon(ws.icon)} size={20} />
                        </div>
                      </div>
                      <h3
                        class="text-base font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2"
                      >
                        {ws.name}
                      </h3>
                      <div class="flex items-center gap-2 flex-wrap mb-3">
                        <span class="text-[11px] text-slate-400">
                          {$_("dashboard__card_created").replace(
                            "{date}",
                            formatCreatedAt(ws.created_at),
                          )}
                        </span>
                        {#if taskCount !== undefined && taskCount !== null}
                          <span
                            class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            {$_("dashboard__card_tasks").replace(
                              "{count}",
                              String(taskCount),
                            )}
                          </span>
                        {/if}
                        {#if isOwner}
                          <span
                            class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          >
                            {$_("dashboard__card_owner_badge")}
                          </span>
                        {:else}
                          <span
                            class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            {$_("dashboard__card_member_badge")}
                          </span>
                        {/if}
                      </div>
                      <div
                        class="mt-auto pt-3 flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50"
                      >
                        <span
                          class="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors"
                        >
                          {$_("dashboard__btn_open")}
                          <ArrowRight
                            size={14}
                            class="group-hover:translate-x-1 transition-transform"
                          />
                        </span>
                      </div>
                    </button>

                    <!-- Actions overlay -->
                    <div
                      class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-0.5"
                    >
                      <button
                        on:click|stopPropagation={() => togglePin(ws.id)}
                        class="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                        title={$_("dashboard__btn_pin")}
                      >
                        <Star size={15} />
                      </button>
                      <button
                        on:click|stopPropagation={() =>
                          copyWorkspaceLink(ws.id, ws.room_code)}
                        class="p-1.5 rounded-lg transition-colors {copiedId ===
                        ws.id
                          ? 'text-emerald-500'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                        title={copiedId === ws.id
                          ? $_("dashboard__copy_success")
                          : $_("dashboard__btn_copy_link")}
                      >
                        {#if copiedId === ws.id}
                          <Check size={15} />
                        {:else}
                          <Copy size={15} />
                        {/if}
                      </button>
                      {#if isOwner}
                        <button
                          on:click|stopPropagation={() => openEditModal(ws)}
                          class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title={$_("dashboard__btn_edit")}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          on:click|stopPropagation={() => openDeleteModal(ws)}
                          class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                          title={$_("dashboard__btn_delete")}
                        >
                          <Trash2 size={15} />
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <!-- List view -->
              <div class="space-y-2">
                {#each unpinnedWorkspaces as ws}
                  {@const isOwner = $user && ws.owner_id === $user.id}
                  {@const taskCount = workspaceTaskCounts[ws.id]}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div
                    on:click={() => enterWorkspace(ws)}
                    class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-4 group cursor-pointer"
                  >
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style="background-color: {ws.color
                        ? ws.color + '1a'
                        : '#6366f11a'}; color: {ws.color || '#6366f1'}"
                    >
                      <svelte:component this={getIcon(ws.icon)} size={18} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3
                        class="text-sm font-semibold text-slate-900 dark:text-white truncate"
                      >
                        {ws.name}
                      </h3>
                      <p class="text-[11px] text-slate-400">
                        {$_("dashboard__card_created").replace(
                          "{date}",
                          formatCreatedAt(ws.created_at),
                        )}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      {#if taskCount !== undefined && taskCount !== null}
                        <span
                          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        >
                          {$_("dashboard__card_tasks").replace(
                            "{count}",
                            String(taskCount),
                          )}
                        </span>
                      {/if}
                      {#if isOwner}
                        <span
                          class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          >{$_("dashboard__card_owner_badge")}</span
                        >
                      {:else}
                        <span
                          class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"
                          >{$_("dashboard__card_member_badge")}</span
                        >
                      {/if}
                      <button
                        on:click|stopPropagation={() => togglePin(ws.id)}
                        class="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                        title={$_("dashboard__btn_pin")}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        on:click|stopPropagation={() =>
                          copyWorkspaceLink(ws.id, ws.room_code)}
                        class="p-1 rounded-lg transition-colors {copiedId ===
                        ws.id
                          ? 'text-emerald-500'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                        title={copiedId === ws.id
                          ? $_("dashboard__copy_success")
                          : $_("dashboard__btn_copy_link")}
                      >
                        {#if copiedId === ws.id}
                          <Check size={14} />
                        {:else}
                          <Copy size={14} />
                        {/if}
                      </button>
                      {#if isOwner}
                        <button
                          on:click|stopPropagation={() => openEditModal(ws)}
                          class="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                          title={$_("dashboard__btn_edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          on:click|stopPropagation={() => openDeleteModal(ws)}
                          class="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title={$_("dashboard__btn_delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      {/if}
                      <ArrowRight
                        size={14}
                        class="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
    role="button"
    tabindex="-1"
    aria-label="Close modal"
    transition:fade={{ duration: 200 }}
    on:click|self={() => (showCreateModal = false)}
  >
    <div
      class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      transition:scale={{ duration: 300, start: 0.95 }}
    >
      <!-- Header -->
      <div
        class="px-8 py-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
      >
        <div class="flex items-center gap-4">
          <div class="p-3.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
            <Plus size={24} />
          </div>
          <div>
            <h2
              class="text-xl font-black text-slate-900 dark:text-white tracking-tight"
            >
              {$_("dashboard__modal_title")}
            </h2>
            <p
              class="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60"
            >
              {$_("dashboard__modal_create_subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div class="p-8 space-y-8">
        <form on:submit|preventDefault={createWorkspace} class="space-y-8">
          <div class="space-y-4">
            <label
              for="name"
              class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1"
              >{$_("dashboard__modal_name_label")}</label
            >
            <input
              id="name"
              type="text"
              bind:value={newWorkspaceName}
              placeholder={$_("dashboard__modal_name_placeholder")}
              class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-slate-900 dark:text-white font-bold transition-all placeholder:text-slate-400/50"
              required
            />
          </div>

          <div class="space-y-4">
            <span
              class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1"
              >{$_("dashboard__modal_color_label")}</span
            >
            <div class="flex flex-wrap gap-2.5">
              {#each COLORS as c}
                <button
                  type="button"
                  on:click={() => (newWorkspaceColor = c.value)}
                  class="w-7 h-7 rounded-full border-2 transition-all hover:scale-125 {newWorkspaceColor ===
                  c.value
                    ? 'border-indigo-500 scale-125 ring-4 ring-indigo-500/20'
                    : 'border-transparent opacity-60 hover:opacity-100'}"
                  style="background-color: {c.value}"
                  aria-label="Select color {c.name}"
                ></button>
              {/each}
            </div>
          </div>

          <div class="space-y-4">
            <span
              class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1"
              >{$_("dashboard__modal_icon_label")}</span
            >
            <div class="grid grid-cols-7 gap-2">
              {#each ICON_OPTIONS_LIST as opt}
                <button
                  type="button"
                  on:click={() => (newWorkspaceIcon = opt.key)}
                  class="flex items-center justify-center aspect-square rounded-xl border-2 transition-all {newWorkspaceIcon ===
                  opt.key
                    ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500 scale-110 shadow-lg shadow-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
                  aria-label="Select icon {opt.key}"
                >
                  <svelte:component this={opt.component} size={18} />
                </button>
              {/each}
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="button"
              on:click={() => (showCreateModal = false)}
              class="flex-1 px-6 py-4 text-sm font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              {$_("dashboard__modal_btn_cancel")}
            </button>
            <button
              type="submit"
              disabled={creating || !newWorkspaceName.trim()}
              class="flex-1 inline-flex justify-center items-center px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
            >
              {#if creating}
                <Loader2 class="w-5 h-5 animate-spin" />
              {:else}
                {$_("dashboard__modal_btn_create_space")}
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal (Now uses Shared Component) -->
{#if showEditModal && editingWorkspace}
  <WorkspaceSettings
    workspaceId={editingWorkspace.id}
    on:close={() => {
      showEditModal = false;
      editingWorkspace = null;
    }}
    on:workspaceUpdated={() => {
      fetchWorkspaces();
      showEditModal = false;
      editingWorkspace = null;
    }}
  />
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="button"
    tabindex="-1"
    aria-label="Close modal"
    on:click|self={() => (showDeleteModal = false)}
  >
    <div
      class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
    >
      <div class="px-6 py-6 text-center">
        <div
          class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4"
        >
          <Trash2 size={24} />
        </div>

        <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {$_("dashboard__modal_delete_title")}
        </h2>

        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {$_("dashboard__modal_delete_warning")}
        </p>

        <div class="flex gap-3">
          <button
            type="button"
            on:click={() => (showDeleteModal = false)}
            class="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
          >
            {$_("dashboard__modal_btn_cancel")}
          </button>
          <button
            type="button"
            on:click={deleteWorkspace}
            disabled={deleting}
            class="flex-1 inline-flex justify-center items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            {#if deleting}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else}
              {$_("dashboard__modal_btn_delete_confirm")}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
</style>
