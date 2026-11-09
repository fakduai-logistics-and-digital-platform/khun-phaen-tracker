"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileDown, FileUp, ListOrdered, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withBase } from "@/lib/base-path";
import { publicTestCasesPath } from "@/lib/routes";
import { useI18n } from "@/lib/i18n";

type TcActionsMenuProps = {
  workspaceId: string;
  /** `all`, `none` or a project id; the shared page opens on the same project. */
  projectId: string;
  isAuthorized: boolean;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  /** Project (or `none`) the renumber action applies to; null while the view spans several projects. */
  renumberTarget: string | null;
  renumberLabel: string;
  onRenumber: (target: string) => Promise<void>;
};

export function TcActionsMenu({
  workspaceId,
  projectId,
  isAuthorized,
  onDownloadTemplate,
  onImportFile,
  onExport,
  renumberTarget,
  renumberLabel,
  onRenumber,
}: TcActionsMenuProps) {
  const { t } = useI18n();
  const [confirmRenumber, setConfirmRenumber] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv"
        className="hidden"
        aria-label={t("testCases__import")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onImportFile(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tc__title_actions")}
            title={t("tc__title_actions")}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onDownloadTemplate}>
            <Download />
            {t("testCases__download_template")}
          </DropdownMenuItem>
          {isAuthorized && (
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <FileUp />
              {t("testCases__import")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onExport}>
            <FileDown />
            {t("testCases__export")}
          </DropdownMenuItem>
          {isAuthorized && (
            <DropdownMenuItem disabled={renumberTarget === null} onSelect={() => setConfirmRenumber(true)}>
              <ListOrdered />
              {t("tcRenumber__action")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              window.open(
                withBase(publicTestCasesPath(workspaceId, projectId === "all" ? undefined : projectId)),
                "_blank",
              )
            }
          >
            <ExternalLink />
            {t("testCases__public_view")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmRenumber} onOpenChange={(open) => !renumbering && setConfirmRenumber(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tcRenumber__title")}</DialogTitle>
            <DialogDescription>{t("tcRenumber__description", { scope: renumberLabel })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={renumbering} onClick={() => setConfirmRenumber(false)}>
              {t("tc__cancel")}
            </Button>
            <Button
              type="button"
              disabled={renumbering || renumberTarget === null}
              onClick={async () => {
                if (renumberTarget === null) return;
                setRenumbering(true);
                await onRenumber(renumberTarget);
                setRenumbering(false);
                setConfirmRenumber(false);
              }}
            >
              {t("tcRenumber__confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
