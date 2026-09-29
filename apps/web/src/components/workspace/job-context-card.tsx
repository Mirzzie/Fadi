"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveWorkspaceJobDescriptionAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function JobContextCard({
  jobId,
  initialDescription,
}: {
  jobId: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveWorkspaceJobDescriptionAction(jobId, description);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-primary/30 bg-card p-5">
      <h2 className="font-semibold">Add the job description</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fadi needs the posting before it can judge fit, tailor documents, or run an interview for
        this role. Paste it once; every tool in this workspace will use the same saved copy.
      </p>
      <Textarea
        className="mt-4 min-h-52"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Paste the complete job description here…"
        aria-label="Job description"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={pending || description.trim().length < 50}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
    </section>
  );
}
