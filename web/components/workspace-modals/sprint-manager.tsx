"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Flag, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { requestConfirm } from "@/lib/stores/confirmStore";
import { sprints } from "@/lib/stores/sprintStore";
import type { Sprint, Task } from "@/lib/types";
import { keepOpenWhileNestedDialogOpen } from "./dialog-utils";
import { SprintCard } from "./sprint-card";
import { CompleteSprintDialog, CompletedTasksDialog, MoveTasksDialog, SprintMarkdownDialog } from "./sprint-dialogs";
import { SprintForm, type SprintFormValues } from "./sprint-form";
import {
  buildCompletedSprintMarkdown,
  formatDuration,
  formatSprintDate,
  getBlockingSprint,
  getDateAfterDays,
  getNextSprintName,
  getTaskCount,
  getTasksToMoveToNewSprint,
  getTodayString,
} from "./sprint-utils";

type PendingSprint = { name: string; start_date: string; end_date: string };

function defaultForm(): SprintFormValues {
  const today = getTodayString();
  return { name: "", start: today, end: getDateAfterDays(today, 14) };
}

export function SprintManager({
  tasks = [],
  isOwner = true,
  onClose,
  onComplete,
  onCompleteAndExport,
  onDeleteSprint,
  onMoveTasksToSprint,
  onExportMarkdown,
  onExportVideo,
}: {
  tasks?: Task[];
  isOwner?: boolean;
  onClose?: () => void;
  onComplete?: (data: { sprintId: string | number; notifyWebhook: boolean }) => void;
  onCompleteAndExport?: (data: {
    sprintId: string | number;
    format: "markdown" | "video";
    notifyWebhook: boolean;
  }) => void;
  onDeleteSprint?: (sprintId: string | number) => void;
  onMoveTasksToSprint?: (data: { sprintId: string | number; taskIds: (string | number)[] }) => void;
  onExportMarkdown?: (sprintId: string | number) => void;
  onExportVideo?: (sprintId: string | number) => void;
}) {
  const { t } = useI18n();
  const sprintList = useStore(sprints);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [form, setForm] = useState<SprintFormValues>(defaultForm);
  const [completeConfirmId, setCompleteConfirmId] = useState<string | number | null>(null);
  const [viewingCompletedSprint, setViewingCompletedSprint] = useState<Sprint | null>(null);
  const [viewingMarkdownSprint, setViewingMarkdownSprint] = useState<Sprint | null>(null);
  const [sprintMarkdownText, setSprintMarkdownText] = useState("");
  const [pendingSprintData, setPendingSprintData] = useState<PendingSprint | null>(null);

  const blockingSprint = getBlockingSprint(sprintList);
  const canCreateSprint = checkCanCreateSprint(sprintList);
  const activeSprint = sprintList.find((s) => s.status === "active");

  function checkCanCreateSprint(list: Sprint[]): boolean {
    for (const sprint of list) {
      if (sprint.status === "active") return false;
      if (sprint.status === "planned") return true;
    }
    return true;
  }

  function startAdd() {
    const today = getTodayString();
    setShowAddForm(true);
    setEditingSprint(null);
    setForm({ name: getNextSprintName(sprintList), start: today, end: getDateAfterDays(today, 14) });
  }

  function startEdit(sprint: Sprint) {
    setEditingSprint(sprint);
    setShowAddForm(true);
    setForm({ name: sprint.name, start: sprint.start_date, end: sprint.end_date });
  }

  function cancelEdit() {
    setShowAddForm(false);
    setEditingSprint(null);
    setForm(defaultForm());
  }

  async function handleSave() {
    if (!form.name.trim() || !form.start || !form.end) return;

    if (editingSprint) {
      await sprints.update(editingSprint.id!, {
        name: form.name.trim(),
        start_date: form.start,
        end_date: form.end,
      });
      cancelEdit();
      return;
    }

    if (!canCreateSprint) {
      alert(t("sprintManager__error_active_exists"));
      return;
    }

    const pending = { name: form.name.trim(), start_date: form.start, end_date: form.end };
    if (getTasksToMoveToNewSprint(tasks, sprintList).length > 0) {
      setPendingSprintData(pending);
    } else {
      await createSprint(pending, true);
    }
  }

  async function createSprint(data: PendingSprint, moveTasks: boolean) {
    const newSprint = await sprints.add({ ...data, status: "planned" });

    if (moveTasks && newSprint.id) {
      const tasksToMove = getTasksToMoveToNewSprint(tasks, sprintList);
      if (tasksToMove.length > 0) onMoveTasksToSprint?.({ sprintId: newSprint.id, taskIds: tasksToMove });
    }

    setPendingSprintData(null);
    cancelEdit();
  }

  async function finishSprint(sprintId: string | number) {
    const incompleteIds = tasks
      .filter((task) => String(task.sprint_id) === String(sprintId) && task.status !== "done")
      .filter((task) => task.id !== undefined)
      .map((task) => task.id!);

    await sprints.complete(sprintId);
    if (incompleteIds.length > 0) onMoveTasksToSprint?.({ sprintId: -1, taskIds: incompleteIds });

    setCompleteConfirmId(null);
    return requestConfirm({
      title: t("sprintManager__notify_webhook_title"),
      message: t("sprintManager__notify_webhook_message"),
      confirmText: t("sprintManager__notify_webhook_yes"),
      cancelText: t("sprintManager__notify_webhook_no"),
      type: "info",
    });
  }

  async function confirmComplete() {
    if (completeConfirmId === null) return;
    const sprintId = completeConfirmId;
    const notifyWebhook = await finishSprint(sprintId);
    onComplete?.({ sprintId, notifyWebhook });
  }

  async function confirmCompleteWithExport(format: "markdown" | "video") {
    if (completeConfirmId === null) return;
    const sprintId = completeConfirmId;
    const notifyWebhook = await finishSprint(sprintId);
    onCompleteAndExport?.({ sprintId, format, notifyWebhook });
  }

  async function handleDelete(id: string | number) {
    const confirmed = await requestConfirm({
      title: t("common.confirm"),
      message: t("sprintManager__delete_confirm"),
      type: "danger",
    });
    if (confirmed) {
      onDeleteSprint?.(id);
      await sprints.delete(id);
    }
  }

  async function handleStartSprint(id: string | number) {
    for (const s of sprintList) {
      if (s.status === "active") await sprints.update(s.id!, { status: "planned" });
    }
    await sprints.update(id, { status: "active" });

    const tasksToMove = getTasksToMoveToNewSprint(tasks, sprintList);
    if (tasksToMove.length > 0) onMoveTasksToSprint?.({ sprintId: id, taskIds: tasksToMove });
  }

  function openSprintMarkdown(sprint: Sprint) {
    setViewingMarkdownSprint(sprint);
    setSprintMarkdownText(buildCompletedSprintMarkdown(t, sprint, tasks));
  }

  const activeStats = activeSprint ? getTaskCount(tasks, activeSprint.id!) : { total: 0, done: 0 };

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose?.()}>
        <DialogContent
          onInteractOutside={keepOpenWhileNestedDialogOpen}
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <DialogHeader className="flex-row items-center gap-3 border-b p-6 pr-14 text-left">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Flag size={20} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-medium">{t("sprintManager__manage_title")}</DialogTitle>
              <DialogDescription>
                {sprintList.length} {t("sprintManager__count_suffix")}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {activeSprint && (
              <div className="mb-6 rounded-lg border border-success bg-success p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-success">
                    <Play size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-success">{activeSprint.name}</h3>
                    <p className="text-sm text-success">
                      {t("sprintManager__active_status")} · {formatSprintDate(activeSprint.start_date)} -{" "}
                      {formatSprintDate(activeSprint.end_date)}
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-success px-2 py-0.5 text-xs font-medium">
                        <Calendar size={10} />
                        {formatDuration(t, activeSprint.start_date, activeSprint.end_date)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div>
                      <div className="text-2xl font-medium text-success">
                        {activeStats.done}/{activeStats.total}
                      </div>
                      <div className="text-xs text-success">{t("sprintManager__tasks_done")}</div>
                    </div>
                    {isOwner && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setCompleteConfirmId(activeSprint.id!)}
                        className="h-auto bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success"
                      >
                        <CheckCircle2 size={13} />
                        {t("sprintManager__complete_hint")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showAddForm && isOwner ? (
              <SprintForm
                values={form}
                editing={editingSprint !== null}
                onChange={setForm}
                onSave={() => void handleSave()}
                onCancel={cancelEdit}
              />
            ) : isOwner ? (
              !canCreateSprint && blockingSprint ? (
                <div className="group relative mb-6">
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-muted-foreground/60"
                  >
                    <Plus size={18} />
                    {t("sprintManager__btn_create_new")}
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-xs whitespace-nowrap text-background opacity-0 transition-colors duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {blockingSprint.status === "active"
                      ? t("sprintManager__blocking_active", { name: blockingSprint.name })
                      : t("sprintManager__blocking_planned", { name: blockingSprint.name })}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startAdd}
                  className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  <Plus size={18} />
                  สร้าง Sprint ใหม่
                </button>
              )
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t("sprintManager__list_title")}</h3>

              {sprintList.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Flag size={48} className="mx-auto mb-3 opacity-50" />
                  <p>{t("sprintManager__no_sprints")}</p>
                  <p className="text-sm">{t("sprintManager__no_sprints_hint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sprintList
                    .slice()
                    .reverse()
                    .map((sprint) => (
                      <SprintCard
                        key={sprint.id}
                        sprint={sprint}
                        stats={getTaskCount(tasks, sprint.id!)}
                        isOwner={isOwner}
                        onViewMarkdown={() => openSprintMarkdown(sprint)}
                        onViewDoneTasks={() => setViewingCompletedSprint(sprint)}
                        onExportMarkdown={() => onExportMarkdown?.(sprint.id!)}
                        onExportVideo={() => onExportVideo?.(sprint.id!)}
                        onStart={() => void handleStartSprint(sprint.id!)}
                        onComplete={() => setCompleteConfirmId(sprint.id!)}
                        onEdit={() => startEdit(sprint)}
                        onDelete={() => void handleDelete(sprint.id!)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MoveTasksDialog
        pending={pendingSprintData}
        taskCount={getTasksToMoveToNewSprint(tasks, sprintList).length}
        onConfirm={(moveTasks) => pendingSprintData && void createSprint(pendingSprintData, moveTasks)}
        onCancel={() => setPendingSprintData(null)}
      />
      <SprintMarkdownDialog
        sprint={viewingMarkdownSprint}
        text={sprintMarkdownText}
        onClose={() => {
          setViewingMarkdownSprint(null);
          setSprintMarkdownText("");
        }}
      />
      <CompletedTasksDialog
        sprint={viewingCompletedSprint}
        tasks={tasks}
        onClose={() => setViewingCompletedSprint(null)}
      />
      <CompleteSprintDialog
        sprintId={completeConfirmId}
        tasks={tasks}
        onConfirm={() => void confirmComplete()}
        onConfirmWithExport={(format) => void confirmCompleteWithExport(format)}
        onCancel={() => setCompleteConfirmId(null)}
      />
    </>
  );
}
