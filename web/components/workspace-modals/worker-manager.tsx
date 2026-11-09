"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { keepOpenWhileNestedDialogOpen } from "./dialog-utils";
import { DEFAULT_WORKER_COLOR, getRandomWorkerColor } from "./worker-colors";
import { WorkerForm, type SystemUser, type WorkerFormValues } from "./worker-form";
import { WorkerGroupsSection } from "./worker-groups-section";
import { WorkerListItem } from "./worker-list-item";

const EMPTY_FORM: WorkerFormValues = { name: "", color: DEFAULT_WORKER_COLOR, userId: "" };

export function WorkerManager({
  assignees = [],
  workerStats = [],
  isLoading = false,
  isOwner = true,
  workspaceId = "",
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onGroupsChanged,
}: {
  assignees?: Assignee[];
  workerStats?: { id: string | number; taskCount: number }[];
  isLoading?: boolean;
  isOwner?: boolean;
  workspaceId?: string;
  onClose?: () => void;
  onAdd?: (data: { name: string; color: string; user_id?: string }) => void;
  onUpdate?: (data: { id: string | number; name: string; color: string; user_id?: string }) => void;
  onDelete?: (id: string | number) => void;
  onGroupsChanged?: () => void;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Assignee | null>(null);
  const [form, setForm] = useState<WorkerFormValues>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchSystemUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.auth.listUsers(workspaceId || undefined);
      if (res.ok) {
        const data = await res.json();
        setSystemUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to fetch system users:", e);
    } finally {
      setLoadingUsers(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchSystemUsers();
  }, [fetchSystemUsers]);

  const availableSystemUsers = useMemo(() => {
    const used = new Set(assignees.map((a) => a.user_id).filter((id): id is string => !!id && id !== form.userId));
    return systemUsers.filter((u) => !used.has(String(u.id)) && !used.has(String(u.user_id)));
  }, [assignees, systemUsers, form.userId]);

  function startAdd() {
    setShowAddForm(true);
    setEditingWorker(null);
    setForm({ name: "", color: getRandomWorkerColor(), userId: "" });
  }

  function startEdit(worker: Assignee) {
    setEditingWorker(worker);
    setShowAddForm(true);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setForm({ name: worker.name, color: worker.color || DEFAULT_WORKER_COLOR, userId: worker.user_id || "" });
  }

  function cancelEdit() {
    setShowAddForm(false);
    setEditingWorker(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), color: form.color, user_id: form.userId || undefined };
    if (editingWorker) onUpdate?.({ id: editingWorker.id!, ...payload });
    else onAdd?.(payload);
    cancelEdit();
  }

  function handleDelete(id: string | number) {
    onDelete?.(id);
    setDeleteConfirmId(null);
  }

  const getTaskCount = (workerId: string | number) =>
    workerStats.find((s) => String(s.id) === String(workerId))?.taskCount || 0;

  const getLinkedUser = (userId?: string) =>
    userId ? systemUsers.find((u) => String(u.id) === String(userId) || String(u.user_id) === String(userId)) : null;

  function shake() {
    shakeRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 400, easing: "ease-in-out" },
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent
        onPointerDownOutside={(e) => {
          if (document.querySelectorAll('[role="dialog"][data-state="open"]').length > 1) return;
          e.preventDefault();
          shake();
        }}
        onInteractOutside={keepOpenWhileNestedDialogOpen}
        className="max-h-[90vh] gap-0 p-0 sm:max-w-4xl"
      >
        <div ref={shakeRef} className="flex h-[min(90vh,720px)] min-h-0 flex-col">
          <DialogHeader className="border-b p-6 pr-14 text-left">
            <DialogTitle>{t("workerManager__title")}</DialogTitle>
            <DialogDescription>
              {assignees.length} {t("workerManager__count_suffix")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-rows-[1fr_1fr] md:grid-cols-2 md:grid-rows-1">
            <div ref={contentRef} className="min-h-0 overflow-y-auto p-6">
              {showAddForm && isOwner ? (
                <WorkerForm
                  values={form}
                  editing={editingWorker !== null}
                  availableUsers={availableSystemUsers}
                  systemUsers={systemUsers}
                  onChange={setForm}
                  onSave={handleSave}
                  onCancel={cancelEdit}
                />
              ) : isOwner ? (
                <Button type="button" variant="outline" onClick={startAdd} className="mb-6 w-full">
                  <Plus />
                  {t("workerManager__add_new")}
                </Button>
              ) : null}

              <div className="space-y-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{t("workerManager__list_title")}</h3>
                  <button
                    type="button"
                    onClick={() => void fetchSystemUsers()}
                    className="text-muted-foreground transition-colors hover:text-primary"
                    title="Reload System Users"
                    aria-label="Reload System Users"
                  >
                    <RefreshCw size={12} className={cn(loadingUsers && "animate-spin")} />
                  </button>
                </div>

                {isLoading && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Loading assignees...</span>
                  </div>
                )}

                {!isLoading && assignees.length === 0 ? (
                  <div className="rounded-lg border py-12 text-center">
                    <User size={40} className="mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="font-medium text-muted-foreground">{t("workerManager__no_workers")}</p>
                    <p className="text-xs text-muted-foreground">{t("workerManager__add_hint")}</p>
                  </div>
                ) : (
                  assignees.map((worker) => (
                    <WorkerListItem
                      key={worker.id}
                      worker={worker}
                      linkedUser={getLinkedUser(worker.user_id)}
                      taskCount={getTaskCount(worker.id!)}
                      isOwner={isOwner}
                      confirmingDelete={deleteConfirmId === worker.id}
                      onEdit={() => startEdit(worker)}
                      onRequestDelete={() => setDeleteConfirmId(worker.id!)}
                      onConfirmDelete={() => handleDelete(worker.id!)}
                      onCancelDelete={() => setDeleteConfirmId(null)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-t p-6 md:border-t-0 md:border-l">
              <WorkerGroupsSection assignees={assignees} isOwner={isOwner} onGroupsChanged={onGroupsChanged} />
            </div>
          </div>

          <div className="border-t p-4">
            <p className="text-center text-xs text-muted-foreground">{t("workerManager__footer_hint")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
