"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

import { tidyDictationAction } from "@/app/dashboard/documents/dictation-actions";
import { placeDictation } from "@/lib/documents/dictation-target";
import { useGroqVoice } from "@/lib/voice/use-groq-voice";
import { cn } from "@/lib/utils";

type Props = {
  /** Receives the field's NEW full value, with the dictation already placed. */
  onValue: (value: string) => void;
  /** Current field contents — the text being edited. */
  value: string;
  /**
   * The field being dictated into. The caret inside it is the target: a selection is
   * replaced, a caret inserts in place, an unfocused field appends.
   */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** Joins appended dictation to existing content ("\n" for bullet lists). */
  separator?: string;
  /** Names the field for screen readers. */
  label?: string;
  className?: string;
};

/**
 * Speak instead of type.
 *
 * The division of labour is the point (PLATFORM_IDEOLOGY Principle 3): the user
 * supplies the claims, the AI supplies only the grammar. Nothing here writes content —
 * it transcribes what was said and tidies the wording, and if the tidy is caught
 * inventing a number or awarding praise, the user's raw words are used instead and we
 * say so. Speaking is the fastest honest input there is: no verification burden,
 * because the substance never came from a model.
 */
export function DictateButton({
  onValue,
  value,
  fieldRef,
  separator = " ",
  label = "this field",
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /**
   * The caret at the moment recording STARTED.
   *
   * Clicking the mic blurs the textarea, which on some browsers collapses the
   * selection — so by the time the transcript arrives, "where the user was aiming" is
   * already gone. Capture it on mousedown, before focus moves.
   */
  const caretRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  /** Mirrored into state purely so the hint can render — refs are not render inputs. */
  const [replacing, setReplacing] = useState(false);

  const captureCaret = useCallback(() => {
    const el = fieldRef.current;
    const focused = el && document.activeElement === el;
    caretRef.current = focused
      ? { start: el.selectionStart, end: el.selectionEnd }
      : { start: null, end: null };
    setReplacing(
      Boolean(focused && el && el.selectionStart !== el.selectionEnd),
    );
  }, [fieldRef]);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const raw = transcript.trim();
      if (!raw) return;
      setBusy(true);
      setNote(null);

      const apply = (text: string) => {
        if (!text) return; // silence never edits the document
        const { start, end } = caretRef.current;
        const placed = placeDictation(text, {
          value,
          selectionStart: start,
          selectionEnd: end,
          separator,
        });
        onValue(placed.value);
        // Put the caret after what was just inserted so speech can chain naturally.
        requestAnimationFrame(() => {
          const el = fieldRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(placed.caret, placed.caret);
        });
      };

      try {
        const result = await tidyDictationAction({ transcript: raw });
        apply(result.text);
        if (result.note) setNote(result.note);
      } catch {
        // Never lose what they said just because cleanup failed.
        apply(raw);
      } finally {
        setBusy(false);
      }
    },
    [onValue, value, separator, fieldRef],
  );

  const { state, isSupported, start, stop } = useGroqVoice({
    onTranscript: handleTranscript,
    onError: () => setNote("Couldn't hear that — try again."),
  });

  if (!isSupported) return null;

  const listening = state === "recording";
  const working = busy || state === "transcribing";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        // Before focus leaves the textarea — this is what makes the caret the target.
        onMouseDown={captureCaret}
        onClick={listening ? stop : start}
        disabled={working}
        aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
        aria-pressed={listening}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
          listening
            ? "border-red-500/40 bg-red-500/10 text-red-500 animate-pulse"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
          working && "opacity-60",
        )}
      >
        {working ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : listening ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {listening ? (
        <span className="text-xs text-muted-foreground">
          {replacing
            ? "Listening — this will replace what you selected."
            : "Listening — just say it plainly."}
        </span>
      ) : note ? (
        <span className="text-xs text-amber-600 dark:text-amber-500">{note}</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Speak to add — or select a line first to rewrite it.
        </span>
      )}
    </div>
  );
}
