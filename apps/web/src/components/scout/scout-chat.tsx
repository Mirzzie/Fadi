"use client";

import {
  AudioLines,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScoutBadge } from "@/components/ui/scout-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGroqVoice } from "@/lib/voice/use-groq-voice";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import { cn } from "@/lib/utils";

export type ScoutToolResultView = { name: string; view: string; data: unknown };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolResults?: ScoutToolResultView[];
};

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "Hello. I'm Scout, your career agent.\n\nI have your profile and career analysis loaded. Ask me anything — your skill gaps, whether a role is worth pursuing, how to improve your resume for a specific job, what's happening in your target market, or what your next move should be.\n\nI'll be direct. If something doesn't add up, I'll tell you.",
  timestamp: new Date(),
};

/** Speech-friendly form of a chat message: markdown markers read terribly aloud. */
function toSpeakable(markdown: string): string {
  return markdown
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ");
}

const VOICE_PREF_KEY = "scout-voice-enabled";

export function ScoutChat({ autoListenNonce }: { autoListenNonce?: number } = {}) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // Voice preference survives sessions — it's what lets Scout greet you ALOUD
  // with the background digest when you come back.
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  useEffect(() => {
    // Migrate the pre-rename pref key so nobody silently loses their voice setting.
    setVoiceEnabled(
      (localStorage.getItem(VOICE_PREF_KEY) ?? localStorage.getItem("kai-voice-enabled")) === "1",
    );
  }, []);
  useEffect(() => {
    localStorage.setItem(VOICE_PREF_KEY, voiceEnabled ? "1" : "0");
  }, [voiceEnabled]);
  const [conversationMode, setConversationMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Refs so the speech callback (a stable closure) always sees current values.
  const conversationRef = useRef(false);
  conversationRef.current = conversationMode;
  const sendRef = useRef<(t: string) => void>(() => {});

  const { speak, stop: stopSpeaking, state: speechOutputState } = useSpeechOutput({ rate: 1.0 });

  // Voice input via server-side Whisper (Groq) — records the mic, auto-stops on
  // silence, transcribes. Browser-agnostic (no Google Web Speech dependency).
  const {
    state: voiceState,
    start: startListening,
    stop: stopListening,
  } = useGroqVoice({
    onTranscript: (text) => {
      // Hands-free: a finished utterance is sent; otherwise it fills the box.
      if (conversationRef.current) sendRef.current(text);
      else setInput((prev) => (prev ? `${prev} ${text}` : text));
    },
    onError: (err) => setError(err),
  });

  const isListening = voiceState === "recording";
  const isTranscribing = voiceState === "transcribing";
  const isSpeaking = speechOutputState === "speaking";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load persisted conversation on mount → chats survive reloads and Desk/Scout
  // modes stay in sync (both read the same history).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scout/history");
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: Array<{
            id: string;
            role: string;
            content: string;
            isDigest?: boolean;
            createdAt?: string;
          }>;
        };
        if (cancelled || data.messages.length === 0) return;
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
            timestamp: new Date(),
          })),
        );

        // Scout speaks a background digest that just landed — only the newest
        // message, only when fresh, and only if the user keeps voice on.
        const last = data.messages[data.messages.length - 1];
        const isFresh =
          last.createdAt && Date.now() - new Date(last.createdAt).getTime() < 10 * 60 * 1000;
        if (last.isDigest && isFresh && localStorage.getItem(VOICE_PREF_KEY) === "1") {
          speak(toSpeakable(last.content));
        }
      } catch {
        /* keep the default greeting on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: history loads once; `speak` is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Summoned by "Hey Scout": start listening for the user's question immediately.
  useEffect(() => {
    if (autoListenNonce && autoListenNonce > 0) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListenNonce]);

  // Conversation loop: whenever Scout is idle in hands-free mode (not thinking,
  // speaking, or already listening), resume listening for the next turn. Back
  // off when the last attempt errored (e.g. flaky speech network) so we don't
  // spin in a tight retry storm.
  useEffect(() => {
    if (!conversationMode || isStreaming || isSpeaking || isListening || isTranscribing) return;
    const t = setTimeout(
      () => {
        if (conversationRef.current) startListening();
      },
      error ? 4000 : 600,
    );
    return () => clearTimeout(t);
  }, [conversationMode, isStreaming, isSpeaking, isListening, isTranscribing, error, startListening]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      const history = messages
        .filter((m) => m.id !== "init")
        .map((m) => ({ role: m.role, content: m.content }));

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/scout/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Scout returned ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === "object" && "scoutTools" in parsed) {
                // Structured tool results → render as cards/tiles.
                const toolResults = (parsed as { scoutTools: ScoutToolResultView[] }).scoutTools;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, toolResults } : m)),
                );
              } else if (typeof parsed === "string") {
                fullResponse += parsed;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullResponse } : m,
                  ),
                );
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        if (voiceEnabled && fullResponse) {
          speak(fullResponse);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "Something went wrong. Please check your connection and try again.",
                }
              : m,
          ),
        );
        setError("Failed to reach Scout. Try again in a moment.");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, voiceEnabled, speak],
  );

  // Keep the speech callback's reference to sendMessage current.
  useEffect(() => {
    sendRef.current = sendMessage;
  }, [sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function toggleVoiceInput() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function toggleVoiceOutput() {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setVoiceEnabled((v) => !v);
    }
  }

  function toggleConversation() {
    if (conversationMode) {
      setConversationMode(false);
      setVoiceEnabled(false);
      stopListening();
      stopSpeaking();
    } else {
      setConversationMode(true);
      setVoiceEnabled(true); // Scout speaks its replies in conversation mode
      setError(null);
      startListening();
    }
  }

  // Scout's live state — drives the animated persona orb.
  const scoutState: "speaking" | "thinking" | "listening" | "idle" = isSpeaking
    ? "speaking"
    : isStreaming || isTranscribing
      ? "thinking"
      : isListening
        ? "listening"
        : "idle";

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} isStreaming={isStreaming && message.id === messages[messages.length - 1]?.id && message.role === "assistant"} />
        ))}
        {isListening || isTranscribing ? (
          <div className="flex items-center gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Mic className="size-3.5 animate-pulse text-primary" aria-hidden="true" />
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
              {isTranscribing ? "Transcribing…" : "Listening — speak now"}
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error ? (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {/* Live conversation persona */}
      {conversationMode ? (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <ScoutOrb state={scoutState} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {scoutState === "speaking"
                ? "Scout is speaking…"
                : scoutState === "thinking"
                  ? "Scout is thinking…"
                  : scoutState === "listening"
                    ? "Listening — go ahead"
                    : "Say something…"}
            </p>
            <p className="text-xs text-muted-foreground">
              Hands-free — talk naturally, Scout replies out loud.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={toggleConversation}>
            End
          </Button>
        </div>
      ) : null}

      {/* Input */}
      <div className="border-t border-border/60 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Listening... speak now"
                : "Ask Scout anything about your career..."
            }
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none text-sm"
            aria-label="Message to Scout"
          />
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="icon"
              variant={conversationMode ? "default" : "outline"}
              className={cn("size-9 shrink-0", conversationMode && "animate-pulse")}
              onClick={toggleConversation}
              title={conversationMode ? "End live conversation" : "Start live hands-free conversation"}
              aria-label="Toggle live conversation"
            >
              <AudioLines className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={isListening ? "default" : "outline"}
              className={cn("size-9 shrink-0", isListening && "animate-pulse")}
              onClick={toggleVoiceInput}
              disabled={isTranscribing}
              title={isListening ? "Stop & transcribe" : isTranscribing ? "Transcribing…" : "Speak to Scout"}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              {isTranscribing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : isListening ? (
                <MicOff className="size-4" aria-hidden="true" />
              ) : (
                <Mic className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant={voiceEnabled ? "default" : "outline"}
              className="size-9 shrink-0"
              onClick={toggleVoiceOutput}
              title={voiceEnabled ? "Mute Scout voice" : "Enable Scout voice"}
              aria-label={voiceEnabled ? "Disable voice output" : "Enable voice output"}
            >
              {voiceEnabled || isSpeaking ? (
                <Volume2 className="size-4" aria-hidden="true" />
              ) : (
                <VolumeX className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            disabled={!input.trim() || isStreaming}
            onClick={() => sendMessage(input)}
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for a new line. Scout uses your career profile and analysis for context.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming: boolean;
}) {
  const isScout = message.role === "assistant";
  const hasTools = (message.toolResults?.length ?? 0) > 0;

  return (
    <div className={cn("flex items-start gap-3", !isScout && "flex-row-reverse")}>
      {isScout ? (
        <ScoutBadge size="xs" showName={false} className="shrink-0 pt-0.5" />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
          You
        </div>
      )}
      <div className={cn("flex flex-col gap-2", hasTools ? "w-full max-w-[94%]" : "max-w-[80%]")}>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isScout ? "bg-card border border-border/60" : "bg-primary/15 text-foreground",
          )}
        >
          {message.content ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Scout is thinking...
            </span>
          ) : null}
        </div>
        {hasTools ? <ScoutToolResults results={message.toolResults!} /> : null}
      </div>
    </div>
  );
}

