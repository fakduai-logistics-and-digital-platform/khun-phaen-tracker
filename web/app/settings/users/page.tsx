"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { DeleteUserDialog } from "@/components/settings/delete-user-dialog";
import { UserFormDialog } from "@/components/settings/user-form-dialog";
import type { ManagedUser } from "@/components/settings/user-types";
import { UsersStats } from "@/components/settings/users-stats";
import { UsersTable } from "@/components/settings/users-table";
import { useUsers } from "@/components/settings/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export default function UsersSettingsPage() {
  const { t } = useI18n();
  const state = useUsers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  useEffect(() => {
    document.title = t("meta__settings_users_title");
  }, [t]);

  function closeForm() {
    setFormOpen(false);
    setEditingUser(null);
  }

  function copyInvite(token: string) {
    void navigator.clipboard.writeText(`${window.location.origin}${withBase("/setup-password")}/?token=${token}`);
    toast.success(t("users__copy_success"));
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="text-primary" />
            {t("users__title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users__subtitle")}</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <UserPlus size={18} />
          {t("users__btn_add")}
        </Button>
      </div>

      <UsersStats users={state.users} />

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          value={state.searchQuery}
          onChange={(e) => state.setSearchQuery(e.target.value)}
          placeholder={t("users__search_placeholder")}
          aria-label={t("users__search_placeholder")}
          className="h-10 rounded-xl pl-10"
        />
      </div>

      <UsersTable
        users={state.filteredUsers}
        loading={state.loading}
        error={state.error}
        onCopyInvite={copyInvite}
        onEdit={(user) => {
          setEditingUser(user);
          setFormOpen(true);
        }}
        onDelete={state.setUserToDelete}
      />

      <DeleteUserDialog
        user={state.userToDelete}
        deleting={state.deleteLoading}
        onConfirm={() => void state.deleteUser()}
        onClose={() => state.setUserToDelete(null)}
      />

      <UserFormDialog
        open={formOpen}
        editingUser={editingUser}
        onClose={closeForm}
        onSaved={() => void state.fetchUsers()}
      />
    </div>
  );
}
