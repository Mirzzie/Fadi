"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageSquareQuote, Mic, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatStoryAsAnswer, pickBestStory, type StoryView } from "@/lib/interview/story-format";
import {
  deleteStory,
  generateStoryBank,
  saveStory,
} from "@/app/dashboard/interview/actions";

const STAR_FIELDS: Array<{ key: keyof EditState; label: string; rows: number }> = [
  { key: "situation", label: "Situation", rows: 2 },
  { key: "task", label: "Task", rows: 2 },
  { key: "action", label: "Action — what YOU did", rows: 3 },
  { key: "result", label: "Result", rows: 2 },
  { key: "reflection", label: "Reflection — what you learned", rows: 2 },
];

type EditState = {
  title: string;
  competencies: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
};

export function StoryBank({ stories: initial }: { stories: StoryView[] }) {
  const [stories, setStories] = useState<StoryView[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  function upsert(s: StoryView) {
    setStories((prev) => {
      const i = prev.findIndex((p) => p.id === s.id);
      if (i === -1) return [s, ...prev];
      const copy = [...prev];
      copy[i] = s;
      return copy;
    });
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateStoryBank();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setStories((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...res.stories.filter((s) => !ids.has(s.id)), ...prev];
      });
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Interview story bank</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Most behavioral questions are answered by the same{" "}
          <span className="text-foreground">5–10 strong stories</span>. Build them once — in
          STAR + Reflection shape, from your real experience — and reuse them in every interview.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={generate} disabled={pending}>
          <Wand2 className="size-4" aria-hidden="true" />
          {stories.length > 0 ? "Mine more from my experience" : "Generate from my experience"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditingId("new")} disabled={pending}>
          <Plus className="size-4" aria-hidden="true" />
          Add a story
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      <PracticeBox stories={stories} />

      {editingId === "new" ? (
        <StoryEditor
          onCancel={() => setEditingId(null)}
          onSaved={(s) => {
            upsert(s);
            setEditingId(null);
          }}
        />
      ) : null}

      {stories.length === 0 && editingId !== "new" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No stories yet. Generate them from your experience, or add one by hand. Fadi only uses
          your real history — it never invents achievements.
        </p>
      ) : (
        <ul className="space-y-3">
          {stories.map((story) =>
            editingId === story.id ? (
              <StoryEditor
                key={story.id}
                story={story}
                onCancel={() => setEditingId(null)}
                onSaved={(s) => {
                  upsert(s);
                  setEditingId(null);
                }}
              />
            ) : (
              <StoryCard
                key={story.id}
                story={story}
                onEdit={() => setEditingId(story.id)}
                onRemove={(id) => {
                  startTransition(() => {
                    void deleteStory({ id }).then(() =>
                      setStories((prev) => prev.filter((p) => p.id !== id)),
                    );
                  });
                }}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/** Type a behavioral question → get the best real story to answer it (client-side, instant). */
function PracticeBox({ stories }: { stories: StoryView[] }) {
  const [q, setQ] = useState("");
  const match = useMemo(() => (q.trim() ? pickBestStory(stories, q) : null), [q, stories]);

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <label htmlFor="practice-q" className="flex items-center gap-2 text-sm font-medium">
        <Mic className="size-4 text-primary" aria-hidden="true" />
        Practice — paste a behavioral question
      </label>
      <Input
        id="practice-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Tell me about a time you handled conflict on a team."
      />
      {q.trim() && !match ? (
        <p className="text-sm text-muted-foreground">
          No stories yet — build your bank above and your best answer will appear here.
        </p>
      ) : null}
      {match ? (
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="mb-1 text-xs text-muted-foreground">Your strongest story for this:</p>
          <pre className="whitespace-pre-wrap font-sans text-sm">{formatStoryAsAnswer(match)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function StoryCard({
  story,
  onEdit,
  onRemove,
}: {
  story: StoryView;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{story.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {story.competencies.map((c) => (
              <Badge key={c} variant="secondary" className="text-[0.65rem]">
                {c}
              </Badge>
            ))}
            {story.origin === "ai" ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <Sparkles className="size-3" aria-hidden="true" /> drafted from your history
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground/70 transition-colors hover:text-foreground"
            title="Edit"
            aria-label="Edit story"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(story.id)}
            className="text-muted-foreground/60 transition-colors hover:text-destructive"
            title="Remove"
            aria-label="Remove story"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm">
        {(
          [
            ["Situation", story.situation],
            ["Task", story.task],
            ["Action", story.action],
            ["Result", story.result],
            ["Reflection", story.reflection],
          ] as const
        )
          .filter(([, v]) => v.trim())
          .map(([label, v]) => (
            <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="text-foreground/90">{v}</dd>
            </div>
          ))}
      </dl>
    </li>
  );
}

function StoryEditor({
  story,
  onSaved,
  onCancel,
}: {
  story?: StoryView;
  onSaved: (s: StoryView) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditState>({
    title: story?.title ?? "",
    competencies: (story?.competencies ?? []).join(", "),
    situation: story?.situation ?? "",
    task: story?.task ?? "",
    action: story?.action ?? "",
    result: story?.result ?? "",
    reflection: story?.reflection ?? "",
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveStory({
        id: story?.id,
        title: form.title,
        competencies: form.competencies.split(",").map((c) => c.trim()).filter(Boolean),
        situation: form.situation,
        task: form.task,
        action: form.action,
        result: form.result,
        reflection: form.reflection,
      });
      if (!res.ok || !res.story) {
        setError(res.message ?? "Couldn't save.");
        return;
      }
      onSaved(res.story);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <Input
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Story title — e.g. Turned around the stalled migration"
        autoFocus
      />
      <Input
        value={form.competencies}
        onChange={(e) => setForm((f) => ({ ...f, competencies: e.target.value }))}
        placeholder="Competencies, comma-separated — e.g. leadership, conflict, ownership"
      />
      {STAR_FIELDS.map((field) => (
        <label key={field.key} className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{field.label}</span>
          <Textarea
            rows={field.rows}
            value={form[field.key]}
            onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
          />
        </label>
      ))}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !form.title.trim()}>
          Save story
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
