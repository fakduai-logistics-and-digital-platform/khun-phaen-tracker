"use client";

import { useState } from "react";
import { Briefcase, Check, Edit2, ExternalLink, Folder, Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";

export type ProjectPayload = { name: string; short_name?: string; repo_url?: string };

export function ProjectManager({
  open = true,
  projects = [],
  projectStats = [],
  isOwner = true,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: {
  open?: boolean;
  projects?: Project[];
  projectStats?: { id: string | number; taskCount: number }[];
  isOwner?: boolean;
  onClose?: () => void;
  onAdd?: (data: ProjectPayload) => void;
  onUpdate?: (data: ProjectPayload & { id: string | number }) => void;
  onDelete?: (id: string | number) => void;
}) {
  const { t } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  function resetForm() {
    setShowAddForm(false);
    setEditingProject(null);
    setName("");
    setShortName("");
    setRepoUrl("");
  }

  function startAdd() {
    setShowAddForm(true);
    setEditingProject(null);
    setName("");
    setShortName("");
    setRepoUrl("");
  }

  function startEdit(project: Project) {
    setEditingProject(project);
    setShowAddForm(true);
    setName(project.name);
    setShortName(project.short_name || "");
    setRepoUrl(project.repo_url || "");
  }

  function handleSave() {
    if (!name.trim()) return;
    const payload: ProjectPayload = {
      name: name.trim(),
      short_name: shortName.trim() || undefined,
      repo_url: repoUrl.trim() || undefined,
    };
    if (editingProject) onUpdate?.({ id: editingProject.id!, ...payload });
    else onAdd?.(payload);
    resetForm();
  }

  function handleDelete(id: string | number) {
    onDelete?.(id);
    setDeleteConfirmId(null);
  }

  function getTaskCount(projectId: string | number): number {
    return projectStats.find((s) => String(s.id) === String(projectId))?.taskCount || 0;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 border-b p-6 pr-14 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Folder size={20} className="text-primary" />
          </div>
          <div>
            <DialogTitle className="text-xl font-medium">{t("projectManager__title")}</DialogTitle>
            <DialogDescription>
              {projects.length} {t("projectManager__count_suffix")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm && isOwner ? (
            <form
              className="mb-6 space-y-4 rounded-lg bg-muted p-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="project-name-input">
                  {editingProject ? t("projectManager__edit_name") : t("projectManager__name_label")}
                </Label>
                <Input
                  id="project-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("projectManager__name_placeholder")}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="project-short-name-input">{t("projectManager__short_name_label")}</Label>
                <Input
                  id="project-short-name-input"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder={t("projectManager__short_name_placeholder")}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="project-repo-input">{t("projectManager__repo_url_label")}</Label>
                <div className="relative">
                  <LinkIcon
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="project-repo-input"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder={t("projectManager__repo_url_placeholder")}
                    className="bg-background pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={!name.trim()} className="flex-1">
                  {editingProject ? <Check size={16} /> : <Plus size={16} />}
                  {editingProject ? t("projectManager__btn_save") : t("projectManager__btn_add")}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t("projectManager__btn_cancel")}
                </Button>
              </div>
            </form>
          ) : isOwner ? (
            <button
              type="button"
              onClick={startAdd}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <Plus size={18} />
              {t("projectManager__add_new")}
            </button>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{t("projectManager__list_title")}</h3>

            {projects.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Folder size={48} className="mx-auto mb-3 opacity-50" />
                <p>{t("projectManager__no_projects")}</p>
                <p className="text-sm">{t("projectManager__add_hint")}</p>
              </div>
            ) : (
              projects.map((project) => (
                <div key={project.id}>
                  <div className="group flex items-center gap-3 rounded-lg bg-muted p-3 transition-colors hover:bg-accent">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Folder size={20} className="text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="flex items-center gap-2 truncate font-medium">
                        <span>{project.name}</span>
                        {project.short_name && (
                          <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {project.short_name}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Briefcase size={12} />
                          <span>
                            {getTaskCount(project.id!)} {t("projectManager__task_count_suffix")}
                          </span>
                        </div>
                        {project.repo_url && (
                          <a
                            href={`${project.repo_url}${project.repo_url.includes("?") ? "&" : "?"}ref=khun-phaen-tracker`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                            <span>{t("projectManager__view_repo")}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEdit(project)}
                          title={t("projectManager__btn_edit")}
                          aria-label={t("projectManager__btn_edit")}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="hover:text-destructive"
                          onClick={() => setDeleteConfirmId(project.id!)}
                          title={t("projectManager__btn_delete")}
                          aria-label={t("projectManager__btn_delete")}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>

                  {deleteConfirmId === project.id && (
                    <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                      <p className="mb-2 text-sm text-destructive">
                        {t("projectManager__delete_confirm", { name: project.name })}
                        {getTaskCount(project.id!) > 0 && (
                          <>
                            <br />
                            <span className="text-xs">{t("projectManager__delete_warning")}</span>
                          </>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(project.id!)}>
                          {t("projectManager__confirm_delete")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>
                          {t("projectManager__btn_cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t bg-muted/50 p-4">
          <p className="text-center text-xs text-muted-foreground">{t("projectManager__footer_hint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
