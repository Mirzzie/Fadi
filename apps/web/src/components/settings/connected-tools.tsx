"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  connectServerAction,
  disconnectServerAction,
  recheckServerAction,
  setServerMayActAction,
} from "@/app/dashboard/settings/connection-actions";

export type ConnectionView = {
  id: string;
  label: string;
  slug: string;
  url: string;
  status: string;
  statusDetail: string;
  toolCount: number;
  mayAct: boolean;
  lastCheckedAt: string | null;
};

const STATUS_WORDS: Record<string, string> = {
  connected: "connected",
  unreachable: "couldn't reach it",
  refused: "it refused Fadi",
};

/**
 * Other tools, connected to Fadi.
 *
 * Deliberately plain: a name, an address, what it can do, and whether it may act. The last one
 * is the only real decision here and it starts as no — a connected server can be seen before it
 * can do anything, and the tools it offers are listed so the choice is made knowing them.
 */
export function ConnectedTools({ connections }: { connections: ConnectionView[] }) {
  const fieldId = useId();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", url: "", token: "", allowToAct: false });

  function run(
    action: () => Promise<{ ok: boolean; error?: string; tools?: number }>,
    onSuccess?: () => void
  ) {
    setNotice(null);
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) setNotice(result.error ?? "That didn't work.");
        else {
          onSuccess?.();
          if (typeof result.tools === "number")
            setNotice(
              `Connected — ${result.tools} tool${result.tools === 1 ? "" : "s"} available.`
            );
        }
      } catch {
        setNotice("Couldn't complete that request. Your entries are still here; try again.");
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">Connected tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Any MCP server you connect becomes something Fadi can do. Its tools show up beside
            Fadi&rsquo;s own, with the same receipts — and none of them can act until you say so.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding((open) => !open)}>
          <Plug /> Connect a server
        </Button>
      </div>

      {adding ? (
        <form
          className="mt-4 space-y-2 rounded-lg border border-border/60 bg-background/40 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = { ...form };
            run(
              () => connectServerAction(payload),
              () => {
                setForm({ label: "", url: "", token: "", allowToAct: false });
                setAdding(false);
              }
            );
          }}
        >
          <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium">
            Server name
          </label>
          <Input
            id={`${fieldId}-name`}
            disabled={pending}
            required
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
            placeholder="What is it called? e.g. Home lab"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <label htmlFor={`${fieldId}-url`} className="block text-sm font-medium">
            MCP endpoint
          </label>
          <Input
            id={`${fieldId}-url`}
            disabled={pending}
            required
            type="url"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            placeholder="https://… its MCP endpoint"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <label htmlFor={`${fieldId}-token`} className="block text-sm font-medium">
            Access token (optional)
          </label>
          <Input
            id={`${fieldId}-token`}
            disabled={pending}
            type="password"
            value={form.token}
            onChange={(event) => setForm({ ...form, token: event.target.value })}
            placeholder="Access token, if it needs one (stored encrypted)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowToAct}
              onChange={(event) => setForm({ ...form, allowToAct: event.target.checked })}
            />
            Let Fadi use its tools without asking each time
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Connect
          </Button>
        </form>
      ) : null}

      {connections.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing connected. Fadi works entirely on its own capabilities until you add something.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {connections.map((connection) => (
            <li
              key={connection.id}
              className="rounded-lg border border-border/60 bg-background/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{connection.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connection.toolCount} tool{connection.toolCount === 1 ? "" : "s"} ·{" "}
                    {STATUS_WORDS[connection.status] ?? connection.status}
                    {connection.statusDetail ? ` — ${connection.statusDetail}` : ""} ·{" "}
                    {connection.slug}.&lt;tool&gt;
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={() => run(() => recheckServerAction(connection.id))}
                  >
                    <RefreshCw /> Check
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={() => run(() => disconnectServerAction(connection.id))}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={connection.mayAct}
                  disabled={pending}
                  onChange={(event) =>
                    run(() => setServerMayActAction(connection.id, event.target.checked))
                  }
                />
                May act without asking each time
              </label>
            </li>
          ))}
        </ul>
      )}

      {notice ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
