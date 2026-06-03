"use client";

import {
  FileText,
  Loader2,
  Mail,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { KaiBadge } from "@/components/ui/kai-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSpeechInput } from "@/lib/voice/use-speech-input";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import { cn } from "@/lib/utils";
import type { AgentArtifact, ArtifactType } from "@/lib/agents/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type WorkspaceProps = {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
  matchScore?: number | null;
};

// ─── Artifact icon map ────────────────────────────────────────────────────────

const ARTIFACT_META: Record<ArtifactType, { label: string; icon: typeof FileText }> = {
  cv: { label: "Tailored CV", icon: FileText },
  cover_letter: { label: "Cover Letter", icon: FileText },
  cold_email: { label: "Cold Email", icon: Mail },
  value_proposition: { label: "Value Proposition", icon: Star },
  interview_plan: { label: "Interview Plan", icon: Target },
  company_research: { label: "Company Research", icon: Sparkles },
  market_report: { label: "Market Report", icon: Sparkles },
  learning_plan: { label: "Learning Plan", icon: FileText },
  niche_analysis: { label: "Niche Analysis", icon: Sparkles },
  action_plan: { label: "Action Plan", icon: Target },
};

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "I'm scoped to this application. I can generate a tailored CV, cover letter, cold email templates, value proposition doc, or interview plan — all specific to this role.\n\nPaste the job description if you haven't already, and I'll use it to make every document sharper.\n\nWhat do you want to start with?",
  timestamp: new Date(),
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ApplicationWorkspace({
  jobId,
  jobTitle,
  jobCompany,
  jobDescription,
  matchScore,
}: WorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<AgentArtifact | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { speak, stop: stopSpeaking } = useSpeechOutput({ rate: 1.0 });

  const { state: speechInputState, start: startListening, stop: stopListening, interimTranscript } =
    useSpeechInput({
      onTranscript: (transcript, isFinal) => {
        if (isFinal) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onError: (err) => setError(err),
    });

  const isListening = speechInputState === "listening";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
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

      try {
        const res = await fetch("/api/agents/application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            jobTitle,
            jobCompany,
            jobDescription,
            message: text.trim(),
            history,
          }),
        });

        if (!res.ok || !res.body) throw new Error(`${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data) as string | { artifact: AgentArtifact };

              if (typeof parsed === "string") {
                fullResponse += parsed;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullResponse } : m,
                  ),
                );
              } else if (parsed.artifact) {
                setArtifacts((prev) => {
                  const exists = prev.findIndex((a) => a.type === parsed.artifact.type);
                  if (exists >= 0) {
                    const updated = [...prev];
                    updated[exists] = parsed.artifact;
                    return updated;
                  }
                  return [...prev, parsed.artifact];
                });
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        if (voiceEnabled && fullResponse) speak(fullResponse);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Something went wrong. Please try again." }
              : m,
          ),
        );
        setError("Could not reach Kai. Check your connection.");
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, jobId, jobTitle, jobCompany, jobDescription, voiceEnabled, speak],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickActions = [
    { label: "Generate tailored CV", prompt: "Generate a tailored CV for this role." },
    { label: "Write cover letter", prompt: "Write a cover letter for this position." },
    { label: "Cold email to recruiter", prompt: "Write a cold email template to the recruiter at this company." },
    { label: "Interview prep plan", prompt: "Create an interview preparation plan for this role." },
  ];

  return (
    <div className="flex h-full gap-4">
      {/* Left: Chat */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border/60 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <KaiBadge size="xs" showName={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{jobTitle}</p>
              <p className="text-xs text-muted-foreground">{jobCompany}</p>
            </div>
          </div>
          {matchScore != null ? (
            <Badge variant="secondary" className="shrink-0">
              {matchScore}% match
            </Badge>
          ) : null}
        </div>

        {/* Quick actions */}
        {messages.length <= 1 ? (
          <div className="border-b border-border/60 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.prompt)}
                  className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <WorkspaceMessage
              key={message.id}
              message={message}
              isStreaming={
                isStreaming &&
                message.id === messages[messages.length - 1]?.id &&
                message.role === "assistant"
              }
            />
          ))}
          {isListening && interimTranscript ? (
            <div className="flex items-start gap-2">
              <Mic className="mt-1 size-3.5 shrink-0 animate-pulse text-primary" aria-hidden="true" />
              <p className="text-sm italic text-muted-foreground">{interimTranscript}</p>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {/* Input */}
        <div className="border-t border-border/60 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Kai to generate a document or refine your application..."
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none text-sm"
            />
            <div className="flex flex-col gap-1.5">
              <Button
                size="icon"
                variant={isListening ? "default" : "outline"}
                className={cn("size-8 shrink-0", isListening && "animate-pulse")}
                onClick={() => (isListening ? stopListening() : startListening())}
                aria-label={isListening ? "Stop voice input" : "Voice input"}
              >
                {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </Button>
              <Button
                size="icon"
                className="size-8 shrink-0"
                disabled={!input.trim() || isStreaming}
                onClick={() => sendMessage(input)}
                aria-label="Send"
              >
                {isStreaming ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Documents panel */}
      <div className="hidden w-72 shrink-0 flex-col gap-3 xl:flex">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </p>

          {artifacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Generated documents will appear here. Ask Kai to create a CV, cover letter, or any
              other application asset.
            </p>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => {
                const meta = ARTIFACT_META[artifact.type] ?? { label: artifact.type, icon: FileText };
                return (
                  <button
                    key={artifact.type}
                    onClick={() =>
                      setSelectedArtifact(
                        selectedArtifact?.type === artifact.type ? null : artifact,
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selectedArtifact?.type === artifact.type
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 hover:border-primary/30 hover:bg-muted/40",
                    )}
                  >
                    <meta.icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{artifact.title}</p>
                      <p className="text-xs text-muted-foreground">{meta.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Approval notice */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-primary">Nothing is sent automatically.</span>{" "}
            Review every document before using it. Kai prepares; you decide.
          </p>
        </div>
      </div>

      {/* Document viewer overlay */}
      {selectedArtifact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border/60 bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{selectedArtifact.title}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setSelectedArtifact(null)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {selectedArtifact.content}
              </pre>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedArtifact(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(selectedArtifact.content);
                }}
              >
                Copy to clipboard
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceMessage({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming: boolean;
}) {
  const isKai = message.role === "assistant";

  return (
    <div className={cn("flex items-start gap-2.5", !isKai && "flex-row-reverse")}>
      {isKai ? (
        <KaiBadge size="xs" showName={false} className="shrink-0 pt-0.5" />
      ) : (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
          You
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-xl px-3 py-2 text-sm leading-relaxed",
          isKai ? "bg-muted/40 border border-border/40" : "bg-primary/15",
        )}
      >
        {message.content ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : isStreaming ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Thinking...
          </span>
        ) : null}
      </div>
    </div>
  );
}
