"use client";

import { withBase } from "@/lib/base-path";
import { setWorkspaceRoom } from "@/lib/room";
import { workspacePath } from "@/lib/routes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, FolderOpen, Layers, Loader2, Plus, Search, Star } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { Search as HeaderSearch } from "@/components/search";
import { PaletteSwitch } from "@/components/palette-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardToolbar, type SortKey } from "@/components/dashboard/dashboard-toolbar";
import { DeleteWorkspaceDialog } from "@/components/dashboard/delete-workspace-dialog";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { WorkspaceFormDialog, type WorkspaceFormValues } from "@/components/dashboard/workspace-form-dialog";
import { WorkspaceSettings } from "@/components/workspace-modals/workspace-settings";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  loadPinned,
  loadRecent,
  loadViewMode,
  savePinned,
  saveRecent,
  saveViewMode,
  type RecentEntry,
  type ViewMode,
} from "@/lib/dashboard/storage";
import { getWorkspaceIcon } from "@/lib/dashboard/workspace-options";
import { useI18n } from "@/lib/i18n";
import { MY_TASKS_WORKSPACE_ID, setWorkspaceId, type Workspace } from "@/lib/workspace";

const MY_TASKS_HUB: Workspace = {
  id: MY_TASKS_WORKSPACE_ID,
  name: "โฟกัสฮับ",
  short_name: "FOCUS",
  room_code: "my-tasks",
  created_at: "",
  owner_id: "",
  color: "#0f766e",
  icon: "Target",
};

