"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlus, Check, ChevronRight, Headphones, Mic, Square, Volume2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { speakFadi, subscribeFadiSpeaking } from "@/lib/voice/fadi-speech";
import { useSpeechInput } from "@/lib/voice/use-speech-input";
import { INTERVIEWER_PERSONAS } from "@/lib/interview/personas";
import type { AnswerScore, MockQuestion } from "@/lib/interview/mock";
import { saveMockAnswerAsStory, scoreMockAnswer, startMockInterview } from "@/app/dashboard/interview/actions";

type SaveState = "idle" | "saving" | "saved";

type Defaults = { role: string; country: string; seniority: string };

export function MockInterview({ defaults }: { defaults: Defaults }) {
  const [config, setConfig] = useState(defaults);
  const [jd, setJd] = useState("");
  const [persona, setPersona] = useState<string>("hiring_manager");
  const [questions, setQuestions] = useState<MockQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<AnswerScore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [convo, setConvo] = useState(false);
  const [pending, startTransition] = useTransition();

  // $0, private, in-browser speech-to-text (Web Speech API) — no API key, nothing
  // leaves the browser (Chrome routes STT to Google; swap in self-hosted Whisper
  // later for full privacy). Only append FINAL results so interim words don't spam.
  const voice = useSpeechInput({
    onTranscript: (t, isFinal) => {
      if (isFinal && t.trim()) setAnswer((prev) => (prev ? `${prev} ${t}` : t));
    },
  });

  // Conversation mode = the "live talk" loop, all $0 (browser TTS + STT): Fadi speaks
  // each new question aloud, then auto-starts listening when he finishes; and speaks a
  // one-line verdict when a score lands. Manual controls stay for anyone who prefers them.
  const spokeForIdx = useRef(-1);
  useEffect(() => {
    if (!convo || !questions) return;
    if (spokeForIdx.current === idx) return;
    spokeForIdx.current = idx;
    let started = false;
    let done = false;
    void speakFadi(questions[idx].question);
    // Auto-listen once Fadi finishes speaking the question (true → false transition).
    const unsub = subscribeFadiSpeaking((speaking) => {
      if (speaking) started = true;
      else if (started && !done) {
        done = true;
        unsub();
        if (voice.isSupported && voice.state === "idle") voice.start();
      }
    });
    return () => {
      done = true;
      unsub();
    };
    // voice is intentionally omitted — it changes every render; we only re-run per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo, idx, questions]);

  // Speak a short spoken verdict when a fresh score arrives (conversation mode).
  const spokenScore = useRef<AnswerScore | null>(null);
  useEffect(() => {
    if (!convo || !score || spokenScore.current === score) return;
    spokenScore.current = score;
    const tip = score.improvements[0] ?? score.strengths[0] ?? "";
    void speakFadi(`${score.overall.toFixed(1)} out of 5. ${tip}`);
  }, [convo, score]);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startMockInterview({ ...config, persona, jobDescription: jd || undefined });
      if (!res.ok) return setError(res.message);
      setQuestions(res.questions);
      setIdx(0);
      setAnswer("");
      setScore(null);
    });
  }

  function scoreCurrent() {
    if (!questions) return;
    setError(null);
    setSaveState("idle");
    startTransition(async () => {
      const res = await scoreMockAnswer({ question: questions[idx].question, answer, role: config.role });
      if (!res.ok) return setError(res.message);
      setScore(res.score);
    });
  }

  function saveAnswerAsStory() {
    if (!questions || saveState !== "idle") return;
    setError(null);
    setSaveState("saving");
    void saveMockAnswerAsStory({
      question: questions[idx].question,
      answer,
      role: config.role,
      competency: questions[idx].competency,
    }).then((res) => {
      if (!res.ok) {
        setError(res.message);
        setSaveState("idle");
        return;
      }
      setSaveState("saved");
    });
  }

  function next() {
    if (!questions) return;
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
          <h2 className="text-base font-semibold">Voice mock interview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A realistic round tuned to your role, seniority, and country&apos;s interview norms. Fadi
            asks; you answer out loud; you get a scored autopsy of each answer.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Role">
            <Input value={config.role} onChange={(e) => setConfig((c) => ({ ...c, role: e.target.value }))} placeholder="e.g. Staff Nurse" />
          </Field>
          <Field label="Country / region">
            <Input value={config.country} onChange={(e) => setConfig((c) => ({ ...c, country: e.target.value }))} placeholder="e.g. Germany" />
          </Field>
          <Field label="Seniority">
            <Input value={config.seniority} onChange={(e) => setConfig((c) => ({ ...c, seniority: e.target.value }))} placeholder="e.g. mid" />
          </Field>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Interviewer style</span>
          <div className="flex flex-wrap gap-2">
            {INTERVIEWER_PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id)}
                title={p.blurb}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  persona === p.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[0.7rem] text-muted-foreground">
            {INTERVIEWER_PERSONAS.find((p) => p.id === persona)?.blurb}
          </p>
        </div>
        <Field label="Paste a job description (optional, sharpens the questions)">
          <Textarea rows={3} value={jd} onChange={(e) => setJd(e.target.value)} />
        </Field>
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
        <Button size="sm" variant="ghost" onClick={() => setQuestions(null)} className="text-muted-foreground">
          End
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="mt-0.5 shrink-0 text-[0.6rem] capitalize">{q.kind}</Badge>
        <p className="text-base font-medium">{q.question}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void speakFadi(q.question)}>
          <Volume2 className="size-4" aria-hidden="true" />
          Hear it
        </Button>
        <Button
          size="sm"
          variant={convo ? "default" : "outline"}
          onClick={() => setConvo((v) => !v)}
          title="Fadi speaks questions and verdicts aloud and auto-listens for your answer"
        >
          <Headphones className="size-4" aria-hidden="true" />
          {convo ? "Conversation: on" : "Conversation mode"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Your answer</span>
          {voice.isSupported ? (
            <Button
              size="sm"
              variant={voice.state === "listening" ? "default" : "outline"}
              onClick={() => (voice.state === "listening" ? voice.stop() : voice.start())}
              disabled={voice.state === "processing"}
            >
              {voice.state === "listening" ? (
                <><Square className="size-3.5" aria-hidden="true" /> Stop</>
              ) : voice.state === "processing" ? (
                "…"
              ) : (
                <><Mic className="size-3.5" aria-hidden="true" /> Speak</>
              )}
            </Button>
          ) : null}
        </div>
        <Textarea
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Speak your answer (Speak), or type it here."
        />
        {voice.state === "listening" ? (
          <p className="text-xs text-primary">
            Listening… <span className="text-muted-foreground">{voice.interimTranscript}</span>
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={scoreCurrent} disabled={pending || !answer.trim()}>
          Score my answer
        </Button>
        {idx < questions.length - 1 ? (
          <Button size="sm" variant="outline" onClick={next} disabled={pending}>
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
          {score.overall.toFixed(1)}<span className="text-sm text-muted-foreground">/5</span>
        </span>
        <span className="text-xs text-muted-foreground">{score.deliveryNote}</span>
      </div>
      <div className="grid gap-1.5">
        {rows.map(([label, v]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr_1.5rem] items-center gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(v / 5) * 100}%` }} />
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
          <p className="text-xs font-medium text-muted-foreground">Stronger version (your content, tightened)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{score.strongerVersion}</p>
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
        <span className="text-[0.7rem] text-muted-foreground">Reuse this in real interviews, prep, and documents.</span>
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
          <li key={i} className={cn("text-sm", tone === "text-emerald-400" ? "text-foreground/90" : "text-foreground/90")}>
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
