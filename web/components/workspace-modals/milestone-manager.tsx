"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronRight, Clock, Eye, EyeOff, Info, Loader2, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { CustomDatePicker } from "@/components/shared/custom-date-picker";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import type { Milestone } from "@/lib/types/milestone";
import { cn } from "@/lib/utils";
import { keepOpenWhileNestedDialogOpen } from "./dialog-utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const HOUR_OPTIONS = HOURS.map((h) => ({ value: h, label: h }));
const MINUTE_OPTIONS = MINUTES.map((m) => ({ value: m, label: m }));

const milestoneId = (m: Milestone) => m.id || (m as unknown as { _id?: string })._id || "";

const formatThaiDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export function MilestoneManager({
  workspaceId,
  isOwner = false,
  editTask = null,
  onClose,
  onUpdated,
}: {
  workspaceId: string;
  isOwner?: boolean;
  editTask?: Milestone | null;
  onClose?: () => void;
  onUpdated?: () => void;
}) {
  const { t } = useI18n();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetHour, setTargetHour] = useState("09");
  const [targetMinute, setTargetMinute] = useState("00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const consumedEditTaskId = useRef<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.workspaces.getMilestones(workspaceId);
      if (res.ok) {
        const data = await res.json();
        setMilestones(
          (data || []).map((m: any) => ({
            ...m,
            id: m.id || m._id || "",
            workspace_id:
              typeof m.workspace_id === "object" && m.workspace_id.$oid ? m.workspace_id.$oid : m.workspace_id,
          })),
        );
      }
    } catch {
      setError("Failed to load milestones");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchMilestones();
  }, [fetchMilestones]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setTargetDate("");
    setTargetHour("09");
    setTargetMinute("00");
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  const editMilestone = useCallback((m: Milestone) => {
    const mid = milestoneId(m);
    if (!mid) {
      setError("Cannot edit: Milestone ID missing");
      return;
    }
    setEditingId(mid);
    setTitle(m.title);
    setDescription(m.description || "");
    const d = new Date(m.target_date);
    setTargetDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    setTargetHour(String(d.getHours()).padStart(2, "0"));
    setTargetMinute(String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, "0"));
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (!editTask) {
      consumedEditTaskId.current = null;
      return;
    }
    if (editingId) return;
    const etId = milestoneId(editTask);
    if (etId !== consumedEditTaskId.current) {
      consumedEditTaskId.current = etId;
      editMilestone(editTask);
    }
  }, [editTask, editingId, editMilestone]);

  async function handleSubmit() {
    if (!title || !targetDate) return;
    setSubmitting(true);
    setError("");
    const payload = {
      title,
      description,
      target_date: `${targetDate}T${targetHour}:${targetMinute}:00`,
    };
    try {
      const res = editingId
        ? await api.workspaces.updateMilestone(workspaceId, editingId, payload)
        : await api.workspaces.createMilestone(workspaceId, payload);
      if (res.ok) {
        await fetchMilestones();
        resetForm();
        onUpdated?.();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.message || "Failed to save milestone");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function deleteMilestone() {
    if (!deletingId) return;
    const id = deletingId;
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    onUpdated?.();
    api.workspaces.deleteMilestone(workspaceId, id).catch((e) => {
      console.error("Failed to delete milestone:", e);
    });
    setDeletingId(null);
  }

  async function toggleVisibility(m: Milestone) {
    try {
      const res = await api.workspaces.updateMilestone(workspaceId, milestoneId(m), { is_hidden: !m.is_hidden });
      if (res.ok) {
        await fetchMilestones();
        onUpdated?.();
      }
    } catch {
      setError("Failed to toggle visibility");
    }
  }

  const now = new Date();

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose?.()}>
        <DialogContent
          onInteractOutside={keepOpenWhileNestedDialogOpen}
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="border-b px-6 py-4 pr-14 text-left">
            <DialogTitle>{t("milestone.manager_title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("milestone.manager_title")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive"
              >
                <Info size={18} />
                {error}
              </div>
            )}

            {showForm && isOwner ? (
              <form
                className="animate-in space-y-5 rounded-lg border bg-muted/50 p-6 fade-in slide-in-from-top-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmit();
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {editingId ? t("milestone.edit_title") : t("milestone.add_title")}
                  </h3>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("common.cancel")}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="milestone-title">{t("milestone.form_title")}</Label>
                    <Input
                      id="milestone-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Production Go-Live"
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="milestone-desc">{t("milestone.form_desc")}</Label>
                    <textarea
                      id="milestone-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                    <p className="text-xs text-muted-foreground">{t("milestone.description_hint")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="milestone-date" className="flex items-center gap-1">
                        <Calendar size={14} />
                        {t("milestone.form_date")}
                      </Label>
                      <CustomDatePicker
                        id="milestone-date"
                        value={targetDate}
                        onValueChange={setTargetDate}
                        placeholder={t("taskForm__due_date_placeholder")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="target-hour" className="flex items-center gap-1">
                        <Clock size={14} />
                        {t("milestone.form_time")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            id="target-hour"
                            value={targetHour}
                            onValueChange={(v) => setTargetHour(String(v))}
                            options={HOUR_OPTIONS}
                            showSearch={false}
                          />
                        </div>
                        <span className="text-lg font-medium text-muted-foreground">:</span>
                        <div className="flex-1">
                          <SearchableSelect
                            id="target-minute"
                            value={targetMinute}
                            onValueChange={(v) => setTargetMinute(String(v))}
                            options={MINUTE_OPTIONS}
                            showSearch={false}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" className="min-w-24" onClick={resetForm}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" className="min-w-24" disabled={submitting || !title || !targetDate}>
                      {submitting && <Loader2 size={16} className="animate-spin" />}
                      {editingId ? t("common.update") : t("common.save")}
                    </Button>
                  </div>
                </div>
              </form>
            ) : isOwner ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowForm(true)}>
                <Plus />
                {t("milestone.add_btn")}
              </Button>
            ) : null}

            <div className="space-y-3">
              <h3 className="flex items-center gap-3 text-sm font-medium">
                <span className="shrink-0">{t("milestone.list_title")}</span>
                <div className="h-px w-full bg-border" />
              </h3>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-primary/50" size={48} />
                </div>
              ) : milestones.length === 0 ? (
                <div className="rounded-lg border px-8 py-16 text-center">
                  <Rocket className="mx-auto mb-3 size-10 text-muted-foreground opacity-50" />
                  <p className="font-medium text-muted-foreground">{t("milestone.no_milestones")}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {milestones.map((m) => (
                    <div
                      key={milestoneId(m)}
                      className={cn(
                        "group flex items-center gap-4 rounded-lg border bg-card p-4",
                        m.is_hidden && "opacity-50",
                      )}
                    >
                      <Rocket size={18} className="shrink-0 text-muted-foreground" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate font-medium">{m.title}</h4>
                          {m.is_hidden && <Badge variant="outline">{t("milestone.hidden_badge")}</Badge>}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={11} />
                            {formatThaiDateShort(m.target_date)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={11} />
                            {new Date(m.target_date).toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {new Date(m.target_date) < now && (
                            <Badge variant="secondary">{t("milestone.reached_badge")}</Badge>
                          )}
                        </div>
                      </div>

                      {isOwner && (
                        <div className="flex translate-x-4 items-center gap-2 opacity-0 transition-colors group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void toggleVisibility(m)}
                            title={m.is_hidden ? t("milestone.show_tooltip") : t("milestone.hide_tooltip")}
                            aria-label={m.is_hidden ? t("milestone.show_tooltip") : t("milestone.hide_tooltip")}
                          >
                            {m.is_hidden ? <Eye size={18} /> : <EyeOff size={18} />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => editMilestone(m)}
                            aria-label={t("common.update")}
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="hover:text-destructive"
                            onClick={() => setDeletingId(m.id)}
                            aria-label={t("taskList__delete")}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      )}

                      <ChevronRight
                        className="shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary/40"
                        size={20}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        show={deletingId !== null}
        title={t("milestone.delete_title")}
        message={t("milestone.confirm_delete")}
        confirmText={t("taskList__delete")}
        type="danger"
        onClose={() => setDeletingId(null)}
        onConfirm={deleteMilestone}
      />
    </>
  );
}
