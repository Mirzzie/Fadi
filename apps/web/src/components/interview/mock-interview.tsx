"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlus, Check, ChevronRight, Mic, Square, Volume2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { primeFadiVoice, stopFadiSpeech } from "@/lib/voice/fadi-speech";
import {
  INTERVIEW_THOUGHTFUL_PAUSE_MS,
  resolveVoiceSessionPhase,
  VOICE_SESSION_LABEL,
} from "@/lib/voice/session-state";
import { useGroqVoice } from "@/lib/voice/use-groq-voice";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import type { AnswerScore, MockQuestion } from "@/lib/interview/mock";
import {
  finishMockInterviewSession,
  saveMockAnswerAsStory,
  scoreMockAnswer,
  startMockInterview,
} from "@/app/dashboard/interview/actions";

type SaveState = "idle" | "saving" | "saved";

type Defaults = { role: string; country: string; seniority: string };
type InterviewStage = "recruiter" | "hiring_manager" | "technical" | "behavioral";

const INTERVIEW_STAGES: Array<{ value: InterviewStage; label: string }> = [
  { value: "recruiter", label: "Recruiter screen" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
];

/** A real posting to practise against — its title, employer and description seed the session. */
export type PracticeJob = {
  jobId: string;
  applicationId: string | null;
  title: string;
  company: string;
  description: string | null;
};

export type PracticeSession = {
  id: string;
  role: string;
  company: string | null;
  stage: InterviewStage;
  durationMinutes: 10 | 20;
  questions: MockQuestion[];
};

export function MockInterview({
  defaults,
  job,
  initialSession,
}: {
  defaults: Defaults;
  job?: PracticeJob | null;
  initialSession?: PracticeSession | null;
}) {
  // Practising for a specific posting: the questions come from THAT job's description and title,
  // not the profile's generic direction. Everything stays editable — this is a starting point.
  const [config, setConfig] = useState(
    initialSession
      ? { ...defaults, role: initialSession.role }
      : job
        ? { ...defaults, role: job.title }
        : defaults
  );
  const [jd, setJd] = useState(job?.description ?? "");
  const [stage, setStage] = useState<InterviewStage>(initialSession?.stage ?? "hiring_manager");
  const [durationMinutes, setDurationMinutes] = useState<10 | 20>(
    initialSession?.durationMinutes ?? 10
  );
  const [questions, setQuestions] = useState<MockQuestion[] | null>(
    initialSession?.questions ?? null
  );
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<AnswerScore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [voiceConversation, setVoiceConversation] = useState(true);
  const [awaitingQuestionSpeech, setAwaitingQuestionSpeech] = useState(false);
  const turn = useRef(0);
  const listenAfterSpeech = useRef(false);
  const questionSpeechStarted = useRef(false);
  const [pending, startTransition] = useTransition();
  const { state: speechState, speak: speakOutput } = useSpeechOutput();

  const voice = useGroqVoice({
    autoStop: voiceConversation,
    // A short dictation pause is 1.4 seconds. An interview answer needs room to think:
    // four seconds ends a turn without cutting off a deliberate pause.
    silenceMs: INTERVIEW_THOUGHTFUL_PAUSE_MS,
    noSpeechMs: 10_000,
    maxMs: 180_000,
    onError: setError,
    onTranscript: (text) => {
      setAnswer((previous) => (previous ? `${previous} ${text}` : text));
      setScore(null);
      setSaveState("idle");
    },
  });
  const { start: startVoice, cancel: cancelVoice } = voice;
  const captureBusy = ["requesting", "recording", "transcribing"].includes(voice.state);
  const phase = resolveVoiceSessionPhase({
    recorder: voice.state,
    speaking: speechState === "speaking" || awaitingQuestionSpeech,
    thinking: pending && Boolean(answer.trim()),
    ready: Boolean(answer.trim()) && !score,
    error: Boolean(error),
  });
  const turnBusy = captureBusy || phase === "speaking";

  const speakQuestion = useCallback(
    (question: string, thenListen: boolean) => {
      setError(null);
      cancelVoice();
      listenAfterSpeech.current = thenListen;
      questionSpeechStarted.current = false;
      setAwaitingQuestionSpeech(true);
      speakOutput(question);
    },
    [cancelVoice, speakOutput]
  );

  useEffect(() => {
    if (!voiceConversation || !questions) return;
    const timer = setTimeout(() => speakQuestion(questions[idx].question, true), 0);
    return () => clearTimeout(timer);
  }, [idx, questions, speakQuestion, voiceConversation]);

  useEffect(() => {
    if (speechState === "speaking") {
      questionSpeechStarted.current = true;
      return;
    }
    if (!questionSpeechStarted.current) return;
    questionSpeechStarted.current = false;
    setAwaitingQuestionSpeech(false);
    if (!listenAfterSpeech.current) return;
    listenAfterSpeech.current = false;
    const timer = setTimeout(() => void startVoice(), 350);
    return () => clearTimeout(timer);
  }, [speechState, startVoice]);

  // If this machine has no usable voice, the interview must still continue. Waiting forever
  // would make the screen look frozen, so the microphone opens after a visible grace period.
  useEffect(() => {
    if (!awaitingQuestionSpeech) return;
    const timer = setTimeout(() => {
      if (!listenAfterSpeech.current) return;
      listenAfterSpeech.current = false;
      setAwaitingQuestionSpeech(false);
      void startVoice();
    }, 8_000);
    return () => clearTimeout(timer);
  }, [awaitingQuestionSpeech, startVoice]);

  useEffect(
    () => () => {
      listenAfterSpeech.current = false;
      stopFadiSpeech();
    },
    []
  );

  function finishInterview(status: "completed" | "abandoned") {
    turn.current += 1;
    listenAfterSpeech.current = false;
    setAwaitingQuestionSpeech(false);
    voice.cancel();
    stopFadiSpeech();
    const finishing = sessionId;
    setQuestions(null);
    setSessionId(null);
    setError(null);
    if (finishing) {
      void finishMockInterviewSession({ sessionId: finishing, status }).then((result) => {
        if (!result.ok) setError("The interview ended here, but Fadi could not save its status.");
      });
    }
  }

  function recordAnswer() {
    setError(null);
    listenAfterSpeech.current = false;
    setAwaitingQuestionSpeech(false);
    stopFadiSpeech();
    void voice.start();
  }

  function interruptAndAnswer() {
    listenAfterSpeech.current = false;
    questionSpeechStarted.current = false;
    setAwaitingQuestionSpeech(false);
    stopFadiSpeech();
    void voice.start();
  }

  function start() {
    if (voiceConversation) primeFadiVoice();
    const ownTurn = ++turn.current;
    voice.cancel();
    stopFadiSpeech();
    setError(null);
    startTransition(async () => {
      const res = await startMockInterview({
        ...config,
        stage,
        durationMinutes,
        jobDescription: jd || undefined,
        company: job?.company ?? initialSession?.company ?? null,
        jobId: job?.jobId ?? null,
        applicationId: job?.applicationId ?? null,
      });
      if (ownTurn !== turn.current) return;
      if (!res.ok) return setError(res.message);
      setQuestions(res.questions);
      setSessionId(res.sessionId);
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
        sessionId,
        questionIndex: idx,
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
    listenAfterSpeech.current = false;
    setAwaitingQuestionSpeech(false);
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
              {job.description
                ? " — questions come from this posting."
                : " — no description was saved, so questions follow the role."}
            </p>
          ) : null}
        </div>
        {!job ? (
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
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceRow
            label="Interview stage"
            options={INTERVIEW_STAGES}
            value={stage}
            onChange={setStage}
          />
          <ChoiceRow
            label="Practice length"
            options={[
              { value: 10 as const, label: "10 min · 4 questions" },
              { value: 20 as const, label: "20 min · 7 questions" },
            ]}
            value={durationMinutes}
            onChange={setDurationMinutes}
          />
        </div>
        {!job ? (
          <details className="rounded-lg border border-border/60 px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Add a job description or more context
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
              <Field label="Job description">
                <Textarea rows={3} value={jd} onChange={(event) => setJd(event.target.value)} />
              </Field>
            </div>
          </details>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
          <div>
            <p className="font-medium text-foreground">
              {voiceConversation ? "Fadi will interview you aloud" : "Text practice"}
            </p>
            <p className="text-xs text-muted-foreground">
              {voiceConversation
                ? "Fadi asks, listens after the question, and waits through a thoughtful pause."
                : "Questions and answers stay on screen; your microphone remains off."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setVoiceConversation((value) => !value)}
          >
            {voiceConversation ? "Use text instead" : "Use voice"}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="sm" onClick={start} disabled={pending || !config.role.trim()}>
          <Wand2 className="size-4" aria-hidden="true" />
          {pending ? "Setting up…" : "Start interview"}
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => finishInterview("abandoned")}
          className="text-muted-foreground"
        >
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
        onClick={() => speakQuestion(q.question, voiceConversation)}
      >
        <Volume2 className="size-4" aria-hidden="true" /> Ask again
      </Button>

      <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="interview-answer" className="text-sm font-medium">
            Your answer
          </label>
          {voice.isSupported ? (
            <div className="flex flex-wrap items-center gap-2">
              {phase === "speaking" ? (
                <Button size="sm" onClick={interruptAndAnswer}>
                  <Mic className="size-3.5" aria-hidden="true" /> Interrupt and answer
                </Button>
              ) : voice.state === "recording" ? (
                <Button size="sm" onClick={voice.stop}>
                  <Square className="size-3.5" aria-hidden="true" /> Finish answer
                </Button>
              ) : !captureBusy ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={recordAnswer}>
                  <Mic className="size-3.5" aria-hidden="true" />{" "}
                  {answer ? "Add more by voice" : "Record answer"}
                </Button>
              ) : null}
              {captureBusy && voice.state !== "recording" ? (
                <Button size="sm" variant="ghost" onClick={voice.cancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {phase === "listening" ? (
          <p role="status" className="text-sm text-primary">
            Listening · {Math.floor(voice.elapsedMs / 60000)}:
            {String(Math.floor(voice.elapsedMs / 1000) % 60).padStart(2, "0")} / 3:00. Pauses are
            fine; four seconds of quiet ends the answer, or press Finish answer.
          </p>
        ) : phase !== "idle" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {VOICE_SESSION_LABEL[phase]}…
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Type or speak for up to 3 minutes. Review the transcript before getting feedback.
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
        <Button size="sm" onClick={scoreCurrent} disabled={pending || turnBusy || !answer.trim()}>
          Get feedback
        </Button>
        {idx < questions.length - 1 ? (
          <Button size="sm" variant="outline" onClick={next} disabled={pending || turnBusy}>
            Next question <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => finishInterview("completed")}
            disabled={pending || turnBusy}
          >
            <Check className="size-4" aria-hidden="true" /> Finish interview
          </Button>
        )}
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
  const rows: Array<[string, number]> = score.scores
    ? [
        ["Structure (STAR)", score.scores.structure],
        ["Specificity", score.scores.specificity],
        ["Relevance", score.scores.relevance],
        ["Concision", score.scores.concision],
      ]
    : [];
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        {score.overall === null ? (
          <span className="text-sm font-medium">Transcript check only</span>
        ) : (
          <span className="text-xl font-semibold tabular-nums">
            {score.overall.toFixed(1)}
            <span className="text-sm text-muted-foreground">/5</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground">{score.transcriptNote}</span>
      </div>
      {rows.length > 0 ? (
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
      ) : null}
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

/**
 * A handful of options, all visible, one tap to choose. Replaces a dropdown: with four choices
 * or fewer there is room to show them, and a closed select hides what the choices even are.
 */
function ChoiceRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="text-xs text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={
              option.value === value
                ? "rounded-md border border-primary/50 bg-primary/12 px-2.5 py-1.5 text-xs font-medium text-primary"
                : "rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
