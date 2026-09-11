"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, FolderOpen, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getWorkspace,
  grantCapability,
  listPermissions,
  registerDiscovered,
  revokeAllCapabilities,
  revokeCapability,
  setWorkspace,
  type ActionView,
  type CapabilityView,
} from "@/app/dashboard/learning/permission-actions";
import {
  ACTOR_LABEL,
  PendingAction,
  type Discovered,
} from "@/components/os/pending-action-card";
import { usePendingActions } from "@/components/os/pending-actions";

/**
 * MACHINE ACCESS — what Fadi may do here, and what it actually did.
 *
 * The user's position was right: refusing local access is not a security posture, it is
 * an unfinished feature. So access is permitted, scoped and WATCHED, and this panel is
 * the watching half.
 *
 * It leads with denials rather than successes. Successes are mostly the user's own work
 * coming back at them; a cluster of blocked attempts nobody initiated is the shape of a
 * model that read something it should not have believed. A monitor that buries that
 * under a chronological feed is decoration.
 */

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60_000);
  return mins >= 60 ? Math.round(mins / 60) + "h left" : mins + "m left";
}



export function MachineAccess() {
  const [caps, setCaps] = useState<CapabilityView[] | null>(null);
  const [recent, setRecent] = useState<ActionView[]>([]);
  // The queue is owned by the shell, not by this panel. It used to poll for itself, which
  // meant a decision existed only while someone was looking at this page.
  const { pending: waiting } = usePendingActions();
  const [workspace, setWorkspaceRoot] = useState<string | null>(null);
  const [found, setFound] = useState<Discovered | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => {
      const [perms, ws] = await Promise.all([listPermissions(), getWorkspace()]);
      if (perms.ok) {
        setCaps(perms.capabilities ?? []);
        setRecent(perms.recent ?? []);
      }
      if (ws.ok) setWorkspaceRoot(ws.root ?? null);
    });
  }, []);

  useEffect(() => {
    refresh();
    // Real-time enough to matter: a grant that expired or an attempt made while the page
    // was open should not need a reload to become visible. Polling, not a socket — the
    // truth lives in Postgres and this is a single-user machine.
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!caps) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> loading machine access…
      </p>
    );
  }

  const live = caps.filter((c) => c.grantedUntil);
  // Proposals are not blocked attempts. Counting them here was the same conflation that
  // tripped the circuit breaker, and it would have made ordinary work look like an attack.
  const denials = recent.filter((a) => a.decision === "denied");

  return (
    <section className="space-y-4 rounded-lg border border-border/60 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Machine access
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {live.length === 0
            ? "Nothing is allowed right now."
            : live.length + (live.length === 1 ? " capability" : " capabilities") + " allowed"}
        </span>
        {live.length > 0 ? (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            disabled={pending}
            onClick={() => start(async () => { await revokeAllCapabilities(); refresh(); })}
          >
            <ShieldOff className="size-3.5" aria-hidden="true" />
            Revoke everything
          </Button>
        ) : null}
      </header>

      {/*
        WAITING FOR YOU — above everything else, because it is the only part of this panel
        that is blocking someone.

        The command is shown verbatim. Approval of a description is not approval of a
        command: the person needs to see the argv that will run, and who asked for it,
        because "the model proposed this after reading a job description" is exactly the
        situation this whole layer exists for.
      */}
      {waiting.length > 0 ? (
        <div className="space-y-2 rounded-md border border-primary/50 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle className="size-3.5 text-primary" aria-hidden="true" />
            {waiting.length} change{waiting.length === 1 ? "" : "s"} waiting for your approval
          </p>
          {waiting.map((w) => (
            <PendingAction
              key={w.id}
              w={w}
              onSettled={(msg) => {
                setNote(msg);
                refresh();
              }}
              onDiscovered={setFound}
            />
          ))}
          <p className="text-[10px] text-muted-foreground">
            Nothing here has run. Each one is approved on its own — there is no setting that
            lets these through without asking.
          </p>
        </div>
      ) : null}

      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}

      {found ? (
        <RecordMachine
          found={found}
          onDone={() => {
            setFound(null);
            window.dispatchEvent(new CustomEvent("fadi:resources-changed"));
          }}
        />
      ) : null}

      {/*
        Denials first. If something asked for what it was never given, that is the one
        thing on this page worth reading, and it should not require scrolling a log to
        find.
      */}
      {denials.length > 0 ? (
        <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
            {denials.length} blocked attempt{denials.length === 1 ? "" : "s"}
          </p>
          {denials.slice(0, 5).map((d) => (
            <p key={d.id} className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{ACTOR_LABEL[d.actor] ?? d.actor}</span> asked
              for <code className="text-[10px]">{d.capability}</code>
              {d.origin ? " via " + d.origin : ""} — {d.detail ?? "denied"}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Blocked means nothing ran. If you did not start these, revoke everything and look at what
            Fadi last read.
          </p>
        </div>
      ) : null}

      <WorkspaceSetting root={workspace} onChanged={refresh} />

      <div className="space-y-2">
        {caps.map((c) => {
          const left = timeLeft(c.grantedUntil);
          return (
            <div key={c.capability} className="flex flex-wrap items-start gap-2 rounded-md border border-border/60 p-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-medium">{c.summary}</p>
                <p className="text-[11px] text-muted-foreground">{c.limit}</p>
              </div>
              {left ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-600">Allowed · {left}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await revokeCapability({ capability: c.capability });
                        refresh();
                      })
                    }
                  >
                    Revoke
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await grantCapability({ capability: c.capability });
                      refresh();
                    })
                  }
                >
                  Allow
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground">
          Everything Fadi tried on this machine ({recent.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {recent.length === 0 ? (
            <li className="text-muted-foreground">Nothing yet.</li>
          ) : (
            recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className={
                    // Only a real denial is coloured as one. Everything that is not
                    // "Fadi was refused" and not "it ran" is quiet — declining a prompt,
                    // a range that was too wide, a tool that is not installed. Colouring
                    // those as alarms is how someone learns to ignore the colour.
                    a.decision === "denied"
                      ? "text-amber-600"
                      : a.decision === "allowed"
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                  }
                >
                  {a.decision}
                </span>
                <span className="text-muted-foreground">{ACTOR_LABEL[a.actor] ?? a.actor}</span>
                {/* The exact argv, so "what did it actually run" is answerable, not inferred. */}
                <code className="text-[10px]">{a.command ?? a.capability}</code>
                <span className="ml-auto text-muted-foreground">
                  {new Date(a.at).toLocaleTimeString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </details>
    </section>
  );
}



/**
 * The workspace.
 *
 * Shown even when unset, and especially then — "Fadi has no filesystem access" is a fact
 * worth seeing, not an absence to infer from an empty screen.
 */
function WorkspaceSetting({ root, onChanged }: { root: string | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState(root ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium">Workspace</span>
        {root ? (
          <code className="text-[11px] text-muted-foreground">{root}</code>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Not set — Fadi has no filesystem access at all.
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-2 text-[10px]"
          onClick={() => setEditing((v) => !v)}
        >
          {root ? "Change" : "Set one"}
        </Button>
      </div>

      {editing ? (
        <div className="mt-2 space-y-1.5">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/home/you/fadi-labs"
            spellCheck={false}
            className="h-7 w-full max-w-md rounded border border-border bg-background px-2 font-mono text-[11px]"
          />
          <p className="text-[11px] text-muted-foreground">
            An existing folder, absolute path. Fadi can read and write inside it and nowhere else —
            symlinks pointing out of it are refused. Leave blank and press Save to take the access
            away again.
          </p>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await setWorkspace({ path });
                setError(res.ok ? null : (res.message ?? "Couldn't set that."));
                if (res.ok) {
                  setEditing(false);
                  onChanged();
                }
              })
            }
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}




/**
 * Offer to record a machine Fadi just identified.
 *
 * DETECTED, NEVER REGISTERED AUTOMATICALLY. Finding a hypervisor must not silently hand
 * Fadi a resource it may later be asked to provision on — and a registry that fills itself
 * is one nobody has read.
 *
 * The guess is shown WITH its reason and stays editable. Port 8006 is Proxmox by
 * convention, not by law, and an entry that says "hypervisor" because of a convention must
 * not later look like something a person confirmed.
 */
function RecordMachine({ found, onDone }: { found: Discovered; onDone: () => void }) {
  const [label, setLabel] = useState(
    found.guess?.kind === "hypervisor" ? "Proxmox at " + found.ip : (found.name ?? found.ip),
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
      <p className="text-xs font-medium">
        {found.ip}
        {found.name ? " (" + found.name + ")" : ""} answered.
      </p>
      <p className="text-[11px] text-muted-foreground">
        {found.openPorts.length ? "Open: " + found.openPorts.join(", ") + ". " : "No common ports open. "}
        {found.guess
          ? "Looks like a " + found.guess.kind + " — " + found.guess.why + ", which is a convention rather than proof."
          : "Not enough to guess what it is, so Fadi won't."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-7 w-full max-w-xs rounded border border-border bg-background px-2 text-[11px]"
          placeholder="Call it something you'll recognise"
        />
        <Button
          size="sm"
          disabled={busy || !label.trim()}
          onClick={() =>
            start(async () => {
              await registerDiscovered({
                ip: found.ip,
                label: label.trim(),
                kind: found.guess?.kind ?? "server",
                virtualization: found.guess?.virtualization ?? "none",
                note: found.guess ? "Guessed from open ports: " + found.guess.why + "." : undefined,
              });
              onDone();
            })
          }
        >
          Add it to my machines
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          Not now
        </Button>
      </div>
      {/* Capacity is left blank rather than guessed: a port answering says nothing about
          memory, and an unmeasured number would be reported downstream as though someone
          had checked. */}
      <p className="text-[10px] text-muted-foreground">
        Memory and disk stay unrecorded — a port answering says nothing about them, so Fadi will
        say &ldquo;not enough recorded to tell&rdquo; rather than assume.
      </p>
    </div>
  );
}
