"use client";

/**
 * Bell icon for the app's top bar (rendered inside `PageHeader`). Shows a red
 * dot while any fetched notification is unread, and opens a dropdown listing
 * them — clicking one, or "Mark all as read", calls the mark-read endpoints.
 */

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { colors } from "@/lib/tokens";
import { useAuth } from "@/hooks/useAuth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/api/notifications";
import type { AppNotification } from "@/lib/api/types";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(undefined, isAuthenticated);
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notifications.data?.results ?? [];
  const unread = useMemo(() => items.filter((n) => !n.read), [items]);
  const hasUnread = unread.length > 0;

  function markOneRead(n: AppNotification) {
    if (n.read || markRead.isPending) return;
    markRead.mutate({ notification_ids: [n.id] });
  }

  function markAll() {
    if (!hasUnread || markAllRead.isPending) return;
    markAllRead.mutate({ notification_ids: unread.map((n) => n.id) });
  }

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? `Notifications, ${unread.length} unread` : "Notifications"}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            border: `1.5px solid ${colors.borderStrong}`,
            background: "#fff",
            color: colors.ink,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Bell size={18} strokeWidth={1.8} />
          {hasUnread && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 6,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors.red,
                border: "1.5px solid #fff",
              }}
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" style={{ borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.hairline}`,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Notifications</span>
          {hasUnread && (
            <button
              type="button"
              onClick={markAll}
              disabled={markAllRead.isPending}
              style={{
                border: "none",
                background: "transparent",
                color: colors.red,
                fontSize: 12,
                fontWeight: 600,
                cursor: markAllRead.isPending ? "default" : "pointer",
                opacity: markAllRead.isPending ? 0.6 : 1,
              }}
            >
              Mark all as read
            </button>
          )}
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {notifications.isLoading ? (
            <div style={{ padding: 18, fontSize: 12.5, color: colors.faint }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12.5, color: colors.faint }}>No notifications yet.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markOneRead(n)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: `1px solid ${colors.hairline}`,
                  background: n.read ? "#fff" : colors.redSoft,
                  cursor: n.read ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {!n.read && (
                    <span
                      aria-hidden
                      style={{
                        marginTop: 5,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: colors.red,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: colors.ink }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: colors.faint2, marginTop: 4 }}>
                      {timeAgo(n.date_created)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