const SECTION_TITLE = "mb-3 flex items-center gap-2 text-sm text-muted-foreground";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskCounts, setTaskCounts] = useState<Record<string, number | null>>({});

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    document.title = t("meta__dashboard_title");
  }, [t]);

  useEffect(() => {
    setPinnedIds(loadPinned());
    setRecent(loadRecent());
    setViewMode(loadViewMode());
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.workspaces.getList();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load workspaces");
        return;
      }
      setWorkspaces(data.workspaces || []);
      api.workspaces
        .getStats()
        .then(async (statsRes) => {
          const stats = await statsRes.json();
          if (statsRes.ok && stats.task_counts) setTaskCounts(stats.task_counts);
        })
        .catch(() => {});
    } catch {
      setError("Network error fetching workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) void fetchWorkspaces();
  }, [authLoading, user, fetchWorkspaces]);

  function togglePin(id: string) {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((p) => p !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    savePinned(next);
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    saveViewMode(mode);
  }

  async function copyLink(ws: Workspace) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${withBase(workspacePath(ws.id))}&room=${ws.room_code}`,
      );
      setCopiedId(ws.id);
      setTimeout(() => setCopiedId((current) => (current === ws.id ? null : current)), 1500);
    } catch {
      /* Clipboard access can be denied; the button simply does not confirm. */
    }
  }

  function enterWorkspace(ws: Workspace) {
    setWorkspaceId(ws.id, ws.name, ws.owner_id, ws.color, ws.icon, ws.short_name);
    if (ws.id === MY_TASKS_WORKSPACE_ID) {
      router.push(workspacePath(ws.id));
      return;
    }
    const next = [{ id: ws.id, name: ws.name, timestamp: Date.now() }, ...recent.filter((r) => r.id !== ws.id)].slice(
      0,
      5,
    );
    setRecent(next);
    saveRecent(next);
    setWorkspaceRoom(ws.id, ws.room_code);
    localStorage.setItem("backend-server-url", process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:3002");
    router.push(workspacePath(ws.id));
  }

  async function submitForm(values: WorkspaceFormValues) {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.workspaces.create(values.name, values.color, values.icon);
      const data = await res.json();
      if (!res.ok || !data.workspace) {
        setError(data.error || "Failed to create workspace");
        return;
      }
      setWorkspaces((list) => [...list, data.workspace]);
      setFormOpen(false);
    } catch {
      setError("Network error creating workspace");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setError("");
    try {
      const res = await api.workspaces.delete(deleting.id);
      if (!res.ok) {
        setError((await res.json()).error || t("dashboard__error_delete"));
        return;
      }
      const id = deleting.id;
      setWorkspaces((list) => list.filter((ws) => ws.id !== id));
      const nextPinned = pinnedIds.filter((p) => p !== id);
      const nextRecent = recent.filter((r) => r.id !== id);
      setPinnedIds(nextPinned);
      savePinned(nextPinned);
      setRecent(nextRecent);
      saveRecent(nextRecent);
      setDeleting(null);
    } catch {
      setError(t("dashboard__error_delete"));
    } finally {
      setDeletePending(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? workspaces.filter((ws) => ws.name.toLowerCase().includes(q)) : workspaces;
    const time = (s: string) => new Date(s).getTime();
    const lastOpened = (id: string) => recent.find((r) => r.id === id)?.timestamp ?? 0;
    return [...matches].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "oldest":
          return time(a.created_at) - time(b.created_at);
        case "recent":
          return lastOpened(b.id) - lastOpened(a.id);
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
  }, [workspaces, query, sortBy, recent]);

  const pinned = filtered.filter((ws) => pinnedIds.includes(ws.id));
  const unpinned = filtered.filter((ws) => !pinnedIds.includes(ws.id));
  const recentWorkspaces = recent
    .map((r) => workspaces.find((ws) => ws.id === r.id))
    .filter((ws): ws is Workspace => !!ws)
    .slice(0, 5);

  function formatCreated(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function renderCard(ws: Workspace) {
    return (
      <WorkspaceCard
        key={ws.id}
        workspace={ws}
        variant={viewMode}
        pinned={pinnedIds.includes(ws.id)}
        isOwner={!!user && (ws.owner_id === user.id || user.role === "admin")}
        taskCount={taskCounts[ws.id]}
        copied={copiedId === ws.id}
        createdLabel={formatCreated(ws.created_at)}
        onOpen={() => enterWorkspace(ws)}
        onTogglePin={() => togglePin(ws.id)}
        onCopyLink={() => copyLink(ws)}
        onEdit={() => setEditing(ws)}
        onDelete={() => setDeleting(ws)}
      />
    );
  }

  function renderGroup(list: Workspace[]) {
    return viewMode === "grid" ? (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map(renderCard)}</div>
    ) : (
      <div className="space-y-2">{list.map(renderCard)}</div>
    );
  }

  const createButton = (
    <Button variant="outline" onClick={() => setFormOpen(true)} className="gap-2 border-primary/30 text-primary">
      <Plus size={16} />
      {t("dashboard__btn_new")}
    </Button>
  );

  return (
    <AuthenticatedLayout>
      <Header>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-2">
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>
      <Main id="content" className="space-y-6">
        <div className="w-full space-y-6">
          <DashboardHeader
            total={workspaces.length}
            pinned={pinnedIds.filter((id) => workspaces.some((ws) => ws.id === id)).length}
            recent={recentWorkspaces.length}
            hubTaskCount={taskCounts[MY_TASKS_WORKSPACE_ID] ?? 0}
            onOpenHub={() => enterWorkspace({ ...MY_TASKS_HUB, created_at: new Date().toISOString() })}
            onCreate={() => setFormOpen(true)}
          />

          {loading || authLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mb-4 size-10 animate-spin" />
              <p>{t("dashboard__loading_projects")}</p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"
            >
              {error}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-4 py-16 text-center">
              <FolderOpen className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">{t("dashboard__empty_title")}</h3>
              <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">{t("dashboard__empty_desc")}</p>
              {createButton}
            </div>
          ) : (
            <>
              <DashboardToolbar
                query={query}
                sortBy={sortBy}
                viewMode={viewMode}
                onQueryChange={setQuery}
                onSortChange={setSortBy}
                onViewModeChange={changeViewMode}
              />

              {recentWorkspaces.length > 0 && !query.trim() && (
                <section>
                  <h2 className={SECTION_TITLE}>
                    <Clock size={14} />
                    {t("dashboard__recent_section")}
                  </h2>
                  <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                    {recentWorkspaces.map((ws) => {
                      const Icon = getWorkspaceIcon(ws.icon);
                      const color = ws.color || "#10b981";
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => enterWorkspace(ws)}
                          className="group w-56 shrink-0 rounded-xl border bg-card p-3 text-left transition-shadow hover:shadow-md"
                        >
                          <span className="mb-2 flex items-center gap-2.5">
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${color}1a`, color }}
                            >
                              <Icon size={14} />
                            </span>
                            <span className="truncate text-sm font-semibold">{ws.name}</span>
                          </span>
                          <span className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{formatCreated(ws.created_at)}</span>
                            <ArrowRight
                              size={12}
                              className="text-muted-foreground transition-colors group-hover:text-foreground"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <hr className="border-border" />

              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="mx-auto mb-3 size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("dashboard__no_results")}</p>
                </div>
              ) : (
                <>
                  {pinned.length > 0 && (
                    <section>
                      <h2 className={SECTION_TITLE}>
                        <Star size={14} />
                        {t("dashboard__pinned_section")}
                      </h2>
                      {renderGroup(pinned)}
                    </section>
                  )}
                  {unpinned.length > 0 && (
                    <section>
                      {pinned.length > 0 && (
                        <h2 className={SECTION_TITLE}>
                          <Layers size={14} />
                          {t("dashboard__all_section")}
                        </h2>
                      )}
                      {renderGroup(unpinned)}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Main>

      <WorkspaceFormDialog
        open={formOpen}
        workspace={null}
        submitting={submitting}
        onSubmit={submitForm}
        onClose={() => setFormOpen(false)}
      />
      {editing && (
        <WorkspaceSettings
          workspaceId={editing.id}
          initialName={editing.name}
          initialColor={editing.color}
          initialIcon={editing.icon}
          initialShortName={editing.short_name}
          onClose={() => setEditing(null)}
          onWorkspaceUpdated={() => {
            void fetchWorkspaces();
            setEditing(null);
          }}
        />
      )}
      <DeleteWorkspaceDialog
        open={deleting !== null}
        deleting={deletePending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </AuthenticatedLayout>
  );
}
