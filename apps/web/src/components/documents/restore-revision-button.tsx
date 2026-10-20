"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { restoreDocumentRevisionAction } from "@/app/dashboard/documents/actions";
import { Button } from "@/components/ui/button";

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

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Restore version ${revisionVersion} as a new version?`)) return;
        startTransition(async () => {
          const result = await restoreDocumentRevisionAction({
            id: documentId,
            revisionVersion,
            expectedVersion,
          });
          if (!result.ok) {
            toast.error(result.message);
            if (result.conflict) router.refresh();
            return;
          }
          toast.success(result.message);
          router.push(`/dashboard/documents/${documentId}`);
        });
      }}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
