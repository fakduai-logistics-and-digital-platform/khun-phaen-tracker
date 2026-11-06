"use client";

import { Settings2, Shield, User as UserIcon, X, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { UsersFacetedFilter } from "./users-faceted-filter";
import { COLUMNS, type ColumnKey, type useUsersTable } from "./use-users-table";

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  nickname: "users__col_nickname",
  name: "users__col_name",
  email: "users__col_email",
  status: "users__table_status",
  role: "users__table_role",
  joined: "users__table_joined",
};

type Props = {
  table: ReturnType<typeof useUsersTable>;
  search: string;
  onSearch: (value: string) => void;
};

export function UsersToolbar({ table, search, onSearch }: Props) {
  const { t } = useI18n();
  const noResults = t("users__no_results");
  const reset = t("users__clear_filters");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("users__filter_placeholder")}
          aria-label={t("users__filter_placeholder")}
          className="h-8 w-40 lg:w-64"
        />
        <UsersFacetedFilter
          title={t("users__table_status")}
          options={[
            { value: "active", label: t("users__status_active"), icon: CheckCircle2 },
            { value: "pending", label: t("users__status_pending"), icon: Clock },
          ]}
          selected={table.statusFilter}
          counts={table.counts.status}
          onToggle={table.toggleStatus}
          onClear={() => table.statusFilter.forEach(table.toggleStatus)}
          clearLabel={reset}
          emptyLabel={noResults}
        />
        <UsersFacetedFilter
          title={t("users__table_role")}
          options={[
            { value: "admin", label: t("users__role_admin_label"), icon: Shield },
            { value: "user", label: t("users__role_user_label"), icon: UserIcon },
          ]}
          selected={table.roleFilter}
          counts={table.counts.role}
          onToggle={table.toggleRole}
          onClear={() => table.roleFilter.forEach(table.toggleRole)}
          clearLabel={reset}
          emptyLabel={noResults}
        />
        {table.filtered && (
          <Button variant="ghost" size="sm" className="h-8 px-2 lg:px-3" onClick={table.clearFilters}>
            {reset}
            <X />
          </Button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Settings2 />
            {t("users__view")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t("users__view_columns")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {COLUMNS.map((key) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={!table.hidden.has(key)}
              onCheckedChange={() => table.toggleColumn(key)}
              onSelect={(e) => e.preventDefault()}
            >
              {t(COLUMN_LABEL[key])}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
