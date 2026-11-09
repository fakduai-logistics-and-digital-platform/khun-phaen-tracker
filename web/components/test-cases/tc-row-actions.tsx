"use client";

import { useState } from "react";
import { Edit3, Eye, History, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { TcHistoryDialog } from "./tc-history";
import type { TestCase } from "./tc-types";

type Props = {
  testCase: TestCase;
  isAuthorized: boolean;
  onOpenEditor: () => void;
  onDelete: () => void;
};

/** One "…" button per row; history, edit and delete live in its dropdown. */
export function TcRowActions({ testCase, isAuthorized, onOpenEditor, onDelete }: Props) {
  const { t } = useI18n();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("tableView__column_actions")}
            title={t("tableView__column_actions")}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
            <History />
            {t("tcHistory__title")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenEditor}>
            {isAuthorized ? <Edit3 /> : <Eye />}
            {isAuthorized ? t("tc__title_edit") : t("tc__title_view_case_auth")}
          </DropdownMenuItem>
          {isAuthorized && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                {t("tc__title_delete_case")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <TcHistoryDialog
        testCaseId={testCase.id}
        passedAt={testCase.passed_at}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
