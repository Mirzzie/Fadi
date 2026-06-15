"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extractCvTextAction } from "@/app/dashboard/profile/actions";
import { cn } from "@/lib/utils";

/**
 * CV file upload → server-side text extraction (PDF/DOCX/DOC/TXT). The parsed
 * text lands in the editable field via `onExtracted` rather than being saved
 * silently — the user always sees and can fix what was read from their file.
 */
export function CvUpload({
  onExtracted,
  className,
  label = "Upload CV (PDF, DOCX, TXT)",
}: {
  onExtracted: (text: string) => void;
  className?: string;
  /** Button label — same parser works for a LinkedIn "Save to PDF" export. */
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      const res = await extractCvTextAction(data);
      setStatus({ ok: res.ok, message: res.message });
      if (res.ok && res.text) onExtracted(res.text);
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="size-4" aria-hidden="true" />
        )}
        {pending ? "Parsing…" : label}
      </Button>
      {status ? (
        <p
          className={cn("text-xs", status.ok ? "text-primary" : "text-destructive")}
          role="status"
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
