import { translate } from "@/lib/i18n";
import { taskPath, workspacePath } from "@/lib/routes";
import { browser } from "@/lib/env";
import { base } from "@/lib/env";
import { derived, get, writable } from "@/lib/store";
import type { Assignee } from "@/lib/types";
import { user, type User } from "@/lib/stores/auth";
import { dataChanged } from "@/lib/stores/realtime";
import { api } from "@/lib/api/apis";

export type NotificationSourceType = "task" | "test_case";

export type AssignmentNotificationMeta = {
  source_type: NotificationSourceType;
  source_id: string;
  source_title: string;
  workspace_id: string;
  suite_id?: string;
  assignment_ids: string[];
  recipient_user_ids: string[];
  actor_user_id?: string;
  actor_name?: string;
  created_at: string;
  /** Set to `mention` when the notification comes from an `@Name` tag in a comment. */
  kind?: "assignment" | "mention";
  excerpt?: string;
};

export type AppNotification = {
  id: string;
  dbId?: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  sourceTitle: string;
  workspaceId: string;
  suiteId?: string;
  actorName: string;
  message: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

const notifications = writable<AppNotification[]>([]);
let unsubscribeRealtime: (() => void) | null = null;
let unsubscribeUser: (() => void) | null = null;
let activeUserKey = "";
let currentUserAssigneeIds = new Set<string>();

export function setCurrentUserAssigneeIds(ids: string[]) {
  currentUserAssigneeIds = new Set(ids.map(String));
}

export const notificationItems = notifications;
export const unreadNotificationCount = derived(notifications, ($items) => $items.filter((item) => !item.readAt).length);

export function getUserDisplayName(currentUser: User | null): string {
  if (!currentUser) return "Unknown user";
  return (
    currentUser.profile?.nickname ||
    [currentUser.profile?.first_name, currentUser.profile?.last_name].filter(Boolean).join(" ").trim() ||
    currentUser.email?.split("@")[0] ||
    "Unknown user"
  );
}

export function resolveRecipientUserIds(
  assignees: Assignee[],
  assigneeIds: Array<string | number | undefined | null>,
): string[] {
  const selected = new Set(
    assigneeIds.filter((id): id is string | number => id !== undefined && id !== null).map(String),
  );

  return Array.from(
    new Set(
      assignees
        .filter((assignee) => assignee.id !== undefined && selected.has(String(assignee.id)))
        .map((assignee) => assignee.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
}

export function getAssignmentIds(
  nextIds: Array<string | number | undefined | null> = [],
  previousIds: Array<string | number | undefined | null> = [],
): string[] {
  const previous = new Set(
    previousIds.filter((id): id is string | number => id !== undefined && id !== null).map(String),
  );

  return Array.from(
    new Set(
      nextIds
        .filter((id): id is string | number => id !== undefined && id !== null)
        .map(String)
        .filter((id) => id !== "unassigned" && !previous.has(id)),
    ),
  );
}

export function shouldCreateNotification(meta: AssignmentNotificationMeta, currentUser: User | null): boolean {
  if (!currentUser) return false;
  const userIds = [currentUser.id, currentUser.user_id].filter(Boolean).map(String);
  // Primary: match via user_id linked on assignee record
  if (meta.recipient_user_ids.some((id) => userIds.includes(String(id)))) return true;
  // Fallback: match via assignee ID (for assignees without user_id linked)
  if (currentUserAssigneeIds.size > 0) {
    return meta.assignment_ids.some((id) => currentUserAssigneeIds.has(String(id)));
  }
  return false;
}

export function buildNotification(
  meta: AssignmentNotificationMeta,
  dbId?: string,
  readAt?: string | null,
): AppNotification {
  const sourceLabel = meta.source_type === "task" ? "งาน" : "test case";
  const actorName = meta.actor_name || "Unknown user";
  const params = new URLSearchParams();
  const room = browser ? localStorage.getItem("sync-room-code") : "";
  if (room) params.set("room", room);

  let href = `${base}${taskPath(meta.workspace_id, meta.source_id)}`;
  if (meta.source_type === "test_case") {
    if (meta.suite_id) params.set("suite", meta.suite_id);
    params.set("case", meta.source_id);
    href = `${base}${workspacePath(meta.workspace_id, "test-cases", "editor")}`;
  }

  const query = params.toString();

  return {
    id: `${meta.source_type}:${meta.source_id}:${meta.assignment_ids.join(",")}:${meta.created_at}`,
    dbId,
    sourceType: meta.source_type,
    sourceId: meta.source_id,
    sourceTitle: meta.source_title,
    workspaceId: meta.workspace_id,
    suiteId: meta.suite_id,
    actorName,
    message:
      meta.kind === "mention"
        ? translate("notification__mention", { actor: actorName, title: meta.source_title })
        : `${actorName} เพิ่ม${sourceLabel} "${meta.source_title}" ให้คุณ`,
    href: query ? `${href}&${query}` : href,
    createdAt: meta.created_at,
    readAt: readAt ?? null,
  };
}

export function initNotifications() {
  if (!browser) return;

  if (!unsubscribeUser) {
    unsubscribeUser = user.subscribe((currentUser) => {
      const nextKey = currentUser?.id || currentUser?.user_id || "";
      if (nextKey === activeUserKey) return;
      activeUserKey = nextKey;
      // Load from localStorage immediately for fast render
      notifications.set(readStoredNotifications(nextKey));
      if (nextKey) {
        // Hydrate from DB in background
        void syncFromDb();
      }
    });
  }

  if (!unsubscribeRealtime) {
    unsubscribeRealtime = dataChanged.subscribe((event) => {
      const meta = event?.data?._notification as AssignmentNotificationMeta | undefined;
      if (meta) ingestAssignmentNotification(meta);
    });
  }
}

async function syncFromDb(): Promise<void> {
  if (!browser) return;
  try {
    const res = await api.userNotifications.list();
    if (!res.ok) return;
    const data = await res.json();
    const dbItems: AppNotification[] = (data.notifications || []).map((doc: any) => {
      const meta: AssignmentNotificationMeta = {
        source_type: doc.source_type,
        source_id: doc.source_id,
        source_title: doc.source_title,
        workspace_id: doc.workspace_id,
        suite_id: doc.suite_id,
        assignment_ids: doc.assignment_ids || [],
        recipient_user_ids: doc.recipient_user_ids || [],
        actor_user_id: doc.actor_user_id,
        actor_name: doc.actor_name,
        created_at: doc.created_at,
        kind: doc.kind,
        excerpt: doc.excerpt,
      };
      const dbId = doc._id?.$oid || doc._id || doc.id || undefined;
      return buildNotification(meta, dbId, doc.read_at ?? null);
    });

    if (dbItems.length === 0) return;

    // Merge: DB is authoritative for read_at; preserve local-only items
    updateStored((local) => {
      const localById = new Map(local.map((n) => [n.id, n]));
      for (const dbItem of dbItems) {
        const existing = localById.get(dbItem.id);
        if (!existing) {
          localById.set(dbItem.id, dbItem);
        } else {
          // DB read_at takes precedence
          localById.set(dbItem.id, {
            ...existing,
            dbId: dbItem.dbId ?? existing.dbId,
            readAt: dbItem.readAt ?? existing.readAt,
          });
        }
      }
      return Array.from(localById.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100);
    });
  } catch {
    // Silently fail — offline or server unavailable
  }
}

export async function saveNotificationForRecipients(meta: AssignmentNotificationMeta): Promise<void> {
  if (!browser) return;
  try {
    await api.userNotifications.create(meta);
  } catch {
    // Silently fail — real-time WebSocket still delivers to online users
  }
}

export function ingestAssignmentNotification(meta: AssignmentNotificationMeta) {
  if (!shouldCreateNotification(meta, get(user))) return;
  upsertNotification(buildNotification(meta));
}

export function destroyNotifications() {
  unsubscribeRealtime?.();
  unsubscribeUser?.();
  unsubscribeRealtime = null;
  unsubscribeUser = null;
}

export function markNotificationRead(id: string) {
  updateStored((items) =>
    items.map((item) => {
      if (item.id !== id || item.readAt) return item;
      const updated = { ...item, readAt: new Date().toISOString() };
      if (updated.dbId) {
        api.userNotifications.markRead(updated.dbId).catch(() => {});
      }
      return updated;
    }),
  );
}

export function markAllNotificationsRead() {
  const now = new Date().toISOString();
  updateStored((items) => items.map((item) => (item.readAt ? item : { ...item, readAt: now })));
  api.userNotifications.markAllRead().catch(() => {});
}

export async function deleteNotification(id: string): Promise<void> {
  const previousItems = get(notifications);
  const item = previousItems.find((notification) => notification.id === id);
  if (!item) return;

  updateStored((items) => items.filter((notification) => notification.id !== id));

  if (!item.dbId) return;

  try {
    const res = await api.userNotifications.delete(item.dbId);
    if (!res.ok) {
      updateStored(() => previousItems);
    }
  } catch {
    updateStored(() => previousItems);
  }
}

export function clearNotificationsForTest() {
  notifications.set([]);
  activeUserKey = "";
}

function upsertNotification(notification: AppNotification) {
  updateStored((items) => {
    if (items.some((item) => item.id === notification.id)) return items;
    return [notification, ...items].slice(0, 100);
  });
}

function updateStored(updater: (items: AppNotification[]) => AppNotification[]) {
  const currentUser = get(user);
  const key = currentUser?.id || currentUser?.user_id || "";
  if (!key) return;

  const next = updater(get(notifications));
  notifications.set(next);
  if (browser) {
    localStorage.setItem(storageKey(key), JSON.stringify(next));
  }
}

function readStoredNotifications(userKey: string): AppNotification[] {
  if (!browser || !userKey) return [];
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storageKey(userKey: string) {
  return `khun-phaen-notifications:${userKey}`;
}
