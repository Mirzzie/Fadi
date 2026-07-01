"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plug, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createMcpToken, revokeMcpTokenAction } from "@/app/dashboard/settings/mcp-actions";
import type { McpTokenView } from "@/lib/mcp/tokens";

export function McpTokens({ tokens: initial }: { tokens: McpTokenView[] }) {
  const [tokens, setTokens] = useState<McpTokenView[]>(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null); // raw token shown once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setFresh(null);
    startTransition(async () => {
      const res = await createMcpToken({ name });
      if (!res.ok) return setError(res.message);
      setTokens((prev) => [res.view, ...prev]);
      setFresh(res.token);
      setName("");
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeMcpTokenAction({ id });
      if (res.ok) {
        setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t)));
      }
    });
  }

  function copy() {
    if (!fresh) return;
    void navigator.clipboard?.writeText(fresh).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10">
          <Plug className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Integrations &amp; agents (MCP)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Fadi as a tool from any agentic AI client — Claude Code, OpenClaw, Cursor. Create a
            token, point the client at your <code className="rounded bg-muted px-1">/api/mcp</code>{" "}
            endpoint, and it can run your fit-checks, mock interviews, referrals and more.
          </p>
        </div>
      </div>

      {/* Create */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Token name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Code — laptop" />
        </label>
        <Button size="sm" onClick={create} disabled={pending}>
          <Plus className="size-4" aria-hidden="true" />
          Create token
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Show-once raw token */}
      {fresh ? (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">
            Copy this now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background/70 px-2 py-1 text-xs">{fresh}</code>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use it as a Bearer token against <code className="rounded bg-muted px-1">POST /api/mcp</code>.
            See <code className="rounded bg-muted px-1">docs/MCP-CONNECT.md</code> for the Claude Code config.
          </p>
        </div>
      ) : null}

      {/* List */}
      {active.length > 0 || tokens.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  <code className="rounded bg-muted px-1 text-[0.65rem] text-muted-foreground">{t.prefix}…</code>
                  {t.revokedAt ? (
                    <span className="text-[0.65rem] text-muted-foreground">revoked</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {/* Slice the ISO date (deterministic across server/client — locale
                      formatting caused a hydration mismatch). */}
                  {t.lastUsedAt ? `Last used ${t.lastUsedAt.slice(0, 10)}` : "Never used"} · Created{" "}
                  {t.createdAt.slice(0, 10)}
                </p>
              </div>
              {!t.revokedAt ? (
                <button
                  type="button"
                  onClick={() => revoke(t.id)}
                  disabled={pending}
                  className={cn("text-muted-foreground/70 transition-colors hover:text-destructive")}
                  title="Revoke token"
                  aria-label={`Revoke ${t.name}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No integration tokens yet.</p>
      )}
    </section>
  );
}
