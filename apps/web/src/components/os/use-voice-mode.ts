"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useGroqVoice } from "@/lib/voice/use-groq-voice";
import { speakFadi, stopFadiSpeech } from "@/lib/voice/fadi-speech";
import { parseVoiceCommand, VOICE_HELP, type VoiceCommand } from "@/lib/voice/commands";
import {
  previewVoiceApplyAction,
  runVoiceWorkAction,
  speakStateAction,
} from "@/app/dashboard/voice-actions";
import { useFadi } from "./fadi-presence";

/**
 * Hands free.
 *
 * Built for the session where the screen is not an option — sore eyes, a commute, a kitchen —
 * and everything has to be reachable by saying it. The loop is: listen, understand, say what
 * will happen, wait for yes, do it, say what happened, listen again.
 *
 * Three rules it does not bend:
 *
 * 1. **Nothing consequential without a spoken yes.** Fadi names what it is about to do, in the
 *    words of the thing it will do it to — "Apply to Deerfoot, Contract IS Technical Support
 *    Analyst" — and waits. A misheard company is caught by the person, out loud, before
 *    anything is written.
 * 2. **It always says something.** Silence and a crash are the same experience with your eyes
 *    shut, so every path speaks, including the ones that failed and the ones it did not follow.
 * 3. **It never guesses an instruction.** Something it does not recognise is repeated back as a
 *    question, not acted on.
 *
 * It does not listen until it is turned on, and it says so when it stops.
 *
 * It is a hook, and the orb renders it. Two floating controls for one assistant is two things
 * to find and one of them redundant — the orb IS Fadi's presence, so it is what you talk to.
 */

type Pending = {
  say: string;
  run: () => Promise<{ say: string; changed?: boolean }>;
};

export function useVoiceMode() {
  const router = useRouter();
  const { setState } = useFadi();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const pending = useRef<Pending | null>(null);
  const lastSaid = useRef("");
  const onRef = useRef(false);
  onRef.current = on;

  const say = useCallback((text: string) => {
    lastSaid.current = text;
    setSaid(text);
    void speakFadi(text);
  }, []);

  const handle = useCallback(
    async (command: VoiceCommand) => {
      // An answer to a question Fadi asked comes first: while something is pending, yes and no
      // mean that thing and nothing else.
      if (pending.current) {
        if (command.kind === "yes") {
          const job = pending.current;
          pending.current = null;
          const result = await job.run();
          say(result.say);
          if (result.changed) router.refresh();
          return;
        }
        if (command.kind === "no") {
          pending.current = null;
          say("Alright, I've left it.");
          return;
        }
        // Anything else drops the offer rather than holding a half-asked question open.
        pending.current = null;
      }

      switch (command.kind) {
        case "read": {
          const reply = await speakStateAction(command.what);
          say(reply.say);
          return;
        }
        case "navigate": {
          say(`Opening ${command.label}.`);
          router.push(command.href);
          return;
        }
        case "advance": {
          const reply = await runVoiceWorkAction({ kind: "advance" });
          say(reply.say);
          if (reply.changed) router.refresh();
          return;
        }
        case "startProposal":
        case "dismissProposal":
        case "stopPlan": {
          const kind = command.kind;
          const asking =
            kind === "startProposal"
              ? "Start the plan I lined up?"
              : kind === "dismissProposal"
                ? "Put that aside?"
                : "Stop the plan? What's already done stays done.";
          pending.current = { say: asking, run: () => runVoiceWorkAction({ kind }) };
          say(asking);
          return;
        }
        case "apply": {
          const preview = await previewVoiceApplyAction(command.target);
          if (preview.template && preview.refs) {
            const { template, refs } = preview;
            pending.current = {
              say: preview.say,
              run: () => runVoiceWorkAction({ kind: "apply", template, refs }),
            };
          }
          say(preview.say);
          return;
        }
        case "yes":
          say("There's nothing waiting on a yes.");
          return;
        case "no":
          say("Nothing to cancel.");
          return;
        case "repeat":
          say(lastSaid.current || "I haven't said anything yet.");
          return;
        case "stopTalking":
          stopFadiSpeech();
          setSaid("");
          return;
        case "help":
          say(VOICE_HELP);
          return;
        case "sleep":
          say("Right you are. Say nothing more.");
          setOn(false);
          return;
        case "ask": {
          // A question is still a question: it goes to Fadi's own answer, spoken back.
          const answer = await askFadi(command.text);
          say(answer);
          return;
        }
        default:
          say("I didn't catch that. Say 'help' for what I can do.");
      }
    },
    [router, say]
  );

  const {
    state: voiceState,
    start,
    stop,
  } = useGroqVoice({
    onTranscript: (text) => {
      setHeard(text);
      setBusy(true);
      void handle(parseVoiceCommand(text)).finally(() => setBusy(false));
    },
    onError: () => say("I didn't hear that. Try again."),
  });

  const listening = voiceState === "recording";

  // The loop: whenever it is on and nothing else is happening, listen again. This is what makes
  // it hands-free — after the first press, the person never has to find a control.
  useEffect(() => {
    if (!on || busy || listening || voiceState === "transcribing") return;
    const timer = setTimeout(() => {
      if (onRef.current) start();
    }, 400);
    return () => clearTimeout(timer);
  }, [on, busy, listening, voiceState, start]);

  useEffect(() => {
    setState(busy ? "thinking" : listening ? "listening" : "idle");
  }, [busy, listening, setState]);

  const toggle = useCallback(() => {
    if (on) {
      setOn(false);
      stop();
      stopFadiSpeech();
      say("Listening off.");
      return;
    }
    setOn(true);
    say("I'm listening. Say 'what's on today', or ask me for help.");
  }, [on, say, stop]);

  return { on, busy, listening, heard, said, toggle };
}

/** Fadi's own answer to a plain question, as text, so the loop can speak it. */
async function askFadi(question: string): Promise<string> {
  try {
    const response = await fetch("/api/fadi/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        history: [],
        pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    });
    if (!response.ok || !response.body) return "I couldn't reach my answer just then.";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          if (typeof parsed === "string") text += parsed;
        } catch {
          /* tool cards and other frames are not speech */
        }
      }
    }
    return text.trim() || "I don't have an answer for that one.";
  } catch {
    return "I couldn't reach my answer just then.";
  }
}
