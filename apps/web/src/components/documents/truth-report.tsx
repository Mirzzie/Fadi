import type { TruthFinding } from "@/lib/documents/truth-gate";

/**
 * The trust surface. Instead of re-reading a whole draft to check Fadi didn't invent anything,
 * the candidate glances here: green means every claim is backed by their record; red means a
 * figure isn't in their evidence and should be fixed before sending; amber means confirm.
 * This is the piece that turns "defensive re-reading" (the hidden hour) into a 5-second glance.
 */
export function TruthReport({ findings }: { findings: TruthFinding[] }) {
  const blocks = findings.filter((f) => f.severity === "block");
  const warns = findings.filter((f) => f.severity === "warn");

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-100">
        <span aria-hidden className="text-emerald-400">
          ✓
        </span>
        <span className="font-medium">Every claim is grounded in your evidence.</span>
        <span className="text-emerald-200/60">
          Nothing here that a reference check could contradict — send with confidence.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.length > 0 && (
        <Section
          tone="block"
          heading={`${blocks.length} figure${blocks.length === 1 ? "" : "s"} not in your record — fix before you send`}
          findings={blocks}
        />
      )}
      {warns.length > 0 && (
        <Section
          tone="warn"
          heading={`${warns.length} thing${warns.length === 1 ? "" : "s"} to confirm you can back`}
          findings={warns}
        />
      )}
    </div>
  );
}

function Section({
  tone,
  heading,
  findings,
}: {
  tone: "block" | "warn";
  heading: string;
  findings: TruthFinding[];
}) {
  const styles =
    tone === "block"
      ? {
          box: "border-red-500/30 bg-red-500/5",
          head: "text-red-100",
          dot: "bg-red-400",
          chip: "bg-red-500/15 text-red-100",
        }
      : {
          box: "border-amber-500/30 bg-amber-500/5",
          head: "text-amber-100",
          dot: "bg-amber-400",
          chip: "bg-amber-500/15 text-amber-100",
        };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles.box}`}>
      <div className={`flex items-center gap-2 font-medium ${styles.head}`}>
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
        {heading}
      </div>
      <ul className="mt-2 space-y-1.5">
        {findings.map((f, i) => (
          <li key={`${f.offending}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <code className={`rounded px-1.5 py-0.5 font-mono text-xs ${styles.chip}`}>
              {f.offending}
            </code>
            <span className="text-muted-foreground text-xs leading-relaxed">{f.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
