"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Compass, Layers } from "lucide-react";
import { FadiPresenceProvider, useFadi } from "@/components/os/fadi-presence";
import { FadiOrb } from "@/components/os/fadi-orb";
import { useGuideTarget } from "@/components/os/use-guide-target";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { FadiLogo } from "@/components/brand/fadi-logo";
import { Button } from "@/components/ui/button";

export function GuideDemo() {
  return (
    <FadiPresenceProvider>
      <DemoContent />
      <FadiOrb previewOnly />
    </FadiPresenceProvider>
  );
}

function DemoContent() {
  const [direction, setDirection] = useState(false);
  const [practice, setPractice] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { startGuide, guideTargetCount } = useFadi();
  const directionRef = useGuideTarget<HTMLButtonElement>(
    "demo.direction",
    "Start with a direction",
    "This is the direction control. Try it yourself; guidance never clicks or saves for you. This preview only changes local sample state."
  );
  const practiceRef = useGuideTarget<HTMLButtonElement>(
    "demo.practice",
    "Make room for the work",
    "This is where you would continue practice. Clicking here changes only this demo—no activity, account record or AI request is created."
  );
  return (
    <>
      <header className="fadi-glass sticky top-0 z-20 flex min-h-14 items-center justify-between border-b px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FadiLogo className="size-6" />
          Fadi
        </Link>
        <span className="text-xs text-muted-foreground">Design preview · no account data</span>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 pb-48 pt-10 sm:px-8 sm:pt-16">
        <p className="text-xs uppercase tracking-widest text-primary">
          A little guidance. Still your move.
        </p>
        <h1 className="mt-4 max-w-2xl font-heading text-4xl leading-tight tracking-tight sm:text-6xl">
          Fadi, right where
          <br />
          you{" "}
          <em className="font-normal" style={{ fontFamily: "var(--font-editorial),serif" }}>
            need it.
          </em>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
          Choose Show me and watch the existing orb move beside a control. It points; you decide.
          Escape or Stop guidance brings it back. Nothing here calls an AI provider or saves to your
          career record.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Compass className="size-6 text-primary" aria-hidden="true" />
            <p className="mt-6 text-xs text-muted-foreground">01 / YOUR DIRECTION</p>
            <h2 className="mt-2 text-xl font-semibold">Choose what comes next.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A direction is your choice—not something an animation decides for you.
            </p>
            <Button
              ref={directionRef}
              disabled={disabled}
              onClick={() => setDirection(true)}
              className="mt-6"
            >
              Choose a direction <ArrowUpRight aria-hidden="true" />
            </Button>
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              {direction
                ? "Demo direction selected. Nothing was saved."
                : "Not selected. Guidance will not change this."}
            </p>
            <button
              type="button"
              disabled={guideTargetCount < 2}
              onClick={() => startGuide("demo.direction")}
              className="mt-5 min-h-10 text-xs font-medium text-primary underline underline-offset-4 disabled:opacity-50"
            >
              Show me this control
            </button>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Layers className="size-6 text-primary" aria-hidden="true" />
            <p className="mt-6 text-xs text-muted-foreground">02 / YOUR PRACTICE</p>
            <h2 className="mt-2 text-xl font-semibold">Get into the real work.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Fadi can point to your next step without doing the learner’s work.
            </p>
            <Button
              ref={practiceRef}
              hidden={hidden}
              onClick={() => setPractice(true)}
              variant="outline"
              className="mt-6"
            >
              Continue practice <ArrowUpRight aria-hidden="true" />
            </Button>
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              {practice
                ? "Demo control pressed. No real activity was started."
                : "No activity started."}
            </p>
            <button
              type="button"
              disabled={guideTargetCount < 2}
              onClick={() => startGuide("demo.practice")}
              className="mt-5 min-h-10 text-xs font-medium text-primary underline underline-offset-4 disabled:opacity-50"
            >
              Show me practice
            </button>
          </section>
        </div>
        <details className="mt-8 border-y border-border py-4">
          <summary className="cursor-pointer text-sm">Try the safety cases</summary>
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <label className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(e) => setDisabled(e.target.checked)}
              />
              Disable direction control
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
              />
              Hide practice control
            </label>
            <Link href="/" className="self-center underline underline-offset-4">
              Leave preview
            </Link>
          </div>
        </details>
        <div className="mt-8">
          <AppearanceSettings />
        </div>
      </main>
    </>
  );
}
