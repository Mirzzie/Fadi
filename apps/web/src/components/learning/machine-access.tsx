"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getWorkspace,
  listPermissions,
  registerDiscovered,
  revokeCapability,
  setWorkspace,
  type ActionView,
  type CapabilityView,
} from "@/app/dashboard/learning/permission-actions";
import { PendingAction, type Discovered } from "@/components/os/pending-action-card";
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

function timeLeft(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60_000);
  return mins >= 60 ? Math.round(mins / 60) + "h left" : mins + "m left";
}

export function MachineAccess() {
  const [caps, setCaps] = useState<CapabilityView[] | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const [recent, setRecent] = useState<ActionView[]>([]);
  // The queue is owned by the shell, not by this panel. It used to poll for itself, which
  // meant a decision existed only while someone was looking at this page.
  const { pending: waiting } = usePendingActions();
  const [workspace, setWorkspaceRoot] = useState<string | null>(null);
  const [found, setFound] = useState<Discovered | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    const [perms, ws] = await Promise.all([listPermissions(), getWorkspace()]);
    if (perms.ok) {
      setCheckedAt(Date.now());
      setCaps(perms.capabilities ?? []);
      setRecent(perms.recent ?? []);
    }
    if (ws.ok) setWorkspaceRoot(ws.root ?? null);
  }, []);

  useEffect(() => {
    refresh();
    // Real-time enough to matter: a grant that expired or an attempt made while the page
    // was open should not need a reload to become visible. Polling, not a socket — the
    // truth lives in Postgres and this is a single-user machine.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!caps) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> loading machine access…
      </p>
    );
  }

  const live = caps.filter((c) => c.grantedUntil && Date.parse(c.grantedUntil) > checkedAt);
  const denials = recent.filter((a) => a.decision === "denied");

  // Rows, and only the rows that have something in them. This was three summary cards, a
  // header, a warning box and a caption on each — around one setting and a link.
  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <WorkspaceSetting root={workspace} onChanged={refresh} />
      </div>

      {waiting.length > 0 ? (
        <div className="space-y-3 px-4 py-3">
          <p className="text-sm font-semibold">Waiting for you</p>
          {waiting.map((request) => (
            <PendingAction
              key={request.id}
              w={request}
              onSettled={(message) => {
                setNote(message);
                refresh();
              }}
              onDiscovered={setFound}
            />
          ))}
        </div>
      ) : null}
      {note || found ? (
        <div className="space-y-2 px-4 py-3">
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

      <details className="px-4 py-3">
        <summary className="cursor-pointer text-sm">
          {live.length
            ? `${live.length} active permissions · manage access`
            : "No active machine permissions"}
        </summary>
        <div className="mt-2 divide-y divide-border/60">
          {live.map((capability) => (
            <div
              key={capability.capability}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <p className="min-w-0 flex-1 text-sm">{capability.summary}</p>
              <span className="text-xs text-muted-foreground">
                {timeLeft(capability.grantedUntil, checkedAt)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await revokeCapability({
                      capability: capability.capability,
                    });
                    refresh();
                  })
                }
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </details>

      <Link
        href="/dashboard/learning/activity"
        className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
      >
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">Everything Fadi did or tried</span>
        {denials.length > 0 ? (
          <span className="text-xs text-warning">
            {denials.length} blocked
          </span>
        ) : null}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
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
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm">Project folder</span>
        {root ? (
          <code className="truncate text-xs text-muted-foreground">{root}</code>
        ) : (
          <span className="text-xs text-muted-foreground">
            Not set — Fadi can&apos;t touch your files
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setPath(root ?? "");
            setError(null);
            setEditing((value) => !value);
          }}
        >
          {editing ? "Cancel" : root ? "Change" : "Choose"}
        </Button>
      </div>

      {editing ? (
        <div className="mt-2 space-y-1.5">
          <input
            aria-label="Project folder path"
            autoFocus
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/home/you/fadi-labs"
            spellCheck={false}
            className="h-7 w-full max-w-md rounded border border-border bg-background px-2 font-mono text-[11px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Fadi can read and write inside this folder only. Clear it to remove access.
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
    <div className="space-y-1.5 rounded-md border border-success/40 bg-success/5 p-2.5">
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
