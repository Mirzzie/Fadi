import type { TruthFinding } from "@/lib/documents/truth-gate";

/**
 * The trust surface. Instead of re-reading a whole draft to check Fadi didn't invent anything,
 * the candidate glances here: green means the checks found no known contradiction; red means a
 * figure isn't in their evidence and should be fixed before sending; amber means confirm.
 * This is the piece that turns "defensive re-reading" (the hidden hour) into a 5-second glance.
 */
export function TruthReport({ findings }: { findings: TruthFinding[] }) {
  const blocks = findings.filter((f) => f.severity === "block");
  const warns = findings.filter((f) => f.severity === "warn");

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/5 px-4 py-2.5 text-sm text-success">
        <span aria-hidden className="text-success">
          ✓
        </span>
        <span className="font-medium">No unsupported claim was detected.</span>
        <span className="text-foreground">
          Automated checks cover figures, borrowed job terms and seniority—not every possible claim.
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
          box: "border-destructive/30 bg-destructive/5",
          head: "text-destructive",
          dot: "bg-destructive",
          chip: "bg-card text-destructive",
        }
      : {
          box: "border-warning/30 bg-warning/5",
          head: "text-warning",
          dot: "bg-warning",
          chip: "bg-card text-warning",
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
