"use client";

import { useMemo, useState } from "react";
import {
  AlignLeft,
  CircleDot,
  Maximize2,
  MessageSquare,
  X,
} from "lucide-react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { AssigneeMultiSelect } from "@/components/shared/assignee-multi-select";
import { CommentComposer } from "@/components/task-detail/comment-composer";
import { CommentList } from "@/components/task-detail/comment-list";
import {
  ActivityDetailsToggle,
  TaskActivityList,
} from "@/components/task-detail/task-activity";
import { useTaskActivity } from "@/components/task-detail/use-task-activity";
import { DateField } from "@/components/task-detail/date-field";
import { PropertySelect } from "@/components/task-detail/property-select";
import { useTaskComments } from "@/components/task-detail/use-task-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Assignee, Project, Task } from "@/lib/types";
import { TASK_TYPES, type TaskType } from "@/lib/utils/branch-name";
import { TASK_TYPE_ICON_CLASS } from "@/lib/utils/task-type-style";
import { tOr } from "./t-or";
import {
  dueDateOf,
  getStatusLabel,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from "./table-view-config";

type Id = string | number;

interface TableViewQuickPreviewProps {
  task: Task | null;
  assignees: Assignee[];
  projects: Project[];
  onUpdate: (id: Id, updates: Partial<Task>) => void;
  onClose: () => void;
  onOpenFull: (task: Task) => void;
}

type Draft = {
  title: string;
  notes: string;
  priority: NonNullable<Task["priority"]>;
  task_type: TaskType;
  status: Task["status"];
  assignee_ids: string[];
  due_date: string;
  project: string;
};

function draftOf(task: Task): Draft {
  const ids = task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];
  return {
    title: task.title,
    notes: task.notes ?? "",
    priority: task.priority || "none",
    task_type: task.task_type || "feature",
    status: task.status,
    assignee_ids: ids.map(String),
    due_date: dueDateOf(task),
    project: task.project || "",
  };
}

