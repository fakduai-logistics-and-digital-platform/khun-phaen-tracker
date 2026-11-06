"use client";

import { useMemo, useState } from "react";
import type { ManagedUser } from "./user-types";

export type ColumnKey = "nickname" | "name" | "email" | "status" | "role" | "joined";
export type SortKey = "nickname" | "name" | "email" | "joined";
export type SortState = { key: SortKey; direction: "asc" | "desc" } | null;
export type UserStatus = "active" | "pending";

export const COLUMNS: ColumnKey[] = ["nickname", "name", "email", "status", "role", "joined"];

export const userStatus = (user: ManagedUser): UserStatus => (user.is_active ? "active" : "pending");

export function fullName(user: ManagedUser) {
  return `${user.profile?.first_name ?? ""} ${user.profile?.last_name ?? ""}`.trim();
}

const sortValue: Record<SortKey, (user: ManagedUser) => string | number> = {
  nickname: (u) => (u.profile?.nickname || u.email.split("@")[0]).toLowerCase(),
  name: (u) => fullName(u).toLowerCase(),
  email: (u) => u.email.toLowerCase(),
  joined: (u) => new Date(u.created_at).getTime(),
};

function toggled<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/** Filtering, sorting, column visibility, selection and paging for the user list. */
export function useUsersTable(users: ManagedUser[]) {
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>(null);
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const filtered = users.filter(
      (u) =>
        (statusFilter.size === 0 || statusFilter.has(userStatus(u))) &&
        (roleFilter.size === 0 || roleFilter.has(u.role)),
    );
    if (!sort) return filtered;
    const value = sortValue[sort.key];
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => (value(a) > value(b) ? sign : value(a) < value(b) ? -sign : 0));
  }, [users, statusFilter, roleFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  const counts = useMemo(() => {
    const tally = (pick: (u: ManagedUser) => string) =>
      users.reduce<Record<string, number>>((acc, u) => ({ ...acc, [pick(u)]: (acc[pick(u)] ?? 0) + 1 }), {});
    return { status: tally(userStatus), role: tally((u) => u.role) };
  }, [users]);

  const filtered = statusFilter.size > 0 || roleFilter.size > 0;

  return {
    rows,
    pageRows,
    page,
    pageCount,
    pageSize,
    setPage: (index: number) => setPageIndex(Math.min(Math.max(index, 0), pageCount - 1)),
    setPageSize: (size: number) => {
      setPageSize(size);
      setPageIndex(0);
    },
    counts,
    filtered,
    statusFilter,
    roleFilter,
    toggleStatus: (value: string) => {
      setStatusFilter((s) => toggled(s, value));
      setPageIndex(0);
    },
    toggleRole: (value: string) => {
      setRoleFilter((s) => toggled(s, value));
      setPageIndex(0);
    },
    clearFilters: () => {
      setStatusFilter(new Set());
      setRoleFilter(new Set());
      setPageIndex(0);
    },
    sort,
    toggleSort: (key: SortKey) =>
      setSort((s) =>
        s?.key !== key ? { key, direction: "asc" } : s.direction === "asc" ? { key, direction: "desc" } : null,
      ),
    hidden,
    toggleColumn: (key: ColumnKey) => setHidden((s) => toggled(s, key)),
    selected,
    toggleRow: (id: string) => setSelected((s) => toggled(s, id)),
    allSelected: pageRows.length > 0 && pageRows.every((u) => selected.has(u.id)),
    toggleAllRows: () =>
      setSelected((s) => {
        const everyOn = pageRows.every((u) => s.has(u.id));
        const next = new Set(s);
        for (const u of pageRows) {
          if (everyOn) next.delete(u.id);
          else next.add(u.id);
        }
        return next;
      }),
  };
}
