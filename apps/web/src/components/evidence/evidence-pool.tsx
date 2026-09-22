"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildEvidencePool, deleteEvidence, saveEvidence } from "@/app/dashboard/evidence/actions";
import { RenderingsPanel } from "./renderings-panel";
import { SameThingPanel } from "./same-thing-panel";
import { HistoryCapture } from "@/components/evidence/history-capture";
import type { EvidenceView, RankedEvidence } from "@/lib/evidence/pool";

const KINDS = ["experience", "project", "achievement", "skill", "education"] as const;

export function EvidencePool({
  track,
  ranked,
  hasStoredHistory = false,
}: {
  track: { role: string; domain: string | null } | null;
  ranked: RankedEvidence[];
  /** A CV or LinkedIn text is already on file — so the screen can say what is missing. */
  hasStoredHistory?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [capturing, setCapturing] = useState(false);

  function build() {
    setError(null);
    startTransition(async () => {
      const r = await buildEvidencePool();
      if (!r.ok) setError(r.message);
      else {
        // TWO NUMBERS THAT MEANT DIFFERENT THINGS read as one that disagreed with itself: this
        // counted imports held for a decision, while the panel below counts every pair it
        // raises, including ones between records already accepted. Say which is which.
        setNotice(
          r.pendingReview > 0
            ? `${r.items.length} new records saved. ${r.pendingReview} ${r.pendingReview === 1 ? "import is" : "imports are"} waiting on your decision below.`
            : `${r.items.length} new records saved.`
        );
        setReviewVersion(v => v + 1);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteEvidence({ id });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Your evidence</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your real experience, stored once. It&apos;s ranked here for your active direction
          {track ? (
            <>
              {" — "}
              <span className="text-foreground">{track.role}</span>
            </>
          ) : (
            <> (set a direction to frame it)</>
          )}
          . Switch directions and the <span className="text-foreground">same evidence re-ranks</span>{" "}
          for that path — one truthful history, many career identities.
        </p>
      </header>

      {/* ONE DOOR. There used to be two verbs here — "Build from my history" (which read a CV
          saved on another screen) and "Add an item" — plus a third upload box below, and a CV
          could sit saved with nothing built from it. Adding history IS the same box either way,
          so the buttons open it rather than doing a different thing. */}
      {ranked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCapturing((v) => !v)} disabled={pending}>
            <Wand2 className="size-4" aria-hidden="true" />
            Add more history
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing("new")} disabled={pending}>
            <Plus className="size-4" aria-hidden="true" />
            Add one by hand
          </Button>
        </div>
      ) : null}
      {capturing && ranked.length > 0 ? (
        <HistoryCapture
          title="Add more of your history"
          onSaved={() => {
            setCapturing(false);
            setError(null);
            build();
          }}
        />
      ) : null}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {error ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {/* Duplicates are caught HERE because the pool is what every other surface
          projects from — one reality stored twice becomes a duplicate in the résumé,
          the portfolio and Fadi's prompt block simultaneously. */}
      <SameThingPanel key={reviewVersion} onChanged={() => router.refresh()} />

      {editing === "new" ? (
        <EvidenceEditor onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setReviewVersion(v => v + 1); router.refresh(); }} />
      ) : null}

      {ranked.length === 0 && editing !== "new" ? (
        <div className="space-y-3">
          {hasStoredHistory ? (
            /* A CV saved with nothing built from it was the commonest broken state: the text was
               on file, the record was empty, and every other screen quietly had nothing to work
               with. Say that plainly, and make the fix one button. */
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium">Your CV is saved — Fadi hasn&apos;t read it yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reading it turns it into records you can check and correct. Everything else —
                documents, your portfolio, interview prep — works from those records, not from the
                CV text.
              </p>
              <Button size="sm" className="mt-3" onClick={build} disabled={pending}>
                <Wand2 className="size-4" aria-hidden="true" />
                {pending ? "Reading your CV…" : "Read it and build my record"}
              </Button>
            </div>
          ) : (
            <HistoryCapture
              onSaved={() => {
                setError(null);
                build();
              }}
            />
          )}
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Or add one item by hand
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {ranked.map((r) =>
            editing === r.item.id ? (
              <EvidenceEditor
                key={r.item.id}
                item={r.item}
                onClose={() => setEditing(null)}
                onSaved={() => { setEditing(null); setReviewVersion(v => v + 1); router.refresh(); }}
              />
            ) : (
              <EvidenceCard
                key={r.item.id}
                ranked={r}
                hasTrack={Boolean(track)}
                trackRole={track?.role ?? ""}
                onEdit={() => setEditing(r.item.id)}
                onRemove={() => remove(r.item.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function EvidenceCard({
  ranked,
  hasTrack,
  trackRole,
  onEdit,
  onRemove,
}: {
  ranked: RankedEvidence;
  hasTrack: boolean;
  trackRole: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { item, score, matched } = ranked;
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[0.6rem] capitalize">{item.kind}</Badge>
            <span className="font-medium">{item.title}</span>
            {item.origin === "ai" ? <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
          </div>
          {item.organization || item.period ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[item.organization, item.period].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onEdit} className="text-muted-foreground/70 hover:text-foreground" title="Edit" aria-label="Edit">
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} className="text-muted-foreground/60 hover:text-destructive" title="Remove" aria-label="Remove">
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {item.detail ? <p className="mt-2 text-sm text-foreground/90">{item.detail}</p> : null}
      {item.metrics ? <p className="mt-1 text-sm text-primary">{item.metrics}</p> : null}

      {item.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{t}</span>
          ))}
        </div>
      ) : null}

      {/* Per-track framing — the graph in action. */}
      {hasTrack ? (
        score > 0 ? (
          <p className="mt-2 text-xs text-emerald-400">
            Strong evidence for {trackRole}{matched.length ? ` (matches: ${matched.join(", ")})` : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Not central to {trackRole} — kept in your pool for your other directions.
          </p>
        )
      ) : null}

      {/* The other wordings of this same fact, if any — the payoff of separating a
          real thing from the words used to describe it. */}
      <RenderingsPanel itemId={item.id} />
    </li>
  );
}

function EvidenceEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: EvidenceView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: String(item?.kind ?? "experience"),
    title: item?.title ?? "",
    organization: item?.organization ?? "",
    period: item?.period ?? "",
    detail: item?.detail ?? "",
    metrics: item?.metrics ?? "",
    tags: (item?.tags ?? []).join(", "),
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveEvidence({
        id: item?.id,
        kind: form.kind,
        title: form.title,
        organization: form.organization,
        period: form.period,
        detail: form.detail,
        metrics: form.metrics,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (!res.ok) return setError(res.message);
      onSaved();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Kind</span>
          <select
            aria-label="Kind"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize"
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus /></Field>
        <Field label="Organization"><Input value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} /></Field>
        <Field label="Period"><Input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2021–2023" /></Field>
      </div>
      <Field label="What you did"><Textarea rows={2} value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} /></Field>
      <Field label="Real metrics / outcome (optional)"><Input value={form.metrics} onChange={(e) => setForm((f) => ({ ...f, metrics: e.target.value }))} /></Field>
      <Field label="Tags (skills/domains, comma-separated — these power per-track relevance)">
        <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="e.g. patient care, triage, leadership" />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !form.title.trim()}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
