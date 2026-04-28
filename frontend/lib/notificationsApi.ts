import { apiGet, apiPost } from "./apiClient";

export type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  data: unknown;
  read: boolean;
  createdAt: string;
};

export async function fetchNotifications(params?: { cursor?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.cursor) sp.set("cursor", params.cursor);
  if (params?.limit) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return apiGet<{
    success: boolean;
    data: { items: NotificationItem[]; nextCursor: string | null };
  }>(`/api/notifications${q ? `?${q}` : ""}`);
}

export function markNotificationRead(id: string) {
  return apiPost<{ success: boolean }>(`/api/notifications/${id}/read`, {});
}

export function markAllNotificationsRead() {
  return apiPost<{ success: boolean }>(`/api/notifications/read-all`, {});
}

export async function fetchUnreadCount() {
  return apiGet<{ success: boolean; data: { unread: number } }>("/api/notifications/unread-count");
}
