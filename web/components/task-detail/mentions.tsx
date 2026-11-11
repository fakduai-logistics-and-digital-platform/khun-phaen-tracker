"use client";

import { AssigneeHoverCard } from "@/components/shared/assignee-hover-card";
import type { Assignee } from "@/lib/types";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches `@Name` for any known assignee name, longest names first so "@Big Boss" wins over "@Big". */
export function mentionPattern(names: string[]) {
  const sorted = names
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return sorted.length
    ? new RegExp(`(@(?:${sorted.map(escapeRegExp).join("|")}))`, "gi")
    : null;
}

/** `mention` is the matched text including the leading `@`. */
export function findMentioned(mention: string, assignees: Assignee[]) {
  const name = mention.slice(1).trim().toLowerCase();
  return assignees.find((a) => a.name.trim().toLowerCase() === name);
}

/** Wraps a mention so hovering it shows who that person is. Renders the children untouched when the person is unknown. */
export function MentionHoverCard({
  assignee,
  children,
}: {
  assignee: Assignee | undefined;
  children: React.ReactNode;
}) {
  if (!assignee) return <>{children}</>;
  return (
    <AssigneeHoverCard assignees={[assignee]}>{children}</AssigneeHoverCard>
  );
}
