"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Assignee } from "@/lib/types";
import { useAssigneeAccount } from "./use-assignee-account";

function AssigneeProfile({ assignee }: { assignee: Assignee }) {
  const account = useAssigneeAccount(assignee.user_id);
  const fullName = [account?.first_name, account?.last_name]
    .filter(Boolean)
    .join(" ");
  const email = account?.email || assignee.email;
  const displayName = fullName || assignee.name;

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        {assignee.avatar_url && (
          <AvatarImage src={assignee.avatar_url} alt="" />
        )}
        <AvatarFallback
          className="text-sm font-medium text-white"
          style={{ backgroundColor: assignee.color || "#6366f1" }}
        >
          {displayName[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{displayName}</span>
        {fullName && fullName !== assignee.name && (
          <span className="truncate text-xs text-muted-foreground">
            {assignee.name}
          </span>
        )}
        {account?.position && (
          <span className="truncate text-xs text-muted-foreground">
            {account.position}
          </span>
        )}
        {email && (
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        )}
        {assignee.discord_id && (
          <span className="truncate text-xs text-muted-foreground">
            Discord {assignee.discord_id}
          </span>
        )}
      </div>
    </div>
  );
}

/** Hovering the trigger shows a profile card for each person; several people stack in one card. */
export function AssigneeHoverCard({
  assignees,
  children,
}: {
  assignees: Assignee[];
  children: React.ReactNode;
}) {
  if (assignees.length === 0) return <>{children}</>;
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      {/* Dialogs and tooltips in this app stack as high as z-[10000]; the card must sit above them. */}
      <HoverCardContent
        side="right"
        className="z-[99999] flex w-72 flex-col gap-3"
      >
        {assignees.map((assignee, i) => (
          <AssigneeProfile key={`${assignee.id ?? i}`} assignee={assignee} />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
