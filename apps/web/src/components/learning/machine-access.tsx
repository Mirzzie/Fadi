"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FolderOpen,
  History,
  Loader2,
  Settings2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getWorkspace,
  listPermissions,
  registerDiscovered,
  revokeAllCapabilities,
  revokeCapability,
  setWorkspace,
  type ActionView,
  type CapabilityView,
} from "@/app/dashboard/learning/permission-actions";
import { ACTOR_LABEL, PendingAction, type Discovered } from "@/components/os/pending-action-card";
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
  const [openPanel, setOpenPanel] = useState<"decisions" | "permissions" | "activity" | null>(null);
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Fadi access</h3>
          <p className="text-xs text-muted-foreground">
            {live.length === 0
              ? "No temporary inspection access is active."
              : `Inspection allowed for ${live.length} area${live.length === 1 ? "" : "s"}; each expires automatically.`}
          </p>
        </div>
        {live.length > 0 ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await revokeAllCapabilities();
                refresh();
              })
            }
          >
            <ShieldOff className="size-3.5" aria-hidden="true" /> Close access
          </Button>
        ) : null}
      </header>

      <div className="grid gap-2 p-4 sm:grid-cols-3">
        <SummaryButton
          active={openPanel === "decisions"}
          icon={AlertTriangle}
          title={waiting.length ? `${waiting.length} waiting` : "No decisions waiting"}
          detail="Every machine change still needs approval."
          onClick={() => setOpenPanel(openPanel === "decisions" ? null : "decisions")}
          urgent={waiting.length > 0}
        />
        <SummaryButton
          active={openPanel === "permissions"}
          icon={Settings2}
          title="Permissions"
          detail={`${live.length} of ${caps.length} inspection areas open`}
          onClick={() => setOpenPanel(openPanel === "permissions" ? null : "permissions")}
        />
        <SummaryButton
          active={openPanel === "activity"}
          icon={History}
          title="Activity"
          detail={`${recent.length} recent events${denials.length ? ` · ${denials.length} blocked` : ""}`}
          onClick={() => setOpenPanel(openPanel === "activity" ? null : "activity")}
          urgent={denials.length > 0}
        />
      </div>

      <div className="border-t border-border/60 p-4">
        <WorkspaceSetting root={workspace} onChanged={refresh} />
      </div>

      {openPanel === "decisions" ? (
        <div className="space-y-3 border-t border-border/60 bg-background/25 p-4">
          {waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is waiting. Fadi has not changed the machine.
            </p>
          ) : (
            waiting.map((request) => (
              <PendingAction
                key={request.id}
                w={request}
                onSettled={(message) => {
                  setNote(message);
                  refresh();
                }}
                onDiscovered={setFound}
              />
            ))
          )}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          {found ? (
            <RecordMachine
              found={found}
              onDone={() => {
                setFound(null);
                window.dispatchEvent(new CustomEvent("fadi:resources-changed"));
              }}
            />
          ) : null}
        </div>
      ) : null}

      {openPanel === "permissions" ? (
        <div className="space-y-2 border-t border-border/60 bg-background/25 p-4">
          {/*
            WHAT IS OPEN, NOT WHAT COULD BE.

            This listed every capability Fadi understands with an "Allow for 2h" button
            beside it — a standing menu asking people to grant access in advance, for things
            that may never happen. A permission granted speculatively is one nobody
            remembers giving.

            Fadi asks at the moment it needs something, and the ask arrives in the same
            queue as everything else, wherever the person happens to be. So this panel only
            shows what is currently open, and the only thing it offers is taking it back.
          */}
          {live.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing is open. Fadi will ask when it needs something, and the request will appear
              wherever you are — there is no list here to grant in advance.
            </p>
          ) : (
            live.map((capability) => (
              <div
                key={capability.capability}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{capability.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{capability.limit}</p>
                </div>
                <span className="text-[11px] text-emerald-500">{timeLeft(capability.grantedUntil)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await revokeCapability({ capability: capability.capability });
                      refresh();
                    })
                  }
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {openPanel === "activity" ? (
        <div className="border-t border-border/60 bg-background/25 p-4">
          {denials.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-500">
                {denials.length} request{denials.length === 1 ? " was" : "s were"} blocked. Nothing
                ran.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Review the requester below. Close access if you do not recognise the activity.
              </p>
            </div>
          ) : null}
          <ul className="divide-y divide-border/60">
            {recent.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">No machine activity yet.</li>
            ) : (
              recent.slice(0, 12).map((action) => (
                <li key={action.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={
                        action.decision === "denied"
                          ? "font-medium text-amber-500"
                          : action.decision === "allowed"
                            ? "font-medium text-emerald-500"
                            : "font-medium text-muted-foreground"
                      }
                    >
                      {action.decision}
                    </span>
                    <span>{ACTOR_LABEL[action.actor] ?? action.actor}</span>
                    <span className="text-muted-foreground">· {action.capability}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(action.at).toLocaleString()}
                    </span>
                  </div>
                  {action.detail ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{action.detail}</p>
                  ) : null}
                  {action.command ? (
                    <details className="mt-1 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">Exact command</summary>
                      <code className="mt-1 block overflow-x-auto rounded bg-muted p-1.5">
                        {action.command}
                      </code>
                    </details>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SummaryButton({
  active,
  icon: Icon,
  title,
  detail,
  onClick,
  urgent = false,
}: {
  active: boolean;
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
  onClick: () => void;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/40"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${urgent ? "text-amber-500" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
          {detail}
        </span>
      </span>
      <ChevronDown
        className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${active ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
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
    found.guess?.kind === "hypervisor" ? "Proxmox at " + found.ip : (found.name ?? found.ip)
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
      <p className="text-xs font-medium">
        {found.ip}
        {found.name ? " (" + found.name + ")" : ""} answered.
      </p>
      <p className="text-[11px] text-muted-foreground">
        {found.openPorts.length
          ? "Open: " + found.openPorts.join(", ") + ". "
          : "No common ports open. "}
        {found.guess
          ? "Looks like a " +
            found.guess.kind +
            " — " +
            found.guess.why +
            ", which is a convention rather than proof."
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
        Memory and disk stay unrecorded — a port answering says nothing about them, so Fadi will say
        &ldquo;not enough recorded to tell&rdquo; rather than assume.
      </p>
    </div>
  );
}
