"use client";

import { useEffect, useMemo, useState } from "react";
import { User, UserMinus, X } from "lucide-react";
import type { Assignee, AssigneeGroup } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SelectOption, type SelectValue } from "./searchable-select";
import { Tooltip } from "./tooltip";
import { useBindable } from "./use-bindable";

type AssigneeId = string | number;

type AssigneeSelectorProps = {
  assignees?: Assignee[];
  assigneeGroups?: AssigneeGroup[];
  assignee_ids?: AssigneeId[];
  onAssignee_idsChange?: (ids: AssigneeId[]) => void;
  onAssigneeIdsChange?: (ids: AssigneeId[]) => void;
  readonly?: boolean;
  minimal?: boolean;
  selfAssigneeId?: AssigneeId | null;
  /** Accepted for contract compatibility; the Svelte original never exposed a way to open its add form. */
  onAddAssignee?: (assignee: { name: string; color: string }) => void;
};

const isSameId = (a: AssigneeId | null | undefined, b: AssigneeId | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

export function AssigneeSelector({
  assignees = [],
  assigneeGroups = [],
  assignee_ids: assigneeIdsProp = [],
  onAssignee_idsChange,
  onAssigneeIdsChange,
  readonly = false,
  minimal = false,
  selfAssigneeId = null,
}: AssigneeSelectorProps) {
  const { t } = useI18n();
  const [assigneeIds, setAssigneeIds] = useBindable<AssigneeId[]>(
    assigneeIdsProp,
    onAssignee_idsChange ?? onAssigneeIdsChange,
  );
  const [selectedValue, setSelectedValue] = useState<SelectValue>(null);

  useEffect(() => {
    if (selectedValue === null) return;
    const valueStr = String(selectedValue);

    if (valueStr === "all") {
      setAssigneeIds([]);
    } else if (valueStr.startsWith("group_")) {
      const groupId = valueStr.replace("group_", "");
      const group = assigneeGroups.find((g) => isSameId(g.id, groupId));
      if (group) {
        const next = [...assigneeIds];
        for (const memberId of group.assignee_ids || []) {
          if (!next.some((id) => isSameId(id, memberId))) next.push(memberId);
        }
        setAssigneeIds(next);
      }
    } else if (valueStr.startsWith("assignee_")) {
      const assigneeId = valueStr.replace("assignee_", "");
      if (!assigneeIds.some((id) => isSameId(id, assigneeId))) {
        setAssigneeIds([...assigneeIds, assigneeId]);
      }
    }

    setSelectedValue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue]);

  const selectedAssignees = useMemo(
    () => assigneeIds.map((id) => assignees.find((a) => isSameId(a.id, id))).filter(Boolean) as Assignee[],
    [assigneeIds, assignees],
  );

  const combinedOptions = useMemo<SelectOption[]>(() => {
    const available = assignees.filter((a) => a.id != null && !assigneeIds.some((id) => isSameId(a.id, id)));
    return [
      { value: "all", label: "Unassigned", icon: UserMinus },
      { value: "label_members", label: "Members", disabled: true },
      ...assigneeGroups
        .filter((g) => g.id !== undefined && g.assignee_ids.length > 0)
        .map((group) => ({
          value: "group_" + String(group.id),
          label: `👥 ${group.name} (${group.assignee_ids.length})`,
        })),
      ...available.map((assignee) => ({
        value: "assignee_" + String(assignee.id),
        label: assignee.name,
        badge: true,
        badgeColor: assignee.color,
      })),
    ];
  }, [assignees, assigneeGroups, assigneeIds]);

  const isSelfAssigned = selfAssigneeId != null && assigneeIds.some((id) => isSameId(id, selfAssigneeId));

  function removeAssigneeFromTask(id: AssigneeId) {
    setAssigneeIds(assigneeIds.filter((assigneeId) => !isSameId(assigneeId, id)));
  }

  function assignSelf() {
    if (selfAssigneeId == null || isSelfAssigned) return;
    setAssigneeIds([...assigneeIds, selfAssigneeId]);
  }

  return (
    <div>
      {!minimal && (
        <label className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground/80">
          <User size={14} />
          {t("taskForm__assignee_label")}
        </label>
      )}

      {minimal && selectedAssignees.length > 0 ? (
        <div className="flex h-8 items-center gap-1.5">
          <div className="flex items-center -space-x-2">
            {selectedAssignees.map((assignee) => (
              <div key={assignee.id} className="relative hover:z-10">
                <Tooltip text={assignee.name}>
                  <button
                    type="button"
                    aria-label={assignee.name}
                    onClick={() => {
                      if (!readonly && assignee.id != null) removeAssigneeFromTask(assignee.id);
                    }}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background",
                      !readonly && "transition-all hover:brightness-75 hover:ring-destructive",
                    )}
                    style={{ backgroundColor: assignee.color || "#6366f1" }}
                  >
                    {assignee.name?.[0]?.toUpperCase() || "?"}
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
          {!readonly && (
            <SearchableSelect
              value={selectedValue}
              onValueChange={setSelectedValue}
              options={combinedOptions}
              placeholder="+"
              minimal
              customClass="px-1.5! min-w-0! w-8"
            />
          )}
        </div>
      ) : (
        <>
          {!minimal && selectedAssignees.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedAssignees.map((assignee) => (
                <div
                  key={assignee.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm transition-colors"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: assignee.color }} />
                  <span className="text-foreground/80">{assignee.name}</span>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={() => {
                        if (assignee.id != null) removeAssigneeFromTask(assignee.id);
                      }}
                      className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      title="Remove assignee"
                      aria-label="Remove assignee"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readonly ? (
            <SearchableSelect
              value={selectedValue}
              onValueChange={setSelectedValue}
              options={combinedOptions}
              placeholder={t("taskForm__assignee_placeholder")}
              minimal={minimal}
            />
          ) : selectedAssignees.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t("taskForm__unassigned")}</p>
          ) : null}

          {selfAssigneeId != null && !isSelfAssigned && (
            <button
              type="button"
              onClick={assignSelf}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <User size={14} />
              {t("taskForm__assign_to_me")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