/** Visual render of what Scout's tools returned — job cards, performance tiles. */
function ScoutToolResults({ results }: { results: ScoutToolResultView[] }) {
  return (
    <div className="space-y-3">
      {results.map((r, i) => (
        <div key={`${r.name}-${i}`}>{renderToolResult(r)}</div>
      ))}
    </div>
  );
}

type JobCard = {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  salaryText?: string;
  matchScore?: number;
  url?: string;
};

function renderToolResult(r: ScoutToolResultView) {
  const data = r.data as Record<string, unknown> | undefined;

  if ((r.view === "jobs" || r.view === "updates") && data) {
    const jobs = (data.jobs as JobCard[]) ?? [];
    if (jobs.length === 0) {
      return (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          No live roles matched that search.
        </p>
      );
    }
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {jobs.map((j, i) => (
          <a
            key={j.id ?? `${j.title}-${i}`}
            href={j.url ?? "/dashboard/jobs"}
            target={j.url ? "_blank" : undefined}
            rel={j.url ? "noreferrer" : undefined}
            className="group rounded-lg border border-border/60 bg-card/60 p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{j.title}</p>
              {typeof j.matchScore === "number" ? (
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
                  {j.matchScore}%
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{j.company}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[j.location, j.salaryText].filter(Boolean).join(" · ")}
            </p>
          </a>
        ))}
      </div>
    );
  }

  if (r.view === "application" && data) {
    const d = data as { id?: string; company?: string; title?: string };
    return (
      <a
        href="/dashboard/applications"
        className="group flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 transition-colors hover:border-emerald-500/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-400">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{d.title}</span>
          <span className="text-xs text-muted-foreground">
            {d.company} · added to tracker — open Applications →
          </span>
        </span>
      </a>
    );
  }

  if (r.view === "document" && data) {
    const d = data as { id?: string; kind?: string; title?: string };
    return (
      <a
        href={`/dashboard/documents/${d.id ?? ""}`}
        className="group flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-colors hover:border-primary/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{d.title ?? "Document"}</span>
          <span className="text-xs text-primary group-hover:underline">Open in editor →</span>
        </span>
      </a>
    );
  }

  if (r.view === "labor" && data) {
    const d = data as {
      unemploymentRate?: number | null;
      unemploymentTrend?: string | null;
      jobOpeningsMillions?: number | null;
      openingsTrend?: string | null;
      quitsRate?: number | null;
      asOf?: string | null;
    };
    const arrow = (t?: string | null) => (t === "up" ? "▲" : t === "down" ? "▼" : t === "flat" ? "▬" : "");
    const tiles: Array<[string, string, string?]> = [
      ["Unemployment", d.unemploymentRate != null ? `${d.unemploymentRate}%` : "—", arrow(d.unemploymentTrend)],
      ["Job openings", d.jobOpeningsMillions != null ? `${d.jobOpeningsMillions.toFixed(1)}M` : "—", arrow(d.openingsTrend)],
      ["Quits rate", d.quitsRate != null ? `${d.quitsRate}%` : "—"],
    ];
    return (
      <div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map(([label, value, trend]) => (
            <div key={label} className="rounded-lg border border-border/60 bg-card/60 p-2.5 text-center">
              <p className="text-lg font-semibold tabular-nums">
                {value} {trend ? <span className="text-xs text-muted-foreground">{trend}</span> : null}
              </p>
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {d.asOf ? <p className="mt-1.5 text-[0.7rem] text-muted-foreground">US · BLS · {d.asOf}</p> : null}
      </div>
    );
  }

  if (r.view === "performance" && data) {
    const tiles: Array<[string, string]> = [
      ["Momentum", String(data.momentum ?? "—")],
      ["Peak", String(data.peakMomentum ?? "—")],
      ["Band", String(data.band ?? "—")],
      ["Quality apps", String(data.qualityApplicationsThisPeriod ?? "—")],
    ];
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/60 p-2.5 text-center">
            <p className="text-lg font-semibold tabular-nums">{value}</p>
            <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

/** Animated Scout persona — reacts to whether Scout is listening, thinking, or speaking. */
function ScoutOrb({ state }: { state: "speaking" | "thinking" | "listening" | "idle" }) {
  return (
    <div className="relative grid size-10 shrink-0 place-items-center">
      {state === "listening" ? (
        <span className="absolute size-10 animate-ping rounded-full bg-emerald-400/40" />
      ) : null}
      {state === "speaking" ? (
        <>
          <span className="absolute size-10 animate-ping rounded-full bg-primary/40 [animation-duration:1s]" />
          <span className="absolute size-9 animate-ping rounded-full bg-primary/30 [animation-duration:1.5s]" />
        </>
      ) : null}
      <span
        className={cn(
          "relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] shadow",
          state === "idle" && "animate-pulse",
          state === "listening" && "ring-2 ring-emerald-400/50",
        )}
      >
        {state === "thinking" ? (
          <Loader2 className="size-3.5 animate-spin text-primary-foreground" aria-hidden="true" />
        ) : (
          <span className="size-2.5 rounded-full bg-primary-foreground/90" />
        )}
      </span>
    </div>
  );
}
