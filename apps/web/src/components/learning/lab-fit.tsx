"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Cpu, HelpCircle, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLabResource, planLabFor, type LabPlan } from "@/app/dashboard/learning/lab-actions";

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

  useEffect(refresh, [title, detail]);

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
            <Button size="sm" variant="outline" className="mt-1.5" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Tell Fadi what I&apos;ve got
            </Button>
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
      if (res.ok) onDone();
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
