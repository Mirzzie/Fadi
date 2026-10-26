"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreDocumentRevisionAction } from "@/app/dashboard/documents/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function RestoreRevisionButton({
  documentId,
  revisionVersion,
  expectedVersion,
}: {
  documentId: string;
  revisionVersion: number;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Restore version ${revisionVersion}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Restore
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        disablePointerDismissal={pending}
      >
        <DialogContent showCloseButton={!pending} data-effects="quiet">
          <DialogTitle>Restore version {revisionVersion}?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            This creates a new saved version from version {revisionVersion}. Your current version{" "}
            {expectedVersion} and the rest of the history stay available.
          </DialogDescription>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Keep current version
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    const result = await restoreDocumentRevisionAction({
                      id: documentId,
                      revisionVersion,
                      expectedVersion,
                    });
                    if (!result.ok) {
                      setError(result.message);
                      if (result.conflict) router.refresh();
                      return;
                    }
                    setOpen(false);
                    router.push(`/dashboard/documents/${documentId}`);
                  } catch {
                    setError(
                      "The restore could not be confirmed. Check the latest saved version before trying again."
                    );
                  }
                });
              }}
            >
              {pending ? "Restoring…" : "Restore as new version"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
