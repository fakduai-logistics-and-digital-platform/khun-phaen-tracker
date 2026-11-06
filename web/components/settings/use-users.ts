"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ManagedUser } from "@/components/settings/user-types";
import { api } from "@/lib/api/apis";

export function useUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auth.listUsers();
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(query) ||
        (u.profile?.first_name || "").toLowerCase().includes(query) ||
        (u.profile?.nickname || "").toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  async function deleteUser() {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await api.auth.deleteUser(userToDelete.id);
      if (res.ok) {
        void fetchUsers();
        setUserToDelete(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete user");
      }
    } catch {
      setError("Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  }

  return {
    users,
    filteredUsers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    userToDelete,
    setUserToDelete,
    deleteLoading,
    fetchUsers,
    deleteUser,
  };
}
