"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { ImportProgress, ImportSummary } from "./tc-types";
import type { useTcCaseActions } from "./use-tc-case-actions";
import type { useTcRuns } from "./use-tc-runs";
import type { useTcSuites } from "./use-tc-suites";

type Suites = ReturnType<typeof useTcSuites>;
type Actions = ReturnType<typeof useTcCaseActions>;
type Runs = ReturnType<typeof useTcRuns>;

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TcDialogs({
  suites,
  actions,
  runs,
  importProgress,
  importSummary,
  onCloseImportSummary,
}: {
  suites: Suites;
  actions: Actions;
  runs: Runs;
  importProgress: ImportProgress | null;
  importSummary: ImportSummary | null;
  onCloseImportSummary: () => void;
}) {
  const { t } = useI18n();
  const editing = suites.editingSuite;
  const suiteToDelete = suites.suiteToDelete;
  const isUnassigned = suiteToDelete?.id === "unassigned";

  return (
    <>
      <Dialog open={suites.showCreateSuite} onOpenChange={(next) => suites.setShowCreateSuite(next)}>
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void suites.createSuite();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("tc__suite_name")}</DialogTitle>
              <DialogDescription className="sr-only">{t("tc__ph_suite_name")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-suite-name">{t("tc__suite_name")}</Label>
              <Input
                id="new-suite-name"

                value={suites.newSuiteName}
                onChange={(e) => suites.setNewSuiteName(e.target.value)}
                placeholder={t("tc__ph_suite_name")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => suites.setShowCreateSuite(false)}>
                {t("tc__cancel")}
              </Button>
              <Button type="submit" disabled={!suites.newSuiteName.trim()}>
                {t("tc__save_changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(next) => !next && suites.setEditingSuite(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void suites.updateSuite();
              }}
            >
              <DialogHeader>
                <DialogTitle>{t("tc__title_edit_suite")}</DialogTitle>
                <DialogDescription className="sr-only">{t("tc__ph_suite_name")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="edit-suite-name">{t("tc__suite_name")}</Label>
                <Input
                  id="edit-suite-name"

                  value={editing.title}
                  onChange={(e) => suites.setEditingSuite({ ...editing, title: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => suites.setEditingSuite(null)}>
                  {t("tc__cancel")}
                </Button>
                <Button type="submit" disabled={!editing.title.trim()}>
                  {t("tc__save_changes")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!suiteToDelete}
        title={t("tc__delete_suite")}
        message={isUnassigned ? t("tc__delete_unassigned_msg") : suiteToDelete ? `${suiteToDelete.title}` : ""}
        confirmLabel={t("tc__delete_suite")}
        cancelLabel={t("tc__cancel")}
        onConfirm={() => void suites.deleteSuite()}
        onCancel={() => suites.setSuiteToDelete(null)}
      >
        {suiteToDelete && !isUnassigned && suiteToDelete.cases.length > 0 && (
          <fieldset className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="delete-mode"
                className="accent-primary"
                checked={suites.deleteMode === "move"}
                onChange={() => suites.setDeleteMode("move")}
              />
              Move test cases to Unassigned
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="delete-mode"
                className="accent-primary"
                checked={suites.deleteMode === "delete"}
                onChange={() => suites.setDeleteMode("delete")}
              />
              Delete test cases too
            </label>
          </fieldset>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={actions.showDeleteModal}
        title={t("tc__confirm_delete_case_title")}
        message={t("tc__confirm_delete_case_msg")}
        confirmLabel={t("tc__confirm_delete")}
        cancelLabel={t("tc__cancel")}
        onConfirm={() => void actions.confirmDeleteCase()}
        onCancel={actions.cancelDeleteCase}
      />

      <ConfirmDialog
        open={runs.showDeleteRunModal}
        title={t("tc__confirm_delete_run_title")}
        message={t("tc__confirm_delete_run_msg")}
        confirmLabel={t("tc__confirm_delete")}
        cancelLabel={t("tc__cancel")}
        onConfirm={() => void runs.confirmDeleteTestRun()}
        onCancel={runs.cancelDeleteRun}
      />

      <Dialog open={!!importProgress}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {importProgress?.status}
            </DialogTitle>
            <DialogDescription>{t("tc__import_warning")}</DialogDescription>
          </DialogHeader>
          {importProgress && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{
                    width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-end text-xs tabular-nums text-muted-foreground">
                {importProgress.current} / {importProgress.total}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!importSummary} onOpenChange={(next) => !next && onCloseImportSummary()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import summary</DialogTitle>
            <DialogDescription className="sr-only">Import summary</DialogDescription>
          </DialogHeader>
          {importSummary && (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto text-sm">
              <p className="tabular-nums">
                Imported {importSummary.success}, failed {importSummary.failed}, skipped {importSummary.skipped.length}
              </p>
              {importSummary.failedNames.length > 0 && (
                <ul className="list-disc ps-5 text-destructive">
                  {importSummary.failedNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
              {importSummary.skipped.length > 0 && (
                <ul className="space-y-1 text-muted-foreground">
                  {importSummary.skipped.map((s) => (
                    <li key={`${s.row}-${s.name}`}>
                      Row {s.row}
                      {s.name ? ` (${s.name})` : ""}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={onCloseImportSummary}>
              {t("tc__close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
