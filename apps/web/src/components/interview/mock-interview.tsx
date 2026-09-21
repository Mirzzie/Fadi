"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlus, Check, ChevronRight, Mic, Square, Volume2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { speakFadi, stopFadiSpeech } from "@/lib/voice/fadi-speech";
import { useGroqVoice } from "@/lib/voice/use-groq-voice";
import { INTERVIEWER_PERSONAS } from "@/lib/interview/personas";
import type { AnswerScore, MockQuestion } from "@/lib/interview/mock";
import {
  saveMockAnswerAsStory,
  scoreMockAnswer,
  startMockInterview,
} from "@/app/dashboard/interview/actions";

type SaveState = "idle" | "saving" | "saved";

type Defaults = { role: string; country: string; seniority: string };

/** A real posting to practise against — its title, employer and description seed the session. */
export type PracticeJob = { title: string; company: string; description: string | null };

export function MockInterview({ defaults, job }: { defaults: Defaults; job?: PracticeJob | null }) {
  // Practising for a specific posting: the questions come from THAT job's description and title,
  // not the profile's generic direction. Everything stays editable — this is a starting point.
  const [config, setConfig] = useState(job ? { ...defaults, role: job.title } : defaults);
  const [jd, setJd] = useState(job?.description ?? "");
  const [persona, setPersona] = useState<string>("hiring_manager");
  const [questions, setQuestions] = useState<MockQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<AnswerScore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const turn = useRef(0);
  const [pending, startTransition] = useTransition();

  const voice = useGroqVoice({
    autoStop: false,
    maxMs: 180_000,
    onError: setError,
    onTranscript: (text) => {
      setAnswer((previous) => (previous ? `${previous} ${text}` : text));
      setScore(null);
      setSaveState("idle");
    },
  });
  const captureBusy = ["requesting", "recording", "transcribing"].includes(voice.state);

  useEffect(() => {
    if (readAloud && questions) void speakFadi(questions[idx].question);
    return () => stopFadiSpeech();
  }, [readAloud, idx, questions]);

  function endInterview() {
    turn.current += 1;
    voice.cancel();
    stopFadiSpeech();
    setQuestions(null);
    setError(null);
  }

  function recordAnswer() {
    setError(null);
    stopFadiSpeech();
    void voice.start();
  }

  function start() {
    const ownTurn = ++turn.current;
    voice.cancel();
    stopFadiSpeech();
    setError(null);
    startTransition(async () => {
      const res = await startMockInterview({
        ...config,
        persona,
        jobDescription: jd || undefined,
      });
      if (ownTurn !== turn.current) return;
      if (!res.ok) return setError(res.message);
      setQuestions(res.questions);
      setIdx(0);
      setAnswer("");
      setScore(null);
    });
  }

  function scoreCurrent() {
    if (!questions || captureBusy) return;
    const ownTurn = turn.current;
    setError(null);
    setSaveState("idle");
    startTransition(async () => {
      const res = await scoreMockAnswer({
        question: questions[idx].question,
        answer,
        role: config.role,
      });
      if (ownTurn !== turn.current) return;
      if (!res.ok) return setError(res.message);
      setScore(res.score);
    });
  }

  function saveAnswerAsStory() {
    if (!questions || saveState !== "idle") return;
    setError(null);
    setSaveState("saving");
    const ownTurn = turn.current;
    void saveMockAnswerAsStory({
      question: questions[idx].question,
      answer,
      role: config.role,
      competency: questions[idx].competency,
    }).then((res) => {
      if (ownTurn !== turn.current) return;
      if (!res.ok) {
        setError(res.message);
        setSaveState("idle");
        return;
      }
      setSaveState("saved");
    });
  }

  function next() {
    if (!questions || captureBusy) return;
    turn.current += 1;
    voice.cancel();
    stopFadiSpeech();
    setError(null);
    setIdx((i) => Math.min(i + 1, questions.length - 1));
    setAnswer("");
    setScore(null);
    setSaveState("idle");
  }

  // ── Setup screen ──
  if (!questions) {
    return (
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Practise an interview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Practise one question at a time. Speak or type your answer, then review the feedback.
          </p>
          {job ? (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
              Practising for <span className="font-medium">{job.title}</span> at{" "}
              <span className="font-medium">{job.company}</span>
              {job.description ? " — questions come from this posting." : " — no description was saved, so questions follow the role."}
            </p>
          ) : null}
        </div>
        <Field label="Role">
          <Input
            value={config.role}
            onChange={(event) =>
              setConfig((previous) => ({
                ...previous,
                role: event.target.value,
              }))
            }
            placeholder="e.g. IT Support Specialist"
          />
        </Field>
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Tailor the questions
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Country / region">
                <Input
                  value={config.country}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      country: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Seniority">
                <Input
                  value={config.seniority}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      seniority: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Interviewer style</span>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={persona}
                onChange={(event) => setPersona(event.target.value)}
              >
                {INTERVIEWER_PERSONAS.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Job description (optional)">
              <Textarea rows={3} value={jd} onChange={(event) => setJd(event.target.value)} />
            </Field>
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={readAloud}
            onChange={(event) => setReadAloud(event.target.checked)}
          />
          Read questions aloud
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="sm" onClick={start} disabled={pending || !config.role.trim()}>
          <Wand2 className="size-4" aria-hidden="true" />
          {pending ? "Setting up…" : "Start mock interview"}
        </Button>
      </section>
    );
  }

  // ── Interview screen ──
  const q = questions[idx];
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Question {idx + 1} of {questions.length}
        </span>
        <Button size="sm" variant="ghost" onClick={endInterview} className="text-muted-foreground">
          End interview
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="mt-0.5 shrink-0 text-[0.6rem] capitalize">
          {q.kind}
        </Badge>
        <p className="text-base font-medium">{q.question}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={captureBusy}
        onClick={() => void speakFadi(q.question)}
      >
        <Volume2 className="size-4" aria-hidden="true" /> Hear question
      </Button>

      <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="interview-answer" className="text-sm font-medium">
            Your answer
          </label>
          {voice.isSupported ? (
            <div className="flex flex-wrap items-center gap-2">
              {voice.state === "recording" ? (
                <Button size="sm" onClick={voice.stop}>
                  <Square className="size-3.5" aria-hidden="true" /> Finish answer
                </Button>
              ) : !captureBusy ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={recordAnswer}>
                  <Mic className="size-3.5" aria-hidden="true" />{" "}
                  {answer ? "Add more by voice" : "Record answer"}
                </Button>
              ) : null}
              {captureBusy ? (
                <Button size="sm" variant="ghost" onClick={voice.cancel}>
                  {voice.state === "recording" ? "Discard recording" : "Cancel"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {voice.state === "recording" ? (
          <p role="status" className="text-sm text-primary">
            Recording · {Math.floor(voice.elapsedMs / 60000)}:
            {String(Math.floor(voice.elapsedMs / 1000) % 60).padStart(2, "0")} / 3:00. Pauses are
            fine; press Finish answer when ready.
          </p>
        ) : voice.state === "requesting" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Waiting for microphone permission…
          </p>
        ) : voice.state === "transcribing" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Transcribing your answer…
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Type or record up to 3 minutes at a time. Review the transcript before getting feedback.
          </p>
        )}
        <Textarea
          id="interview-answer"
          rows={6}
          value={answer}
          disabled={captureBusy || pending}
          onChange={(event) => {
            setAnswer(event.target.value);
            setScore(null);
            setSaveState("idle");
          }}
          placeholder="Your answer appears here. You can edit it before getting feedback."
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={scoreCurrent}
          disabled={pending || captureBusy || !answer.trim()}
        >
          Get feedback
        </Button>
        {idx < questions.length - 1 ? (
          <Button size="sm" variant="outline" onClick={next} disabled={pending || captureBusy}>
            Next question <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {score ? <ScoreCard score={score} saveState={saveState} onSave={saveAnswerAsStory} /> : null}
    </section>
  );
}

function ScoreCard({
  score,
  saveState,
  onSave,
}: {
  score: AnswerScore;
  saveState: SaveState;
  onSave: () => void;
}) {
  const rows: Array<[string, number]> = [
    ["Structure (STAR)", score.scores.structure],
    ["Specificity", score.scores.specificity],
    ["Relevance", score.scores.relevance],
    ["Concision", score.scores.concision],
  ];
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold tabular-nums">
          {score.overall.toFixed(1)}
          <span className="text-sm text-muted-foreground">/5</span>
        </span>
        <span className="text-xs text-muted-foreground">{score.deliveryNote}</span>
      </div>
      <div className="grid gap-1.5">
        {rows.map(([label, v]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr_1.5rem] items-center gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${(v / 5) * 100}%` }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>
      {score.strengths.length > 0 ? (
        <Lines title="Strengths" items={score.strengths} tone="text-emerald-400" />
      ) : null}
      {score.improvements.length > 0 ? (
        <Lines title="To improve" items={score.improvements} tone="text-primary" />
      ) : null}
      {score.strongerVersion ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Stronger version (your content, tightened)
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {score.strongerVersion}
          </p>
        </div>
      ) : null}

      {/* Close the loop — a practiced answer becomes a reusable story (your words, never invented). */}
      <div className="flex items-center gap-2 border-t pt-2">
        {saveState === "saved" ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Check className="size-3.5" aria-hidden="true" /> Saved to your story bank
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={onSave} disabled={saveState === "saving"}>
            <BookmarkPlus className="size-3.5" aria-hidden="true" />
            {saveState === "saving" ? "Saving…" : "Save to story bank"}
          </Button>
        )}
        <span className="text-[0.7rem] text-muted-foreground">
          Reuse this in real interviews, prep, and documents.
        </span>
      </div>
    </div>
  );
}

function Lines({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li
            key={i}
            className={cn(
              "text-sm",
              tone === "text-emerald-400" ? "text-foreground/90" : "text-foreground/90"
            )}
          >
            • {it}
          </li>
        ))}
      </ul>
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
