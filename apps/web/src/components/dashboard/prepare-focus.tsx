import Link from "next/link";

type GapItem = { title: string; detail: string };

/**
 * Prepare mode's primary content: turn the distance between you and your target role into a
 * concrete build list. Each gap becomes "prove this" — a real project, certification, case study,
 * portfolio piece or shadowing stint — NOT an invented line on a résumé. This is the honest
 * antidote to fabrication: build real signal instead of faking it. Deliberately career-agnostic
 * ("evidence" is whatever proves capability in the user's own field) and works with no AI key —
 * it reads the gaps the career report already computed.
 */
export function PrepareFocus({
  targetRole,
  missingSkills,
  learningPath,
  hasReport,
}: {
  targetRole: string | null;
  missingSkills: GapItem[];
  learningPath: GapItem[];
  hasReport: boolean;
}) {
  const role = targetRole?.trim() || "your target role";

  if (!hasReport) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-base font-semibold">Build up for {role}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate your career report first — it maps exactly where you stand against {role}, so you
          know the real gaps to close instead of guessing.
        </p>
        <Link
          href="/dashboard"
          className="mt-3 inline-block rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Generate my career report →
        </Link>
      </div>
    );
  }

  const gaps = missingSkills.slice(0, 4);
  const steps = learningPath.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Close the gap to {role}</h2>
        <span className="text-xs text-muted-foreground">
          Build real, provable evidence — never an invented claim.
        </span>
      </div>

      {gaps.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {gaps.map((g, i) => (
            <li
              key={`${g.title}-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{g.title}</div>
                <p className="text-xs text-muted-foreground">{g.detail}</p>
              </div>
              <Link
                href="/dashboard/evidence"
                className="shrink-0 self-start rounded-md border border-primary/40 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 sm:self-auto"
                title="Add a real project, certification, case study or portfolio piece that proves this"
              >
                Build proof →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No obvious gaps flagged for {role} — keep your evidence current, and switch to{" "}
          <span className="font-medium">Apply</span> when you&apos;re ready to send applications.
        </p>
      )}

      {steps.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="text-xs font-medium text-muted-foreground">How to close them</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {steps.map((s, i) => (
              <Link
                key={`${s.title}-${i}`}
                href="/dashboard/learning"
                className="rounded-md bg-background/60 px-2.5 py-1.5 text-xs hover:bg-background"
                title={s.detail}
              >
                {s.title} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
