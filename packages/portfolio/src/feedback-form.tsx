"use client";

import { useState } from "react";

/**
 * AN OPEN CHANNEL BACK TO THE OWNER.
 *
 * A portfolio normally offers one action — "hire me" — which almost nobody who reads
 * it is in a position to take. A note costs a reader nothing and gives everyone else
 * a reason to make contact: a question, a pointer, a shared interest.
 *
 * The copy here is deliberately NEUTRAL. An earlier version asked people to say what
 * was "weak" or "missing"; inviting strangers to critique you on your own site reads
 * as a lack of confidence however it is meant, and it filters for exactly the readers
 * who wanted to be harsh. Invite the note — never script its contents.
 *
 * WHERE IT GOES. The owner's Fadi runs locally, so a visitor's browser cannot deliver
 * anything to it. Feedback posts to the same public collector as the visitor events,
 * where it waits until Fadi is next opened and pulls it in. Unreachable collector, or
 * none configured, and the form quietly gives way to a plain mailto: link — a broken
 * form is worse than no form.
 */

const KINDS = [
  { value: "work", label: "About the work" },
  { value: "site", label: "About this site" },
  { value: "advice", label: "Career advice" },
  { value: "other", label: "Something else" },
];

export function FeedbackForm({
  handle,
  base,
  email,
}: {
  handle: string;
  /** The public collector. Without one there is nowhere to deliver, so we fall back. */
  base?: string | null;
  /** Fallback so the section is never a dead end. */
  email?: string | null;
}) {
  const [kind, setKind] = useState("work");
  const [message, setMessage] = useState("");
  const [from, setFrom] = useState("");
  const [contact, setContact] = useState("");
  const [trap, setTrap] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // "" means same-origin, which is a perfectly good place to post — only an absent
  // base means there is nowhere to deliver. Treating "" as falsy silently downgraded
  // the Fadi-served page to the mailto fallback.
  const canPost = base !== undefined && base !== null && Boolean(handle);

  if (!canPost) {
    if (!email) return null;
    return (
      <p className="text-[15px] text-[var(--pf-ink-2)]">
        Got something to share about the work?{" "}
        <a
          href={`mailto:${email}?subject=${encodeURIComponent("Feedback on your portfolio")}`}
          className="font-medium text-[var(--pf-accent)] underline underline-offset-4"
        >
          Tell me by email
        </a>
        .
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (trap || message.trim().length < 4) return; // silent on bots and empty sends
    setState("sending");
    try {
      const res = await fetch(`${base}/api/portfolio/${encodeURIComponent(handle)}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ kind, message, from, contact }),
      });
      setState(res.ok ? "sent" : "error");
      if (res.ok) setMessage("");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="rounded-lg border border-[var(--pf-accent)]/35 bg-[var(--pf-accent-soft)] p-4 text-[15px] text-[var(--pf-ink)]">
        Thanks — that&apos;s reached me.
        {email ? (
          <>
            {" "}
            If you&apos;d like a reply sooner,{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-4">
              email me
            </a>
            .
          </>
        ) : null}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-[62ch]">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
              kind === k.value
                ? "border-[var(--pf-ink)] bg-[var(--pf-ink)] text-[var(--pf-invert)]"
                : "border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-ink-2)] hover:border-[var(--pf-accent)]"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Your feedback</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          required
          placeholder="Your feedback…"
          className="w-full rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3 text-[15px] text-[var(--pf-ink)] placeholder:text-[var(--pf-ink-3)] focus:border-[var(--pf-accent)] focus:outline-none"
        />
      </label>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          maxLength={120}
          placeholder="Your name (optional)"
          className="rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] px-3 py-2 text-[14px] placeholder:text-[var(--pf-ink-3)] focus:border-[var(--pf-accent)] focus:outline-none"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={160}
          placeholder="Email, if you want a reply (optional)"
          className="rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] px-3 py-2 text-[14px] placeholder:text-[var(--pf-ink-3)] focus:border-[var(--pf-accent)] focus:outline-none"
        />
      </div>

      {/* Honeypot: real people never see this, bots fill everything. */}
      <input
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state === "sending" || message.trim().length < 4}
          className="rounded-lg bg-[var(--pf-ink)] px-4 py-2 text-[14px] font-medium text-[var(--pf-invert)] disabled:opacity-40"
        >
          {state === "sending" ? "Sending…" : "Send feedback"}
        </button>
        <span className="text-[13px] text-[var(--pf-ink-3)]">
          No account needed, and nothing appears on this page.
        </span>
      </div>

      {state === "error" ? (
        <p className="mt-2 text-[13.5px] text-[var(--pf-gap)]">
          That didn&apos;t send.{" "}
          {email ? (
            <a href={`mailto:${email}`} className="underline underline-offset-4">
              Email me instead
            </a>
          ) : (
            "Please try again in a moment."
          )}
          .
        </p>
      ) : null}
    </form>
  );
}
