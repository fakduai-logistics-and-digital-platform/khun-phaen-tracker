import type { AssigneeOption, AssigneeRecord } from "./tc-types";

const UNASSIGNED_OPTION: AssigneeOption = {
  value: "unassigned",
  label: "Unassigned",
  user_id: null,
  avatarColor: "#64748b",
};

function toOption(assignee: AssigneeRecord): AssigneeOption {
  return {
    value: String(assignee.id),
    label: assignee.name,
    user_id: assignee.user_id,
    avatarUrl: assignee.avatar_url || assignee.avatarUrl,
    avatarColor: assignee.color || "#6366f1",
  };
}

export function buildAssigneeOptions(assignees: AssigneeRecord[], userId: string | undefined, isAuthorized: boolean) {
  const assigneeOptions: AssigneeOption[] = [UNASSIGNED_OPTION, ...assignees.map(toOption)];
  const isMe = (o: AssigneeOption) => String(o.user_id) === String(userId);

  const availableAssigneeOptions = isAuthorized
    ? assigneeOptions
    : assigneeOptions
        .filter((o) => o.value === "unassigned" || isMe(o))
        .map((o) => (isMe(o) ? { ...o, label: "me" } : o));

  const meEntry = assignees.find((a) => String(a.user_id) === String(userId));
  const rest = assigneeOptions.filter((o) => o.value !== "unassigned" && !isMe(o));
  const testRunAssigneeOptions: AssigneeOption[] = [
    UNASSIGNED_OPTION,
    ...(meEntry ? [{ ...toOption(meEntry), label: "Me" }] : []),
    ...rest,
  ];

  return { assigneeOptions, availableAssigneeOptions, testRunAssigneeOptions };
}
