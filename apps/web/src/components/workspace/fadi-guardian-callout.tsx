import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GuardianVerdict } from "@/lib/guardian/guardian";

/**
 * Fadi speaking up. Renders a guardian verdict as an inline mentor note — honest
 * guidance when an action is off the user's direction (nudge) or irreversible
 * (confirm). Never blocks; it's the "living Fadi watches and tells you the truth".
 */
export function FadiGuardianCallout({ verdict }: { verdict: GuardianVerdict }) {
  if (verdict.level === "ok") return null;
  const confirm = verdict.level === "confirm";

  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3",
        confirm
          ? "border-rose-500/40 bg-rose-500/10"
          : "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
          confirm ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300",
        )}
        aria-hidden="true"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          <span className="text-muted-foreground">Fadi:</span> {verdict.headline}
        </p>
        <p className="mt-0.5 text-sm text-foreground/90">{verdict.detail}</p>
      </div>
    </div>
  );
}
