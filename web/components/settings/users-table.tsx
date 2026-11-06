"use client";

import {
  Calendar,
  CheckCircle2,
  Edit2,
  KeyRound,
  Mail,
  MoreVertical,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import type { ManagedUser } from "@/components/settings/user-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type UsersTableProps = {
  users: ManagedUser[];
  loading: boolean;
  error: string;
  onCopyInvite: (token: string) => void;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
};

const TH = "px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const admin = role === "admin";
  const Icon = admin ? Shield : UserIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        admin
          ? "border-purple-200 bg-purple-100 text-purple-600 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon size={10} />
      {admin ? t("users__role_admin") : t("users__role_user")}
    </span>
  );
}

function UserCell({ user }: { user: ManagedUser }) {
  const { t } = useI18n();
  const profile = user.profile;
  const fullName =
    profile?.first_name || profile?.last_name
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
      : t("users__anonymous");

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-card">
          <span className="text-xs font-black uppercase tracking-tighter text-primary">
            {(profile?.nickname || user.email.split("@")[0])[0]}
          </span>
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-card">
          <div className={cn("size-2 rounded-full", user.is_active ? "bg-success" : "bg-warning")} />
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold">
          {fullName}
          {profile?.nickname && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">({profile.nickname})</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail size={12} />
          {user.email}
        </div>
        {user.discord_id && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-primary">
            <div className="flex size-2.5 items-center justify-center rounded-full bg-primary/20 text-[6px] font-bold">
              D
            </div>
            {user.discord_id}
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersTable({ users, loading, error, onCopyInvite, onEdit, onDelete }: UsersTableProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className={TH}>{t("users__table_user")}</th>
              <th className={TH}>{t("users__table_role")}</th>
              <th className={TH}>{t("users__table_status")}</th>
              <th className={TH}>{t("users__table_joined")}</th>
              <th className={cn(TH, "text-right")}>{t("users__table_action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-10 w-48" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-16" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-20" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="float-right size-8" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center font-medium text-destructive">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <UserCell user={user} />
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <CheckCircle2 size={14} />
                        {t("users__status_active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                        <Calendar size={14} />
                        {t("users__status_pending")}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="sr-only">{t("users__table_action")}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t("users__table_action")}>
                          <MoreVertical size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        {!user.is_active && user.setup_token && (
                          <DropdownMenuItem onSelect={() => onCopyInvite(user.setup_token as string)}>
                            <KeyRound size={14} className="text-primary" />
                            {t("users__action_copy_setup")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => onEdit(user)}>
                          <Edit2 size={14} className="text-blue-500" />
                          {t("users__action_edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
                          <Trash2 size={14} />
                          {t("users__action_delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
