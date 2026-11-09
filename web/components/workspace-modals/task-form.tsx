"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, GitBranch, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { currentWorkspaceName, currentWorkspaceShortName } from "@/lib/stores/workspace";
import { taskDefaults } from "@/lib/stores/taskDefaults";
import { useStore } from "@/lib/store";
import type { Assignee, ChecklistItem, Project, Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BranchDialog } from "./branch-dialog";
import { ChecklistManager } from "./checklist-manager";
import { TaskCommentsPanel } from "./task-comments-panel";
import { TaskFormProperties } from "./task-form-properties";
import { TaskLinksSection } from "./task-links-section";
import { useTaskFormValues } from "./use-task-form-values";

export function TaskForm({
  show = false,
  editingTask = null,
  assignees = [],
  projects = [],
  sprints = [],
  isOwner = true,
  onSubmit,
  onClose,
  onAddAssignee,
  onAddTask,
  onChecklistUpdate,
}: {
  show?: boolean;
  editingTask?: Task | null;
  assignees?: Assignee[];
  projects?: Project[];
  sprints?: Sprint[];
  isOwner?: boolean;
  onSubmit?: (task: Omit<Task, "created_at" | "id">) => void;
  onClose?: () => void;
  onAddAssignee?: (detail: { name: string; color: string }) => void;
  /** Used to persist link changes immediately while editing an existing task. */
  onAddTask?: (task: Omit<Task, "created_at" | "id">) => void;
  onChecklistUpdate?: (detail: { checklist: ChecklistItem[] }) => void;
}) {
  const { t } = useI18n();
  const workspaceName = useStore(currentWorkspaceName);
  const workspaceShortName = useStore(currentWorkspaceShortName);
  const { values, patch, nextTaskNumber, assigneeGroups } = useTaskFormValues({
    show,
    editingTask,
    assignees,
    isOwner,
    sprints,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = !!editingTask?.id;

  useEffect(() => {
    if (!show) {
      setIsExpanded(false);
      setShowBranchDialog(false);
    }
  }, [show]);

  const currentProject = projects.find((p) => p.name === values.project);
  const badgePrefix = useMemo(() => {
    const short = currentProject?.short_name || editingTask?.workspace_short_name || workspaceShortName;
    if (short) return short.toUpperCase();
    const name = editingTask?.workspace_name || workspaceName || "";
    return name.replace(/\s+/g, "").slice(0, 4).toUpperCase();
  }, [currentProject, editingTask, workspaceShortName, workspaceName]);
  const displayTaskNumber = editingTask?.task_number ?? nextTaskNumber;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.title.trim() || !values.date) return;

    if (!editingTask) {
      const first = values.assignee_ids.length > 0 ? Number(values.assignee_ids[0]) : null;
      taskDefaults.set({
        project: values.project.trim(),
        assignee_id: first !== null && !Number.isNaN(first) ? first : null,
        category: values.category,
      });
    }

    onSubmit?.({
      title: values.title.trim(),
      project: values.project.trim(),
      duration_minutes: 0,
      start_date: values.date,
      date: values.date,
      due_date: values.end_date || undefined,
      end_date: values.end_date || undefined,
      status: values.status,
      priority: values.priority as Task["priority"],
      task_type: values.task_type,
      category: values.category,
      notes: values.notes.trim(),
      assignee_ids: values.assignee_ids.length > 0 ? values.assignee_ids : undefined,
      assignee_id: values.assignee_ids.length > 0 ? values.assignee_ids[0] : null,
      sprint_id: values.sprint_id,
      checklist: values.checklist.length > 0 ? values.checklist : undefined,
      links: values.links.length > 0 ? values.links : undefined,
    });
    onClose?.();
  }

  function handleLinksChange(links: string[]) {
    patch({ links });
    if (editingTask?.id) onAddTask?.({ ...editingTask, links });
  }

  function handleChecklistChange(checklist: ChecklistItem[]) {
    patch({ checklist });
  }

  return (
    <>
      <Dialog open={show} onOpenChange={(next) => !next && !showBranchDialog && onClose?.()}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(e: Event) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          className={cn(
            "flex max-h-[98vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
            editing && "sm:max-w-6xl",
            isExpanded && "h-[90vh] sm:max-w-[95vw]",
            !editing && !isExpanded && "min-h-[680px]",
          )}
        >
          <DialogTitle className="sr-only">
            {editingTask ? t("taskForm__edit_task_title") : t("taskForm__breadcrumb_create_manually")}
          </DialogTitle>
          <DialogDescription className="sr-only">{values.title}</DialogDescription>

          <div className="flex shrink-0 items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{workspaceName || "Workspace"}</span>
              <ChevronRight size={14} className="opacity-40" />
              <span>{editingTask ? t("taskForm__edit_task_title") : t("taskForm__breadcrumb_create_manually")}</span>
              {displayTaskNumber && badgePrefix && (
                <span className="rounded border px-1.5 py-0.5 text-xs tabular-nums">
                  {badgePrefix}-{displayTaskNumber}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={t("taskForm__branch")}
                aria-label={t("taskForm__branch")}
                onClick={() => setShowBranchDialog(true)}
              >
                <GitBranch size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                onClick={() => setIsExpanded((v) => !v)}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              <div className={editing ? "grid h-full grid-cols-1 gap-4 xl:grid-cols-5" : "space-y-4"}>
                <div className={cn("space-y-4", editing && "xl:col-span-3")}>
                  <div className="grid gap-2">
                    <Label htmlFor="title">{t("taskForm__task_title_label")}</Label>
                    <Input
                      id="title"
                      ref={titleRef}
                      required
                      value={values.title}
                      onChange={(e) => patch({ title: e.target.value })}
                      placeholder={t("taskForm__task_title_placeholder")}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">{t("taskForm__notes_label")}</Label>
                    <Textarea
                      id="notes"
                      value={values.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                      placeholder={t("taskForm__notes_placeholder")}
                      className="min-h-24"
                    />
                  </div>

                  <TaskFormProperties
                    values={values}
                    patch={patch}
                    assignees={assignees}
                    assigneeGroups={assigneeGroups}
                    projects={projects}
                    isOwner={isOwner}
                    onAddAssignee={onAddAssignee}
                  />

                  <div className="border-t pt-4">
                    <ChecklistManager
                      checklist={values.checklist}
                      autoDispatch={editing}
                      onChecklistChange={handleChecklistChange}
                      onUpdate={editing ? (detail) => onChecklistUpdate?.(detail) : undefined}
                    />
                  </div>

                  <TaskLinksSection links={values.links} isOwner={isOwner} onLinksChange={handleLinksChange} />
                </div>

                {editing && editingTask?.id && (
                  <div className="flex h-full min-h-[560px] flex-col border-t p-4 xl:col-span-2 xl:max-h-[calc(90vh-11rem)] xl:border-l xl:border-t-0">
                    <TaskCommentsPanel taskId={editingTask.id} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end border-t px-5 py-3">
              <Button type="submit">{editingTask ? t("taskForm__btn_save") : t("taskForm__btn_create_issue")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BranchDialog
        show={showBranchDialog}
        title={values.title}
        workspaceShortName={badgePrefix}
        taskNumber={displayTaskNumber ?? null}
        taskType={values.task_type}
        onClose={() => setShowBranchDialog(false)}
      />
    </>
  );
}
