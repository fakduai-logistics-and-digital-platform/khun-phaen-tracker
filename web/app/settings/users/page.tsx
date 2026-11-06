"use client";

import { useEffect, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DeleteUserDialog } from "@/components/settings/delete-user-dialog";
import { UserFormDialog, type RegistrationMode } from "@/components/settings/user-form-dialog";
import type { ManagedUser } from "@/components/settings/user-types";
import { UsersPagination } from "@/components/settings/users-pagination";
import { UsersTable } from "@/components/settings/users-table";
import { UsersToolbar } from "@/components/settings/users-toolbar";
import { useUsers } from "@/components/settings/use-users";
import { useUsersTable } from "@/components/settings/use-users-table";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { useI18n } from "@/lib/i18n";

export default function UsersSettingsPage() {
  const { t } = useI18n();
  const state = useUsers();
  const table = useUsersTable(state.filteredUsers);
  const [formMode, setFormMode] = useState<RegistrationMode | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  useEffect(() => {
    document.title = t("meta__settings_users_title");
  }, [t]);

  function closeForm() {
    setFormMode(null);
    setEditingUser(null);
  }

  function copyInvite(token: string) {
    void navigator.clipboard.writeText(`${window.location.origin}${withBase("/setup-password")}/?token=${token}`);
    toast.success(t("users__copy_success"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("users__list_title")}</h1>
          <p className="text-muted-foreground">{t("users__list_subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFormMode("invite")}>
            {t("users__btn_invite")}
            <Mail />
          </Button>
          <Button onClick={() => setFormMode("password")}>
            {t("users__btn_add")}
            <UserPlus />
          </Button>
        </div>
      </div>

      <UsersToolbar table={table} search={state.searchQuery} onSearch={state.setSearchQuery} />

      <UsersTable
        table={table}
        loading={state.loading}
        error={state.error}
        onCopyInvite={copyInvite}
        onEdit={(user) => {
          setEditingUser(user);
          setFormMode("invite");
        }}
        onDelete={state.setUserToDelete}
      />

      <UsersPagination
        page={table.page}
        pageCount={table.pageCount}
        pageSize={table.pageSize}
        onPage={table.setPage}
        onPageSize={table.setPageSize}
      />

      <DeleteUserDialog
        user={state.userToDelete}
        deleting={state.deleteLoading}
        onConfirm={() => void state.deleteUser()}
        onClose={() => state.setUserToDelete(null)}
      />

      <UserFormDialog
        open={formMode !== null}
        editingUser={editingUser}
        initialMode={formMode ?? "invite"}
        onClose={closeForm}
        onSaved={() => void state.fetchUsers()}
      />
    </div>
  );
}
