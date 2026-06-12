"use client";

import { Loader2, SendHorizonal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { completeOnboardingAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingFormValues } from "@/lib/onboarding/validation";
import { cn } from "@/lib/utils";

/**
 * Scout-led conversational welcome — the OS's first-run. Instead of a dead form, Scout
 * talks the user through setting up their first track, one question at a time.
 * Scripted + Scout-voiced (reliable, no AI dependency on the very first impression);
 * it collects exactly the fields onboarding needs, then hands off to the dashboard
 * where the guidance layer takes over.
 */

type Values = Partial<OnboardingFormValues>;
type Chip = { value: string; label: string };

type Step = {
  key: keyof OnboardingFormValues;
  scout: string | ((v: Values) => string);
  type: "text" | "textarea" | "chips";
  placeholder?: string;
  chips?: Chip[];
  min?: number;
  error?: string;
};

const STEPS: Step[] = [
  {
    key: "fullName",
    scout: "Hey — I'm Scout, your career operating system. I'll get you set up in about two minutes, then I'll guide you from there. First: what should I call you?",
    type: "text",
    placeholder: "Your name",
    min: 2,
    error: "Tell me your name (2+ characters).",
  },
  {
    key: "targetRole",
    scout: (v) =>
      `Good to meet you, ${(v.fullName ?? "").trim().split(/\s+/)[0] || "there"}. What role or field are you aiming for? This becomes your first track — you can add more directions later.`,
    type: "text",
    placeholder: "e.g. Financial Analyst, UX Designer, SOC Analyst, Registered Nurse",
    min: 2,
    error: "What role or field are you targeting?",
  },
  {
    key: "locationPreference",
    scout: "Where do you want to work? A city, a country, or just “remote” all work.",
    type: "text",
    placeholder: "Dublin, Ireland · Remote",
    min: 2,
    error: "Add a location or “remote”.",
  },
  {
    key: "experienceLevel",
    scout: "How far along are you?",
    type: "chips",
    chips: [
      { value: "entry", label: "Entry / Graduate" },
      { value: "mid", label: "Mid" },
      { value: "senior", label: "Senior" },
      { value: "lead", label: "Lead" },
      { value: "executive", label: "Executive" },
      { value: "career_switcher", label: "Switching careers" },
    ],
  },
  {
    key: "careerGoals",
    scout: "What do you actually want from this move? Be honest — money, stability, a fresh start, growth. This shapes how I guide you, so it's worth a real answer.",
    type: "textarea",
    placeholder: "e.g. Land a stable mid-level role within 6 months and stop feeling stuck where I am.",
    min: 20,
    error: "A sentence or two (20+ characters) helps me guide you well.",
  },
  {
    key: "resumeText",
    scout: "Paste your CV — or just the gist of your experience, skills, and education. I use this to match real roles and write your documents from evidence, not guesses.",
    type: "textarea",
    placeholder: "Paste your CV text, or a summary of your experience…",
    min: 50,
    error: "Give me at least 50 characters so I have something real to work with.",
  },
  {
    key: "linkedInProfile",
    scout: "Last thing — your LinkedIn URL, or a few lines about your background. Then I'll set everything up.",
    type: "text",
    placeholder: "linkedin.com/in/you — or a short bio",
    min: 2,
    error: "A URL or a couple of lines, please.",
  },
];

type Bubble = { from: "scout" | "user"; text: string };

function scoutText(step: Step, values: Values): string {
  return typeof step.scout === "function" ? step.scout(values) : step.scout;
}

export function ScoutOnboarding({ onUseForm }: { onUseForm?: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: "scout", text: scoutText(STEPS[0], {}) }]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const done = stepIndex >= STEPS.length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, submitting]);

  function submitValue(rawValue: string, label?: string) {
    const value = rawValue.trim();
    if (step.min && value.length < step.min) {
      setError(step.error ?? `Please enter at least ${step.min} characters.`);
      return;
    }
    setError(null);

    const nextValues = { ...values, [step.key]: value };
    const transcript: Bubble[] = [...bubbles, { from: "user", text: label ?? value }];
    const nextIndex = stepIndex + 1;

    setValues(nextValues);
    setDraft("");

    if (nextIndex < STEPS.length) {
      transcript.push({ from: "scout", text: scoutText(STEPS[nextIndex], nextValues) });
      setBubbles(transcript);
      setStepIndex(nextIndex);
      return;
    }

    // All collected — confirm and create.
    transcript.push({
      from: "scout",
      text: `Perfect. Setting up your Career OS around “${nextValues.targetRole}”…`,
    });
    setBubbles(transcript);
    setStepIndex(nextIndex);

    startTransition(async () => {
      const res = await completeOnboardingAction(nextValues as OnboardingFormValues);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong saving your setup.");
        setBubbles((b) => [
          ...b,
          { from: "scout", text: "Hm — I couldn't save that. Mind trying the last answer again?" },
        ]);
        setStepIndex(STEPS.length - 1);
        return;
      }
      router.push(res.redirectTo ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex h-[min(80vh,640px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
        <ScoutOrb />
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight">Scout</p>
          <p className="text-xs text-muted-foreground">Setting up your Career OS</p>
        </div>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i < stepIndex ? "w-4 bg-primary" : i === stepIndex ? "w-4 bg-primary/60" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={cn(
              "flex items-end gap-2 duration-300 animate-in fade-in slide-in-from-bottom-1",
              b.from === "user" ? "flex-row-reverse" : "",
            )}
          >
            {b.from === "scout" ? <ScoutOrb size="sm" /> : null}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                b.from === "scout"
                  ? "rounded-bl-sm bg-muted/70"
                  : "rounded-br-sm bg-primary text-primary-foreground",
              )}
            >
              {b.text}
            </div>
          </div>
        ))}
        {submitting ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Building your dashboard…
          </div>
        ) : null}
      </div>

      {/* Input */}
      {!done ? (
        <div className="border-t border-border/50 px-4 py-3">
          {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

          {step.type === "chips" && step.chips ? (
            <div className="flex flex-wrap gap-2">
              {step.chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => submitValue(c.value, c.label)}
                  className="rounded-full border border-border/70 bg-muted/40 px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : step.type === "textarea" ? (
            <div className="flex items-end gap-2">
              <Textarea
                autoFocus
                rows={3}
                value={draft}
                placeholder={step.placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitValue(draft);
                }}
                className="resize-none"
              />
              <Button size="icon" onClick={() => submitValue(draft)} aria-label="Send">
                <SendHorizonal className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                placeholder={step.placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitValue(draft);
                }}
              />
              <Button size="icon" onClick={() => submitValue(draft)} aria-label="Send">
                <SendHorizonal className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>
              {step.type === "textarea" ? "⌘/Ctrl + Enter to send" : step.type === "chips" ? "Pick one" : "Enter to send"}
            </span>
            {onUseForm ? (
              <button type="button" onClick={onUseForm} className="hover:text-foreground hover:underline">
                Prefer a form?
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoutOrb({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "size-6" : "size-9";
  const inner = size === "sm" ? "size-2" : "size-3.5";
  return (
    <span className={cn("relative grid shrink-0 place-items-center", dim)}>
      <span className="absolute inset-0 rounded-full bg-primary/20 blur-md" />
      <span className="relative grid size-full place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] ring-2 ring-primary/20">
        <span className={cn("animate-pulse rounded-full bg-primary-foreground/90 [animation-duration:2.5s]", inner)} />
      </span>
    </span>
  );
}
