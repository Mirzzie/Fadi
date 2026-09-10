"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, FolderOpen, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  approveAction,
  denyAction,
  registerDiscovered,
  getWorkspace,
  setWorkspace,
  grantCapability,
  listPendingActions,
  listPermissions,
  revokeAllCapabilities,
  revokeCapability,
  type ActionView,
  type CapabilityView,
  type PendingActionView,
} from "@/app/dashboard/learning/permission-actions";

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

const ACTOR_LABEL: Record<string, string> = {
  user: "you",
  model: "the AI model",
  mcp: "an MCP client",
  agent: "a background agent",
};

export function MachineAccess() {
  const [caps, setCaps] = useState<CapabilityView[] | null>(null);
  const [recent, setRecent] = useState<ActionView[]>([]);
  const [waiting, setWaiting] = useState<PendingActionView[]>([]);
  const [workspace, setWorkspaceRoot] = useState<string | null>(null);
  const [found, setFound] = useState<Discovered | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => {
      const [perms, queue, ws] = await Promise.all([
        listPermissions(),
        listPendingActions(),
        getWorkspace(),
      ]);
      if (perms.ok) {
        setCaps(perms.capabilities ?? []);
        setRecent(perms.recent ?? []);
      }
      if (queue.ok) setWaiting(queue.pending ?? []);
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
                    a.decision === "denied"
                      ? "text-amber-600"
                      : a.decision === "error" || a.decision === "proposed"
                        ? "text-muted-foreground"
                        : "text-emerald-600"
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
 * One waiting change.
 *
 * The confirmation strength comes from the policy, not from this component: a reversible
 * container start is a button, and anything irreversible or reaching past a container
 * makes you type its name first. That is not friction for its own sake — it is the
 * difference between an action you chose and one you clicked past on the way to something
 * else.
 */
function PendingAction({
  w,
  onSettled,
  onDiscovered,
}: {
  w: PendingActionView;
  onSettled: (message: string) => void;
  onDiscovered: (d: Discovered) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, start] = useTransition();

  const mustType = w.confirm === "type-name";
  const ready = !mustType || typed.trim() === w.confirmToken;

  return (
    <div className="space-y-1.5 rounded border border-border/60 bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-medium">{w.summary}</p>
        {w.reversibility === "irreversible" ? (
          <span className="rounded-full border border-destructive/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-destructive">
            can&apos;t be undone
          </span>
        ) : w.reversibility === "disruptive" ? (
          <span className="rounded-full border border-amber-500/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-500">
            interrupts something
          </span>
        ) : null}
      </div>

      {/* Verbatim. Approving a description is not approving a command. */}
      {w.argv.map((line) => (
        <pre key={line} className="overflow-x-auto rounded bg-muted px-2 py-1 text-[10px]">
          {line}
        </pre>
      ))}

      {/*
        WHAT THE MACHINE SAYS WILL HAPPEN, as opposed to what the action intends.

        "Start nginx" reads identically whether the image is on disk or about to come down
        a metered connection, and whether the name is free or already taken. These lines
        are that difference, and they are why this is an informed approval rather than a
        polite one.
      */}
      {w.preflight.length > 0 ? (
        <ul className="space-y-0.5">
          {w.preflight.map((note) => (
            <li
              key={note.text}
              className={
                "flex items-start gap-1.5 text-[11px] " +
                (note.kind === "warn"
                  ? "text-amber-500"
                  : note.kind === "unknown"
                    ? "text-muted-foreground italic"
                    : "text-muted-foreground")
              }
            >
              <span aria-hidden="true">{note.kind === "warn" ? "!" : note.kind === "unknown" ? "?" : "·"}</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Asked by {ACTOR_LABEL[w.actor] ?? w.actor}
        {w.origin ? " (" + w.origin + ")" : ""}.
        {w.reversal ? " " + w.reversal : ""}
      </p>

      {mustType ? (
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground" htmlFor={"confirm-" + w.id}>
            Type <span className="font-mono text-foreground">{w.confirmToken}</span> to allow this.
          </label>
          <input
            id={"confirm-" + w.id}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-7 w-full max-w-xs rounded border border-border bg-background px-2 font-mono text-[11px]"
            placeholder={w.confirmToken}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy || !ready}
          onClick={() =>
            start(async () => {
              const res = await approveAction({ requestId: w.id, confirmation: typed });
              onSettled(res.ok ? "Done. " + (res.message ?? "") : (res.message ?? "It didn't run."));
              // A machine that answered is worth offering to record while it is in front
              // of the person, rather than leaving them to type it in somewhere else later.
              if (res.ok && res.discovered) onDiscovered(res.discovered);
            })
          }
        >
          Run it
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            start(async () => {
              await denyAction({ requestId: w.id });
              onSettled("Declined. Nothing ran.");
            })
          }
        >
          No
        </Button>
        {/*
          The age, not the deadline.

          Most prompts no longer expire — a decision should not be thrown away because the
          user went to look at something else, and staleness of the EFFECT is re-checked at
          approval instead. But "this was asked three days ago" is something the approver
          needs and no amount of freshness-checking supplies it.
        */}
        <span className="text-[10px] text-muted-foreground">Asked {w.askedAgo}</span>
      </div>
    </div>
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


/** What identifying a host turned up. Mirrors the broker's own type. */
type Discovered = {
  ip: string;
  name: string | null;
  openPorts: number[];
  guess: { kind: string; virtualization: string; why: string } | null;
};

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
