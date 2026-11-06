"use client";

import { ChevronsUpDown, Edit2, KeyRound, MoreHorizontal, Shield, Trash2, User as UserIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ManagedUser } from "./user-types";
import { COLUMN_LABEL } from "./users-toolbar";
import { COLUMNS, fullName, userStatus, type ColumnKey, type SortKey, type useUsersTable } from "./use-users-table";

type UsersTableProps = {
  table: ReturnType<typeof useUsersTable>;
  loading: boolean;
  error: string;
  onCopyInvite: (token: string) => void;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
};

const SORTABLE: Partial<Record<ColumnKey, SortKey>> = {
  nickname: "nickname",
  name: "name",
  email: "email",
  joined: "joined",
};

function StatusBadge({ user }: { user: ManagedUser }) {
  const { t } = useI18n();
  const active = userStatus(user) === "active";
  return (
    <Badge
      variant="outline"
      className={cn(
        active ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {active ? t("users__status_active") : t("users__status_pending")}
    </Badge>
  );
}

function RoleCell({ role }: { role: string }) {
  const { t } = useI18n();
  const admin = role === "admin";
  const Icon = admin ? Shield : UserIcon;
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      {admin ? t("users__role_admin_label") : t("users__role_user_label")}
    </span>
  );
}

function cell(key: ColumnKey, user: ManagedUser) {
  switch (key) {
    case "nickname":
      return <span className="font-medium">{user.profile?.nickname || user.email.split("@")[0]}</span>;
    case "name":
      return fullName(user) || <span className="text-muted-foreground">—</span>;
    case "email":
      return user.email;
    case "status":
      return <StatusBadge user={user} />;
    case "role":
      return <RoleCell role={user.role} />;
    case "joined":
      return <span className="tabular-nums">{new Date(user.created_at).toLocaleDateString()}</span>;
  }
}

export function UsersTable({ table, loading, error, onCopyInvite, onEdit, onDelete }: UsersTableProps) {
  const { t } = useI18n();
  const columns = COLUMNS.filter((key) => !table.hidden.has(key));
  const span = columns.length + 2;

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 ps-3">
              <Checkbox
                checked={table.allSelected}
                onCheckedChange={table.toggleAllRows}
                aria-label={t("users__select_all")}
              />
            </TableHead>
            {columns.map((key) => {
              const sortKey = SORTABLE[key];
              const direction = table.sort && table.sort.key === sortKey ? table.sort.direction : null;
              const SortIcon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
              return (
                <TableHead key={key}>
                  {sortKey ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ms-3 h-8 data-[active=true]:text-foreground"
                      data-active={!!direction}
                      onClick={() => table.toggleSort(sortKey)}
                    >
                      {t(COLUMN_LABEL[key])}
                      <SortIcon className="size-3.5" />
                    </Button>
                  ) : (
                    t(COLUMN_LABEL[key])
                  )}
                </TableHead>
              );
            })}
            <TableHead className="w-12">
              <span className="sr-only">{t("users__table_action")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={span}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell colSpan={span} className="h-24 text-center font-medium text-destructive">
                {error}
              </TableCell>
            </TableRow>
          ) : table.pageRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={span} className="h-24 text-center text-muted-foreground">
                {t("users__no_results")}
              </TableCell>
            </TableRow>
          ) : (
            table.pageRows.map((user) => (
              <TableRow key={user.id} data-state={table.selected.has(user.id) ? "selected" : undefined}>
                <TableCell className="ps-3">
                  <Checkbox
                    checked={table.selected.has(user.id)}
                    onCheckedChange={() => table.toggleRow(user.id)}
                    aria-label={t("users__select_row")}
                  />
                </TableCell>
                {columns.map((key) => (
                  <TableCell key={key}>{cell(key, user)}</TableCell>
                ))}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t("users__table_action")}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      {!user.is_active && user.setup_token && (
                        <DropdownMenuItem onSelect={() => onCopyInvite(user.setup_token as string)}>
                          <KeyRound />
                          {t("users__action_copy_setup")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => onEdit(user)}>
                        <Edit2 />
                        {t("users__action_edit")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
                        <Trash2 />
                        {t("users__action_delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
