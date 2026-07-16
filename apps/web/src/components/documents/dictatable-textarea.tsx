"use client";

import { useRef } from "react";

import { DictateButton } from "@/components/documents/dictate-button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Joins appended dictation to existing content — "\n" for one-per-line fields. */
  separator?: string;
  /** Names the field for screen readers ("an achievement", "your summary"). */
  label?: string;
};

/**
 * A textarea you can type in or speak into.
 *
 * Exists so each field owns its own ref: the mic needs the caret of THIS textarea, and
 * the résumé editor renders these inside `.map()`s (a bullet block per role), where
 * hand-managed ref arrays would be both noisy and easy to get subtly wrong.
 *
 * Typing and dictation stay interchangeable on purpose — voice is a shortcut for the
 * keyboard, never a mode you have to commit to.
 */
export function DictatableTextarea({
  value,
  onChange,
  placeholder,
  className,
  separator = " ",
  label,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <DictateButton
        fieldRef={ref}
        value={value}
        onValue={onChange}
        separator={separator}
        label={label}
      />
    </div>
  );
}
