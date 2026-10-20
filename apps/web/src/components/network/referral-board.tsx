"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ClipboardCopy,
  Compass,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RELATIONSHIP_LABEL, referralStrategy, type Relationship } from "@/lib/network/outreach";
import type { ReferralStatus, ReferralView } from "@/lib/network/types";
import {
  addReferral,
  draftOutreach,
  markAsked,
  removeReferral,
  updateReferralStatus,
} from "@/app/dashboard/network/actions";

const RELATIONSHIPS: Relationship[] = [
  "alumni",
  "former_colleague",
  "second_degree",
  "friend",
  "recruiter",
  "cold",
];

const STATUS_META: Record<ReferralStatus, { label: string; tone: string }> = {
  identified: { label: "Identified", tone: "text-muted-foreground" },
  asked: { label: "Asked", tone: "text-primary" },
  responded: { label: "Responded", tone: "text-primary" },
  referred: { label: "Referred ✓", tone: "text-emerald-400" },
  declined: { label: "No / passed", tone: "text-muted-foreground" },
};

export function ReferralBoard({ referrals }: { referrals: ReferralView[] }) {
  const [items, setItems] = useState<ReferralView[]>(referrals);
  const asked = items.filter((i) => i.status !== "identified" && i.status !== "declined").length;

  function upsert(next: ReferralView) {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === next.id);
      if (i === -1) return [next, ...prev];
      const copy = [...prev];
      copy[i] = next;
      return copy;
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Referrals &amp; warm intros</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A referral is your <span className="text-foreground">highest-leverage move</span> because
          it&apos;s a genuinely independent draw — it routes around the same screening software that
          rejects your cold applications in a correlated batch. A different door, not the same judge
          again. Track who you can ask, and let Fadi draft the message.
        </p>
        {items.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {asked} {asked === 1 ? "ask" : "asks"} in motion · {items.length} target
            {items.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </header>

      <AddReferralForm onAdded={upsert} />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No referral targets yet. Add a company you&apos;re pursuing — even without a name yet,
          Fadi will show you how to find a path in.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ReferralCard key={item.id} item={item} onChange={upsert} onRemove={(id) => setItems((p) => p.filter((x) => x.id !== id))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddReferralForm({ onAdded }: { onAdded: (r: ReferralView) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: "",
    roleTitle: "",
    contactName: "",
    contactRole: "",
    relationship: "cold" as Relationship,
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addReferral(form);
      if (!res.ok || !res.referral) {
        setError(res.message);
        return;
      }
      onAdded(res.referral);
      setForm({ company: "", roleTitle: "", contactName: "", contactRole: "", relationship: "cold" });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Add a referral target
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company *">
          <Input
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="e.g. Stripe"
            autoFocus
          />
        </Field>
        <Field label="Role you're targeting">
          <Input
            value={form.roleTitle}
            onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
            placeholder="e.g. Product Designer"
          />
        </Field>
        <Field label="Contact name (optional)">
          <Input
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            placeholder="If you have someone in mind"
          />
        </Field>
        <Field label="Their role (optional)">
          <Input
            value={form.contactRole}
            onChange={(e) => setForm((f) => ({ ...f, contactRole: e.target.value }))}
            placeholder="e.g. Design Lead"
          />
        </Field>
        <Field label="How you'd connect">
          <select
            aria-label="How you'd connect"
            value={form.relationship}
            onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value as Relationship }))}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !form.company.trim()}>
          <Check className="size-4" aria-hidden="true" />
          Add target
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ReferralCard({
  item,
  onChange,
  onRemove,
}: {
  item: ReferralView;
  onChange: (r: ReferralView) => void;
  onRemove: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [showStrategy, setShowStrategy] = useState(false);
  const [draft, setDraft] = useState<string | null>(item.outreachDraft);
  const [reward, setReward] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const status = STATUS_META[item.status];

  function doDraft() {
    startTransition(async () => {
      const res = await draftOutreach({ id: item.id });
      if (res.ok && res.draft) {
        setDraft(res.draft);
        onChange({ ...item, outreachDraft: res.draft });
      }
    });
  }

  function doMarkAsked() {
    startTransition(async () => {
      const res = await markAsked({ id: item.id });
      if (res.ok) {
        if (res.delta) setReward(`${res.message} (+${res.delta} momentum)`);
        onChange({ ...item, status: "asked" });
      }
    });
  }

  function doStatus(next: ReferralStatus) {
    startTransition(async () => {
      const res = await updateReferralStatus({ id: item.id, status: next });
      if (res.ok) onChange({ ...item, status: next });
    });
  }

  function copy() {
    if (!draft) return;
    void navigator.clipboard?.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.company}</span>
            {item.roleTitle ? (
              <span className="text-sm text-muted-foreground">· {item.roleTitle}</span>
            ) : null}
            <Badge variant="secondary" className="text-[0.65rem]">
              {RELATIONSHIP_LABEL[item.relationship]}
            </Badge>
          </div>
          {item.contactName ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {item.contactName}
              {item.contactRole ? ` — ${item.contactRole}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("text-xs font-medium", status.tone)}>{status.label}</span>
          <button
            type="button"
            onClick={() => startTransition(() => { void removeReferral({ id: item.id }).then(() => onRemove(item.id)); })}
            className="text-muted-foreground/60 transition-colors hover:text-destructive"
            title="Remove"
            aria-label="Remove target"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* How to find a path in — honest, since we can't read your network. */}
      <button
        type="button"
        onClick={() => setShowStrategy((s) => !s)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        <Compass className="size-3.5" aria-hidden="true" />
        {showStrategy ? "Hide" : "How to find a path in"}
      </button>
      {showStrategy ? (
        <ul className="mt-2 space-y-1.5">
          {referralStrategy(item.company).map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Outreach draft */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={doDraft} disabled={pending}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {draft ? "Redraft with Fadi" : "Draft outreach with Fadi"}
          </Button>
          {item.status === "identified" ? (
            <Button size="sm" onClick={doMarkAsked} disabled={pending}>
              <Send className="size-3.5" aria-hidden="true" />
              I reached out
            </Button>
          ) : null}
        </div>

        {draft ? (
          <div className="space-y-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="text-sm"
            />
            <Button size="sm" variant="ghost" onClick={copy} className="text-muted-foreground">
              <ClipboardCopy className="size-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Funnel advance after the ask */}
      {item.status !== "identified" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Update:</span>
          {(["responded", "referred", "declined"] as ReferralStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => doStatus(s)}
              disabled={pending || item.status === s}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                item.status === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      ) : null}

      {reward ? <p className="mt-2 text-xs text-primary">{reward}</p> : null}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
