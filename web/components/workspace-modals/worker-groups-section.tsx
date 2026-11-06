"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Edit2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAssigneeGroup, deleteAssigneeGroup, getAssigneeGroups, updateAssigneeGroup } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import type { Assignee, AssigneeGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

type Id = string | number | null | undefined;

const isSameId = (a: Id, b: Id) => a != null && b != null && String(a) === String(b);

function MemberPicker({
  assignees,
  selectedIds,
  isTaken,
  onToggle,
}: {
  assignees: Assignee[];
  selectedIds: (string | number)[];
  isTaken: (id: Id) => boolean;
  onToggle: (id: Id) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="max-h-36 space-y-1 overflow-y-auto">
      {assignees
        .filter((a) => a.id != null)
        .map((assignee) => {
          const taken = isTaken(assignee.id);
          return (
            <label
              key={assignee.id}
              className={cn(
                "flex items-center gap-2 rounded p-1 text-sm",
                taken ? "cursor-not-allowed text-muted-foreground opacity-50" : "cursor-pointer hover:bg-accent",
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.some((id) => isSameId(id, assignee.id))}
                onChange={() => onToggle(assignee.id)}
                disabled={taken}
                className="accent-primary"
              />
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: assignee.color }} />
              <span className="truncate">{assignee.name}</span>
              {taken && (
                <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
                  {t("workerManager__groups_member_taken")}
                </span>
              )}
            </label>
          );
        })}
    </div>
  );
}

export function WorkerGroupsSection({
  assignees,
  isOwner,
  onGroupsChanged,
}: {
  assignees: Assignee[];
  isOwner: boolean;
  onGroupsChanged?: () => void;
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id>(null);
  const [editingGroup, setEditingGroup] = useState<AssigneeGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editIds, setEditIds] = useState<(string | number)[]>([]);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await getAssigneeGroups(true));
    } catch (e) {
      console.error("Failed to load assignee groups:", e);
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  const takenIds = useMemo(
    () =>
      new Set(
        groups
          .filter((g) => !editingGroup || !isSameId(g.id, editingGroup.id))
          .flatMap((g) => g.assignee_ids.map(String)),
      ),
    [groups, editingGroup],
  );

  const isTaken = (id: Id) => id != null && takenIds.has(String(id));

  function toggleIn(list: (string | number)[], id: Id) {
    if (id == null || isTaken(id)) return list;
    return list.some((x) => isSameId(x, id)) ? list.filter((x) => !isSameId(x, id)) : [...list, id];
  }

  async function handleCreate() {
    if (!newGroupName.trim()) return;
    try {
      await addAssigneeGroup({ name: newGroupName.trim(), assignee_ids: selectedIds });
      cancelAdd();
      await refreshGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to create assignee group:", error);
    }
  }

  function cancelAdd() {
    setNewGroupName("");
    setSelectedIds([]);
    setShowAddForm(false);
  }

  function startEdit(group: AssigneeGroup) {
    setEditingGroup(group);
    setEditName(group.name);
    setEditIds([...group.assignee_ids]);
    setShowAddForm(false);
    setDeleteConfirmId(null);
  }

  function cancelEdit() {
    setEditingGroup(null);
    setEditName("");
    setEditIds([]);
  }

  async function handleUpdate() {
    if (!editingGroup?.id || !editName.trim()) return;
    try {
      await updateAssigneeGroup(editingGroup.id, { name: editName.trim(), assignee_ids: editIds });
      cancelEdit();
      await refreshGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to update assignee group:", error);
    }
  }

  async function handleDelete(groupId: Id) {
    if (groupId == null) return;
    try {
      await deleteAssigneeGroup(groupId);
      setDeleteConfirmId(null);
      await refreshGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to delete assignee group:", error);
    }
  }

  const getMembers = (group: AssigneeGroup) =>
    group.assignee_ids.map((id) => assignees.find((a) => isSameId(a.id, id))).filter((a): a is Assignee => Boolean(a));

  return (
    <div className="mt-8 space-y-3">
      <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Users size={10} /> {t("workerManager__groups_title")}
      </h3>

      {isOwner &&
        (showAddForm ? (
          <div className="animate-in space-y-3 rounded-lg border bg-muted/50 p-4 shadow-inner fade-in slide-in-from-top-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t("workerManager__groups_name_placeholder")}
              aria-label={t("workerManager__groups_name_placeholder")}
              className="bg-background text-sm"
            />
            <MemberPicker
              assignees={assignees}
              selectedIds={selectedIds}
              isTaken={isTaken}
              onToggle={(id) => setSelectedIds((list) => toggleIn(list, id))}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newGroupName.trim() || selectedIds.length === 0}
                className="flex-1 text-sm font-medium"
              >
                <Plus size={14} />
                {t("workerManager__groups_create_btn")}
              </Button>
              <Button type="button" variant="outline" className="text-sm" onClick={cancelAdd}>
                {t("workerManager__btn_cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
          >
            <Users size={14} />
            <Plus size={12} />
            <span className="text-xs font-medium">{t("workerManager__groups_add_btn_short")}</span>
          </button>
        ))}

      {groups.length === 0 && !showAddForm ? (
        <div className="rounded-lg border bg-muted/40 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t("workerManager__groups_no_groups")}</p>
        </div>
      ) : (
        groups.map((group) => {
          const members = getMembers(group);
          if (editingGroup && isSameId(editingGroup.id, group.id)) {
            return (
              <div
                key={group.id}
                className="animate-in space-y-3 rounded-lg border border-primary/30 bg-muted/50 p-4 shadow-inner fade-in slide-in-from-top-2"
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("workerManager__groups_name_placeholder")}
                  aria-label={t("workerManager__groups_name_placeholder")}
                  className="bg-background text-sm"
                />
                <MemberPicker
                  assignees={assignees}
                  selectedIds={editIds}
                  isTaken={isTaken}
                  onToggle={(id) => setEditIds((list) => toggleIn(list, id))}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleUpdate()}
                    disabled={!editName.trim()}
                    className="flex-1 text-sm font-medium"
                  >
                    <Check size={14} />
                    {t("workerManager__groups_save_btn")}
                  </Button>
                  <Button type="button" variant="outline" className="text-sm" onClick={cancelEdit}>
                    {t("workerManager__btn_cancel")}
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className="group/grp rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users size={14} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">{group.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {members.length} {t("workerManager__groups_members")}
                    </p>
                  </div>
                </div>
                {isOwner &&
                  (isSameId(deleteConfirmId, group.id) ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => void handleDelete(group.id)}
                        className="font-medium"
                      >
                        {t("workerManager__groups_delete_btn")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setDeleteConfirmId(null)}
                        className="font-medium"
                      >
                        {t("workerManager__btn_cancel")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 transition-colors group-focus-within/grp:opacity-100 group-hover/grp:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => startEdit(group)}
                        title={t("workerManager__groups_edit_title")}
                        aria-label={t("workerManager__groups_edit_title")}
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="hover:text-destructive"
                        onClick={() => setDeleteConfirmId(group.id ?? null)}
                        title={t("workerManager__groups_delete_title")}
                        aria-label={t("workerManager__groups_delete_title")}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
              </div>
              {members.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {members.map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: member.color }} />
                      {member.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
