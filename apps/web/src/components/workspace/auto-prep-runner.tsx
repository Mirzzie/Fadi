"use client";

import { CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { autoPrepJobAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";

type RunState = "idle" | "running" | "done" | "error";

/**
 * Fires Kai auto-prep when the user opens a role they've engaged — but only if
 * they've opted in (`enabled`) and the packet isn't already started
 * (`hasDocs`). Fire-once, non-blocking: the workspace is fully usable while Kai
 * drafts in the background; when it finishes we refresh to reveal the docs.
 */
export function AutoPrepRunner({
  jobId,
  enabled,
  hasDocs,
}: {
  jobId: string;
  enabled: boolean;
  hasDocs: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState<string>();
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled || hasDocs || fired.current) return;
    fired.current = true;
    setState("running");
    autoPrepJobAction(jobId)
      .then((res) => {
        setMessage(res.message);
        setState(res.ok ? "done" : "error");
        if (res.ok && res.created > 0) router.refresh();
      })
      .catch(() => {
        setState("error");
        setMessage("Auto-prep failed. Draft manually or try again.");
      });
  }, [enabled, hasDocs, jobId, router]);

  if (state === "idle") return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-foreground"
    >
      {state === "running" ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <span>Kai is preparing your application packet — CV, cover letter, cold email, and value proposition…</span>
        </>
      ) : state === "done" ? (
        <>
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{message ?? "Your packet is ready below."}</span>
        </>
      ) : (
        <>
          <Wand2 className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span>{message ?? "Auto-prep didn't finish — you can draft each document manually below."}</span>
        </>
      )}
    </div>
  );
}
