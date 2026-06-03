"use client";

import {
  Loader2,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { KaiBadge } from "@/components/ui/kai-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechInput } from "@/lib/voice/use-speech-input";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "Hello. I'm Kai, your career agent.\n\nI have your profile and career analysis loaded. Ask me anything — your skill gaps, whether a role is worth pursuing, how to improve your resume for a specific job, what's happening in your target market, or what your next move should be.\n\nI'll be direct. If something doesn't add up, I'll tell you.",
  timestamp: new Date(),
};

export function KaiChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { speak, stop: stopSpeaking, state: speechOutputState } = useSpeechOutput({ rate: 1.0 });

  const { state: speechInputState, start: startListening, stop: stopListening, interimTranscript } =
    useSpeechInput({
      onTranscript: (transcript, isFinal) => {
        if (isFinal) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      },
      onError: (err) => setError(err),
    });

  const isListening = speechInputState === "listening";
  const isSpeaking = speechOutputState === "speaking";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        const res = await fetch("/api/kai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Kai returned ${res.status}`);
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
              const delta = JSON.parse(data) as string;
              fullResponse += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullResponse } : m,
                ),
              );
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
        setError("Failed to reach Kai. Try again in a moment.");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, voiceEnabled, speak],
  );

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

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} isStreaming={isStreaming && message.id === messages[messages.length - 1]?.id && message.role === "assistant"} />
        ))}
        {isListening && interimTranscript ? (
          <div className="flex items-start gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Mic className="size-3.5 text-primary animate-pulse" aria-hidden="true" />
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
              {interimTranscript}
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
                : "Ask Kai anything about your career..."
            }
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none text-sm"
            aria-label="Message to Kai"
          />
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="icon"
              variant={isListening ? "default" : "outline"}
              className={cn("size-9 shrink-0", isListening && "animate-pulse")}
              onClick={toggleVoiceInput}
              title={isListening ? "Stop listening" : "Speak to Kai"}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              {isListening ? (
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
              title={voiceEnabled ? "Mute Kai voice" : "Enable Kai voice"}
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
          Press Enter to send, Shift+Enter for a new line. Kai uses your career profile and analysis for context.
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
  const isKai = message.role === "assistant";

  return (
    <div className={cn("flex items-start gap-3", !isKai && "flex-row-reverse")}>
      {isKai ? (
        <KaiBadge size="xs" showName={false} className="shrink-0 pt-0.5" />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
          You
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isKai
            ? "bg-card border border-border/60"
            : "bg-primary/15 text-foreground",
        )}
      >
        {message.content ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : isStreaming ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Kai is thinking...
          </span>
        ) : null}
      </div>
    </div>
  );
}
