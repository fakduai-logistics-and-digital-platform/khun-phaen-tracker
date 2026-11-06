"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { BranchDialog } from "@/components/workspace-modals/branch-dialog";
import { AiPromptDialog } from "@/components/task-detail/ai-prompt-dialog";
import type { AiMode } from "@/components/task-detail/ai-prompt";
import { TaskDetailHeader } from "@/components/task-detail/task-detail-header";
import { TaskMainContent } from "@/components/task-detail/task-main-content";
import { TaskPropertiesSidebar } from "@/components/task-detail/task-properties-sidebar";
import { TaskContentSkeleton, TaskSidebarSkeleton } from "@/components/task-detail/task-skeleton";
import { useTaskComments } from "@/components/task-detail/use-task-comments";
import { useTaskData } from "@/components/task-detail/use-task-data";
import { useTaskPin } from "@/components/task-detail/use-task-pin";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { modals } from "@/lib/stores/uiActions";
import { workspacePath } from "@/lib/routes";
import { useRouteIds } from "@/lib/use-route-ids";
import { useWorkspaceRoom } from "@/lib/use-workspace-room";
import { currentWorkspaceName, currentWorkspaceShortName, MY_TASKS_WORKSPACE_ID } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border";

export default function TaskDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { workspaceId: routeWorkspaceId, taskId: routeTaskId } = useRouteIds();
  const workspaceId = routeWorkspaceId ?? "";
  const room = useWorkspaceRoom(workspaceId) ?? null;
  const taskId = routeTaskId ?? "";

  const workspaceName = useStore(currentWorkspaceName);
  const storeShortName = useStore(currentWorkspaceShortName);

  const { task, loading, error, loadVersion, projects, assignees, sprints, update, remove } = useTaskData({
    workspaceId,
    taskId,
    room,
  });
  const projectShortName = projects.find((p) => p.name === task?.project)?.short_name || "";
  const { isPinned, togglePin, shortNameFallback } = useTaskPin({ task, taskId, workspaceId, projectShortName });
  const comments = useTaskComments({ taskDbId: task?.id, loadVersion });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [branchOpen, setBranchOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode | null>(null);

  const displayShortName = projectShortName || task?.workspace_short_name || storeShortName || shortNameFallback;

  useEffect(() => {
    document.title = t("meta__task_title", { title: task ? task.title : "Task" });
  }, [t, task]);

  const workspaceHref = workspacePath(workspaceId);

  function goBack() {
    router.push(workspaceHref);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }
      if (e.key.toLowerCase() === "n" && workspaceId !== MY_TASKS_WORKSPACE_ID) {
        e.preventDefault();
        router.push(workspacePath(workspaceId));
        modals.update((m) => ({ ...m, form: true }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, workspaceId]);

  async function confirmDelete() {
    if (await remove()) goBack();
  }

  return (
    <AuthenticatedLayout>
      <Header>
        <TaskDetailHeader
          task={task}
          workspaceName={workspaceName}
          isPinned={isPinned}
          sidebarOpen={sidebarOpen}
          onBack={goBack}
          onMarkDone={() => void update({ status: "done" })}
          onOpenBranch={() => setBranchOpen(true)}
          onAskAi={setAiMode}
          onTogglePin={() => void togglePin()}
          onDelete={() => setDeleteConfirmOpen(true)}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <div className="hidden items-center gap-2 border-s ps-3 lg:flex">
          <HeaderSearch className="hidden w-40 2xl:flex" />
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main id="content" fixed fluid className="p-0">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {sidebarOpen && (
            <div
              className="absolute inset-0 z-20 bg-background/60 lg:hidden"
              role="button"
              tabIndex={0}
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
            />
          )}

          <div className={cn("flex-1 overflow-y-auto bg-background", SCROLLBAR)}>
            {loading ? (
              <TaskContentSkeleton />
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-muted-foreground">
                <Folder size={48} className="mb-4 opacity-20" />
                <p>{error}</p>
                <Button type="button" variant="link" onClick={goBack} className="mt-4">
                  {t("sidebar__back")}
                </Button>
              </div>
            ) : task ? (
              <TaskMainContent
                task={task}
                workspaceId={workspaceId}
                shortName={displayShortName}
                assignees={assignees}
                comments={comments.comments}
                commentsLoading={comments.loading}
                onUpdate={update}
                onSubmitComment={comments.submit}
                onDeleteComment={(id) => void comments.remove(id)}
              />
            ) : null}
          </div>

          {sidebarOpen && (
            <aside
              className={cn(
                "absolute inset-y-0 right-0 z-30 flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l bg-background p-6 lg:relative lg:z-auto",
                SCROLLBAR,
              )}
            >
              {loading ? (
                <TaskSidebarSkeleton />
              ) : task ? (
                <TaskPropertiesSidebar
                  task={task}
                  projects={projects}
                  assignees={assignees}
                  sprints={sprints}
                  onUpdate={(updates) => void update(updates)}
                />
              ) : null}
            </aside>
          )}
        </div>
      </Main>

      {branchOpen && task && (
        <BranchDialog
          show={branchOpen}
          title={task.title}
          workspaceShortName={task.workspace_short_name || projectShortName || storeShortName || ""}
          taskNumber={task.task_number || null}
          taskType={task.task_type}
          onClose={() => setBranchOpen(false)}
        />
      )}

      {aiMode && task && <AiPromptDialog mode={aiMode} task={task} onClose={() => setAiMode(null)} />}

      <ConfirmModal
        show={deleteConfirmOpen}
        title={t("taskDetail__delete_task")}
        message={t("taskDetail__delete_confirm")}
        confirmText={t("taskDetail__delete_confirm_yes")}
        cancelText={t("page__cancel")}
        type="danger"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </AuthenticatedLayout>
  );
}
