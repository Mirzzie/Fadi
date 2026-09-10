"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Cpu, HelpCircle, Loader2, Plus, ShieldQuestion, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addLabResource,
  detectLocalResources,
  planLabFor,
  type DetectedResource,
  type LabPlan,
} from "@/app/dashboard/learning/lab-actions";
import { grantCapability } from "@/app/dashboard/learning/permission-actions";

/**
 * "AND WHAT DO I RUN IT ON?"
 *
 * The question that stood between a suggested project and an actual evening's work.
 * Fadi could name a gap and propose a build, and then had nothing to say about whether
 * the person could run it.
 *
 * The hardware question is asked HERE, at the moment a project is proposed — not at
 * onboarding, where a new user does not yet know whether they will ever want a lab and a
 * form about hypervisors is a form about nothing.
 *
 * It never says "no" without saying why, and it distinguishes three answers: this runs
 * here, this cannot run here and here is the reason, and nobody has recorded enough to
 * tell. The third is the one a yes/no design gets wrong — an unmeasured machine reading
 * as suitable is how a plan becomes a wasted evening.
 */
export function LabFit({ title, detail }: { title: string; detail?: string | null }) {
  const [plan, setPlan] = useState<LabPlan | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  const refresh = () =>
    start(async () => {
      const res = await planLabFor({ title, detail });
      if (res.ok && res.plan) setPlan(res.plan);
    });

  useEffect(() => {
    refresh();
    // Every suggestion renders its own LabFit. Adding a machine in ONE of them left the
    // others still saying "Fadi doesn't know what you have to work with yet" — visibly
    // contradicting the card above, which had just found it. They all re-check now.
    const onChanged = () => refresh();
    window.addEventListener("fadi:resources-changed", onChanged);
    return () => window.removeEventListener("fadi:resources-changed", onChanged);
  }, [title, detail]);

  if (!plan) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> checking what you could run this on…
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/30 p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium">
        <Cpu className="size-3.5 text-primary" aria-hidden="true" />
        Where you could run this
      </p>

      {plan.because.length > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{plan.because.join("; ")}.</p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Nothing here suggests it needs more than a laptop.
        </p>
      )}

      {plan.noResources ? (
        adding ? (
          <AddResource
            onDone={() => {
              setAdding(false);
              refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              Fadi doesn&apos;t know what you have to work with yet, so it can&apos;t tell you whether
              this is runnable. Describe one machine and it will.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {/* Fadi is running on this machine — asking the user to transcribe what is
                  installed is asking them to copy out something Fadi can read. */}
              <DetectHere onSaved={() => window.dispatchEvent(new CustomEvent("fadi:resources-changed"))} />
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" aria-hidden="true" />
                Describe one myself
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-1.5 space-y-1">
          {plan.fits.map((f) => (
            <p key={f.id} className="flex items-center gap-1.5 text-emerald-400">
              <Check className="size-3.5 shrink-0" aria-hidden="true" /> {f.label}
            </p>
          ))}
          {plan.unverified.map((u) => (
            <p key={u.id} className="flex items-start gap-1.5 text-amber-300">
              <HelpCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {u.label} — not enough recorded to say. {u.checks.join("; ")}.
              </span>
            </p>
          ))}
          {plan.misses.map((m) => (
            <p key={m.id} className="flex items-start gap-1.5 text-muted-foreground">
              <X className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {m.label} — {m.reasons.join("; ")}.
              </span>
            </p>
          ))}
          {plan.fits.length === 0 && plan.unverified.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nothing you&apos;ve registered can host this as described. That is worth knowing before
              you start, not after.
            </p>
          ) : null}
        </div>
      )}
      {pending ? <p className="mt-1 text-[11px] text-muted-foreground">updating…</p> : null}
    </div>
  );
}

/**
 * One machine, described by its owner.
 *
 * Deliberately short. Every field beyond a name is optional, because a half-remembered
 * machine is still worth more than no machine — and an unknown capacity is reported as
 * unknown downstream rather than assumed to be fine.
 */
