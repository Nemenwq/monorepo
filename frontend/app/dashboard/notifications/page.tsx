"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notificationsApi";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Set<string>>(new Set());

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchNotifications({ cursor, limit: 20 });
      setItems((prev) => (cursor ? [...prev, ...r.data.items] : r.data.items));
      setNextCursor(r.data.nextCursor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRead = async (id: string) => {
    setOptimistic((o) => new Set(o).add(id));
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, read: true } : i)),
    );
    try {
      await markNotificationRead(id);
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, read: false } : i)),
      );
      setOptimistic((o) => {
        const n = new Set(o);
        n.delete(id);
        return n;
      });
    }
  };

  const onReadAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-2xl px-4 pt-24 pb-12">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard/tenant"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void onReadAll()}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
        <h1 className="mb-6 font-mono text-2xl font-black">Notifications</h1>
        {err && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {err}
          </p>
        )}
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded border-2 border-foreground p-4 shadow-[2px_2px_0_0_#1a1a1a] transition-opacity",
                !n.read && !optimistic.has(n.id) && "bg-primary/5",
              )}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-xs font-mono uppercase text-muted-foreground">
                    {n.category}
                  </p>
                  <h2 className="font-bold">{n.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void onRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {nextCursor && (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void load(nextCursor)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
        {!loading && items.length === 0 && !err && (
          <p className="text-center text-muted-foreground">No notifications yet.</p>
        )}
      </main>
    </div>
  );
}
