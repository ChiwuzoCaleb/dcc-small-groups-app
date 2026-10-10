"use client";

/** Typed hooks for `/api/v1/notifications/`, `/api/v1/mark-as-read` and `/api/v1/mark-all-as-read`. */

import { API_ROUTES } from "@/lib/api/config";
import { unwrapData } from "@/lib/api/normalize";
import type { NotificationsPage } from "@/lib/api/types";
import { queryKeys, useApiMutation, useApiQuery, type QueryParams } from "../useApi";

/**
 * The caller's notifications (`{ message, data: { results, page, ... } }`
 * unwrapped to just the page). Polled so the bell icon picks up new
 * notifications without a manual refresh.
 */
export function useNotifications(params?: { page?: number } & QueryParams, enabled = true) {
  return useApiQuery<unknown, NotificationsPage>(
    queryKeys.notifications.list(params),
    API_ROUTES.notifications,
    {
      params,
      select: (body) => unwrapData<NotificationsPage>(body),
      enabled,
      refetchInterval: 60_000,
      placeholderData: (prev: NotificationsPage | undefined) => prev,
    },
  );
}

/** Mark specific notifications as read. */
export function useMarkNotificationsRead() {
  return useApiMutation<unknown, { notification_ids: string[] }>(API_ROUTES.markNotificationsRead, {
    invalidateKeys: [queryKeys.notifications.all],
  });
}

/** Mark every given (typically: every currently unread) notification as read. */
export function useMarkAllNotificationsRead() {
  return useApiMutation<unknown, { notification_ids: string[] }>(API_ROUTES.markAllNotificationsRead, {
    invalidateKeys: [queryKeys.notifications.all],
  });
}
