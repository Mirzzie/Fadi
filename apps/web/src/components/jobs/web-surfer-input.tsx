"use client";

import { useState, useTransition } from "react";
import { Compass, Loader2 } from "lucide-react";

import { surfCareerPage } from "@/app/dashboard/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The Fadi Web Surfer: paste a company career page or Greenhouse/Lever board and Fadi reads it
// server-side (the open long tail no API covers). Deliberately a slim disclosure, not a card.
export function WebSurferInput() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  function run() {
    if (!url.trim()) return;
    setMsg(null);
    start(async () => {
      const r = await surfCareerPage(url);
      if (r.ok) {
        setMsg({
          text: `Surfed ${r.found} job${r.found === 1 ? "" : "s"}${r.company ? ` from ${r.company}` : ""} — saved ${r.saved} to your board (via ${r.via}).`,
          kind: "ok",
        });
        setUrl("");
      } else {
        setMsg({ text: r.message, kind: "err" });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Compass className="size-3.5 text-primary" aria-hidden="true" />
        Surf a company career page or Greenhouse / Lever board
      </button>
    );
  }

  return (
    <section className="rounded-xl border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <Compass className="size-3.5 text-primary" aria-hidden="true" />
        Surf the open web
        <span className="font-normal text-muted-foreground">
          — career pages &amp; ATS boards (no API key). Walled sites use the extension.
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="e.g. boards.greenhouse.io/gitlab  ·  jobs.lever.co/netflix  ·  a careers page URL"
          aria-label="Career page or ATS board URL"
        />
        <Button onClick={run} disabled={pending || !url.trim()} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Compass className="size-4" />}
          {pending ? "Surfing…" : "Surf"}
        </Button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-emerald-500" : "text-destructive"}`}>{msg.text}</p>
      )}
    </section>
  );
}
