"use client";

import { Edit3, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertySelect } from "@/components/task-detail/property-select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fixedOptions, statusOptions } from "./tc-options";
import { TcPriorityMenu } from "./tc-priority-menu";
import type { AssigneeOption, TestCase } from "./tc-types";

type TcCaseRowProps = {
  testCase: TestCase;
  selected: boolean;
  isAuthorized: boolean;
  updatingPriority: boolean;
  assigneeOptions: AssigneeOption[];
  onOpenDetail: () => void;
  onOpenEditor: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: string) => void;
  onUpdateFixed: (fixed: string) => void;
  onUpdatePriority: (priority: string) => void;
  onUpdateAssignDev: (assignee: string) => void;
};

const OPEN_BTN = "text-left";

export function TcCaseRow({
  testCase,
  selected,
  isAuthorized,
  updatingPriority,
  assigneeOptions,
  onOpenDetail,
  onOpenEditor,
  onDelete,
  onUpdateStatus,
  onUpdateFixed,
  onUpdatePriority,
  onUpdateAssignDev,
}: TcCaseRowProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 text-left transition-colors @xl:grid-cols-[108px_60px_minmax(0,1fr)_auto] @4xl:grid-cols-[108px_60px_minmax(0,1fr)_auto_auto]",
        selected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        className="grid size-5 place-items-center @xl:hidden"
        aria-label={`Open TC-${testCase.test_no}`}
        onClick={onOpenDetail}
      >
        <span
          className={cn(
            "size-2.5 rounded-full border-2",
            testCase.priority === "high"
              ? "border-orange-600"
              : testCase.priority === "medium"
                ? "border-orange-400"
                : "border-muted-foreground/40",
          )}
        />
      </button>

      <TcPriorityMenu
        testNo={testCase.test_no}
        priority={testCase.priority}
        updating={updatingPriority}
        readOnly={!isAuthorized}
        onChange={onUpdatePriority}
      />

      <button
        type="button"
        className={cn(OPEN_BTN, "hidden font-mono text-sm font-medium text-muted-foreground @xl:block")}
        onClick={onOpenDetail}
      >
        TC-{testCase.test_no}
      </button>

      <button
        type="button"
        className={cn(OPEN_BTN, "min-w-0 truncate text-sm font-medium text-foreground")}
        onClick={onOpenDetail}
      >
        {testCase.title}
      </button>

      <div className="col-span-3 flex flex-wrap items-center gap-2 @xl:col-span-4 @xl:row-start-2 @4xl:col-span-1 @4xl:col-start-4 @4xl:row-start-1">
        <PropertySelect
          id={`status-update-${testCase.id}`}
          value={testCase.status}
          options={statusOptions}
          disabled={!isAuthorized}
          className="w-fit min-w-32 max-w-56"
          onSelect={(v) => onUpdateStatus(String(v))}
        />
        <PropertySelect
          id={`fixed-update-${testCase.id}`}
          value={testCase.fixed}
          options={fixedOptions}
          className="w-fit min-w-32 max-w-56"
          onSelect={(v) => onUpdateFixed(String(v))}
        />
        <PropertySelect
          id={`assigndev-update-${testCase.id}`}
          value={testCase.assign_dev || "unassigned"}
          options={assigneeOptions}
          className="w-fit min-w-36 max-w-56"
          onSelect={(v) => onUpdateAssignDev(String(v))}
        />
      </div>

      <div className="col-start-3 row-start-1 flex items-center gap-1 @xl:col-start-4 @4xl:col-start-5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          title={isAuthorized ? t("tc__title_edit") : t("tc__title_view_case_auth")}
          aria-label={isAuthorized ? t("tc__title_edit") : t("tc__title_view_case_auth")}
          onClick={onOpenEditor}
        >
          {isAuthorized ? <Edit3 /> : <Eye />}
        </Button>

        {isAuthorized && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={t("tc__title_delete_case")}
            aria-label={t("tc__title_delete_case")}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}