/** Edits stay in a draft until Save, so every field changes on screen at once and one request stores them together. */
function PreviewBody({
  task,
  assignees,
  projects,
  onUpdate,
  onClose,
  onOpenFull,
}: Omit<TableViewQuickPreviewProps, "task"> & { task: Task }) {
  const { t } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const { user } = useAuth();
  const userInitial = (
    user?.profile?.first_name?.[0] ||
    user?.email?.[0] ||
    "?"
  ).toUpperCase();
  const comments = useTaskComments({ taskDbId: task.id, loadVersion: 0 });
  const activity = useTaskActivity(task.id, task.updated_at);
  const [showDetails, setShowDetails] = useState(true);
  const id = task.id as Id;
  const original = useMemo(() => draftOf(task), [task]);
  const [draft, setDraft] = useState<Draft>(original);

  const changes = useMemo(() => {
    const next: Partial<Task> = {};
    const title = draft.title.trim();
    if (title && title !== original.title) next.title = title;
    if (draft.notes !== original.notes) next.notes = draft.notes;
    if (draft.priority !== original.priority) next.priority = draft.priority;
    if (draft.task_type !== original.task_type)
      next.task_type = draft.task_type;
    if (draft.status !== original.status) next.status = draft.status;
    if (draft.due_date !== original.due_date) next.due_date = draft.due_date;
    if (draft.project !== original.project) next.project = draft.project;
    if (
      [...draft.assignee_ids].sort().join() !==
      [...original.assignee_ids].sort().join()
    ) {
      next.assignee_ids = draft.assignee_ids;
    }
    return next;
  }, [draft, original]);
  const dirty = Object.keys(changes).length > 0;

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: getStatusLabel(o.value, t),
        icon: o.icon,
      })),
    [t],
  );
  const typeOptions = useMemo(
    () =>
      TASK_TYPES.map((type) => ({
        value: type,
        label: t(`taskForm__task_type_${type}`),
        icon: CircleDot,
        iconClass: TASK_TYPE_ICON_CLASS[type],
      })),
    [t],
  );
  const priorityOptions = useMemo(
    () =>
      PRIORITY_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.icon,
      })),
    [],
  );
  const projectOptions = useMemo(
    () => [
      { value: "", label: t("taskForm__unassigned_project") },
      ...projects.map((p) => ({ value: p.name, label: p.name })),
    ],
    [projects, t],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  function save() {
    if (!dirty) return;
    onUpdate(id, changes);
    onClose();
  }

  function openFull() {
    if (dirty) onUpdate(id, changes);
    onClose();
    onOpenFull(task);
  }

  const taskKey = task.task_number
    ? `${task.workspace_short_name || shortName || "TASK"}-${task.task_number}`
    : "";

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b px-6 py-3">
        <DialogTitle className="font-mono text-sm font-medium text-muted-foreground">
          {taskKey || tOr(t, "tableView__quick_preview", "Quick preview")}
        </DialogTitle>
        <DialogDescription className="sr-only">{task.title}</DialogDescription>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={tOr(t, "tableView__open_full", "Open full")}
            aria-label={tOr(t, "tableView__open_full", "Open full")}
            onClick={openFull}
          >
            <Maximize2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={tOr(t, "tableView__close", "Close")}
            aria-label={tOr(t, "tableView__close", "Close")}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col">
          <div className="space-y-6 px-6 py-5 lg:flex-1 lg:overflow-y-auto">
            <Input
              aria-label={t("tableView__column_title")}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              className="-ms-2 h-auto w-[calc(100%+0.5rem)] border-transparent bg-transparent px-2 py-1 text-2xl font-semibold shadow-none hover:bg-accent/50 focus-visible:bg-transparent md:text-2xl dark:bg-transparent"
            />

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel
                  htmlFor="preview-priority"
                  className="text-xs text-muted-foreground"
                >
                  {t("tableView__column_priority")}
                </FieldLabel>
                <PropertySelect
                  id="preview-priority"
                  value={draft.priority}
                  options={priorityOptions}
                  onSelect={(value) =>
                    set("priority", value as Draft["priority"])
                  }
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="preview-status"
                  className="text-xs text-muted-foreground"
                >
                  {t("tableView__column_status")}
                </FieldLabel>
                <PropertySelect
                  id="preview-status"
                  value={draft.status}
                  options={statusOptions}
                  onSelect={(value) => set("status", value as Task["status"])}
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="preview-type"
                  className="text-xs text-muted-foreground"
                >
                  {t("taskForm__task_type_label")}
                </FieldLabel>
                <PropertySelect
                  id="preview-type"
                  value={draft.task_type}
                  options={typeOptions}
                  onSelect={(value) => set("task_type", value as TaskType)}
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="preview-assignee"
                  className="text-xs text-muted-foreground"
                >
                  {t("tableView__column_assignee")}
                </FieldLabel>
                <AssigneeMultiSelect
                  id="preview-assignee"
                  assignees={assignees}
                  value={draft.assignee_ids}
                  onChange={(ids) => set("assignee_ids", ids)}
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="preview-due-date"
                  className="text-xs text-muted-foreground"
                >
                  {t("tableView__column_due_date")}
                </FieldLabel>
                <DateField
                  id="preview-due-date"
                  value={draft.due_date}
                  placeholder={t("taskForm__due_date_placeholder")}
                  onSelect={(value) => set("due_date", value)}
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="preview-project"
                  className="text-xs text-muted-foreground"
                >
                  {t("tableView__column_project")}
                </FieldLabel>
                <PropertySelect
                  id="preview-project"
                  value={draft.project}
                  options={projectOptions}
                  onSelect={(value) => set("project", String(value ?? ""))}
                />
              </Field>
            </FieldGroup>

            <section
              className="flex flex-col gap-2"
              aria-labelledby="preview-notes-title"
            >
              <h3
                id="preview-notes-title"
                className="flex items-center gap-3 text-sm font-semibold"
              >
                <AlignLeft className="size-4 shrink-0 text-muted-foreground" />
                {tOr(t, "tableView__notes_label", "Notes")}
              </h3>
              <RichTextEditor
                value={draft.notes}
                onChange={(value) => set("notes", value)}
                placeholder={t("taskForm__notes_placeholder")}
              />
            </section>
          </div>

          <DialogFooter className="border-t px-6 py-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {tOr(t, "tableView__close", "Close")}
            </Button>
            <Button type="button" disabled={!dirty} onClick={save}>
              {t("page__save")}
            </Button>
          </DialogFooter>
        </div>

        <aside
          aria-labelledby="preview-activity-title"
          className="space-y-4 border-t bg-muted/30 px-5 py-5 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between gap-2">
            <h3
              id="preview-activity-title"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <MessageSquare className="size-4 text-muted-foreground" />
              {t("tableView__comments_activity")}
              <Badge variant="secondary">{comments.comments.length}</Badge>
            </h3>
            <ActivityDetailsToggle
              shown={showDetails}
              onToggle={() => setShowDetails((v) => !v)}
            />
          </div>
          <CommentComposer
            userInitial={userInitial}
            assignees={assignees}
            onSubmit={comments.submit}
          />
          {(comments.loading || comments.comments.length > 0) && (
            <div className="space-y-2">
              <CommentList
                comments={comments.comments}
                loading={comments.loading}
                assignees={assignees}
                onDelete={(commentId) => void comments.remove(commentId)}
              />
            </div>
          )}
          {showDetails && <TaskActivityList entries={activity} />}
        </aside>
      </div>
    </>
  );
}

export function TableViewQuickPreview({
  task,
  onClose,
  ...rest
}: TableViewQuickPreviewProps) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="z-[10000] flex h-[min(88vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {task && (
          <PreviewBody
            key={String(task.id)}
            task={task}
            onClose={onClose}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