function AddResource({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("laptop");
  const [arch, setArch] = useState("x86_64");
  const [memoryGb, setMemoryGb] = useState("");
  const [virt, setVirt] = useState("containers");
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await addLabResource({
        label: label.trim() || "My machine",
        kind: kind as never,
        arch: arch as never,
        memoryMb: memoryGb.trim() ? Math.round(Number(memoryGb) * 1024) : null,
        virtualization: virt as never,
        alwaysOn,
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("fadi:resources-changed"));
        onDone();
      }
    });

  const field = "h-8 rounded-md border border-input bg-background px-2 text-xs";

  return (
    <div className="mt-2 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What do you call it? e.g. the ThinkPad"
          className="h-8 text-xs"
          autoFocus
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
          <option value="laptop">Laptop</option>
          <option value="server">Spare machine / server</option>
          <option value="hypervisor">Hypervisor (Proxmox, ESXi)</option>
          <option value="sbc">Single-board computer (Pi)</option>
          <option value="microcontroller">Microcontroller (ESP32)</option>
          <option value="cloud">Cloud free tier</option>
        </select>
        <select value={arch} onChange={(e) => setArch(e.target.value)} className={field}>
          <option value="x86_64">Intel / AMD (x86_64)</option>
          <option value="arm64">ARM (Pi, Apple silicon)</option>
          <option value="mcu">Microcontroller</option>
        </select>
        <select value={virt} onChange={(e) => setVirt(e.target.value)} className={field}>
          <option value="none">Runs neither containers nor VMs</option>
          <option value="containers">Docker / containers</option>
          <option value="vms">Virtual machines</option>
          <option value="nested">VMs, with nested virtualisation</option>
        </select>
        <Input
          value={memoryGb}
          onChange={(e) => setMemoryGb(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="RAM in GB (leave blank if unsure)"
          className="h-8 text-xs"
          inputMode="decimal"
        />
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={alwaysOn} onChange={(e) => setAlwaysOn(e.target.checked)} />
          It stays on — I can reach it at 3am
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Only the name is required. Leave anything you&apos;re unsure of blank — Fadi will say
        &quot;not enough recorded to tell&quot; rather than guessing that it fits.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending || !label.trim()}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * "What is on this machine?" — answered by looking.
 *
 * DETECTS, NEVER REGISTERS. Finding a hypervisor must not silently hand Fadi a resource
 * it may later be asked to provision on; the user confirms what gets saved.
 *
 * ASKS BEFORE IT LOOKS. Nothing runs until the user grants the named capability, and the
 * ask happens right here rather than in a settings page — a permission request carries
 * meaning only next to the reason for it. Every command lives in a fixed catalogue in
 * broker.ts; no command, argument or path comes from the browser, a request, or a model.
 */
function DetectHere({ onSaved }: { onSaved: () => void }) {
  const [found, setFound] = useState<DetectedResource[] | null>(null);
  const [absent, setAbsent] = useState<string[]>([]);
  const [needsGrant, setNeedsGrant] = useState<
    Array<{ capability: string; summary: string; limit: string }>
  >([]);
  const [pending, start] = useTransition();

  const look = () =>
    start(async () => {
      const res = await detectLocalResources();
      if (res.ok) {
        setFound(res.detected ?? []);
        setAbsent(res.absent ?? []);
        setNeedsGrant(res.needsGrant ?? []);
      }
    });

  // THE PERMISSION IS ASKED HERE, not in a settings page nobody visits.
  //
  // A consent screen at install time is a consent screen about nothing — the user has no
  // idea yet what they are agreeing to or why. Asked at the moment Fadi wants to look, it
  // is a real question with a visible reason, and the limit is stated in the same breath
  // so "allow" means something specific rather than "allow everything, presumably".
  if (needsGrant.length > 0) {
    return (
      <div className="w-full space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <ShieldQuestion className="size-3.5 text-amber-600" aria-hidden="true" />
          Fadi needs your permission first
        </p>
        {needsGrant.map((g) => (
          <div key={g.capability} className="space-y-0.5">
            <p className="text-[11px]">{g.summary}</p>
            <p className="text-[11px] text-muted-foreground">{g.limit}</p>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-0.5">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                for (const g of needsGrant) {
                  await grantCapability({ capability: g.capability });
                }
                setNeedsGrant([]);
                const res = await detectLocalResources();
                if (res.ok) {
                  setFound(res.detected ?? []);
                  setAbsent(res.absent ?? []);
                  setNeedsGrant(res.needsGrant ?? []);
                }
              })
            }
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Allow for 2 hours
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNeedsGrant([])}>
            Not now
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Expires on its own. Every attempt — allowed or blocked — is logged under Machine access.
        </p>
      </div>
    );
  }

  if (found) {
    return (
      <div className="w-full space-y-1.5">
        {found.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nothing detectable here{absent.length ? ` — no ${absent.slice(0, 3).join(", ")}` : ""}. Describe a
            machine instead.
          </p>
        ) : (
          found.map((d) => (
            <div key={d.label} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 p-2">
              <span className="text-xs font-medium">{d.label}</span>
              <span className="text-[11px] text-muted-foreground">{d.detail}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await addLabResource({
                      label: d.label,
                      kind: d.kind as never,
                      arch: d.arch as never,
                      virtualization: d.virtualization as never,
                      memoryMb: d.memoryMb,
                      alwaysOn: false,
                      notes: d.detail,
                    });
                    onSaved();
                  })
                }
              >
                Use this
              </Button>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={look}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Cpu className="size-3.5" aria-hidden="true" />}
      {pending ? "Looking…" : "Detect what's on this machine"}
    </Button>
  );
}
