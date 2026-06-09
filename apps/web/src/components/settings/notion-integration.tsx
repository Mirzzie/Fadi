"use client";

import { Loader2, NotebookText } from "lucide-react";
import { useState, useTransition } from "react";

import {
  disconnectNotionAction,
  saveNotionIntegrationAction,
  syncApplicationsToNotionAction,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * BYO-token Notion sync — paste a Notion internal-integration secret + the
 * database id you've shared with it, and push your applications there. Same
 * bring-your-own-key model as the AI provider: your data, your Notion.
 */
export function NotionIntegration({ connected }: { connected: boolean }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const token = String(data.get("token") ?? "");
    const databaseId = String(data.get("databaseId") ?? "");
    setMsg(null);
    startTransition(async () => {
      const res = await saveNotionIntegrationAction(token, databaseId);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) setIsConnected(true);
    });
  }

  function sync() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncApplicationsToNotionAction();
      setMsg({ ok: res.ok, text: res.message });
    });
  }

  function disconnect() {
    setMsg(null);
    startTransition(async () => {
      const res = await disconnectNotionAction();
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) setIsConnected(false);
    });
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <NotebookText className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Notion sync</h2>
            {isConnected ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Connected
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Push your applications into your own Notion database. Create an internal integration at
            notion.so/my-integrations, share your database with it, then paste the secret and the
            database id. Your token is encrypted at rest. Expected columns: Name, Company, Status,
            URL, Applied.
          </p>

          <form onSubmit={save} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="notion-token">Integration secret</Label>
              <Input id="notion-token" name="token" type="password" placeholder="secret_…" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notion-db">Database id</Label>
              <Input id="notion-db" name="databaseId" placeholder="32-char database id" autoComplete="off" />
            </div>

            {msg ? (
              <p className={msg.ok ? "text-sm text-primary" : "text-sm text-destructive"} role="status">
                {msg.text}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isConnected ? "Update connection" : "Connect Notion"}
              </Button>
              {isConnected ? (
                <>
                  <Button type="button" variant="outline" onClick={sync} disabled={pending}>
                    Sync now
                  </Button>
                  <Button type="button" variant="ghost" onClick={disconnect} disabled={pending}>
                    Disconnect
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
