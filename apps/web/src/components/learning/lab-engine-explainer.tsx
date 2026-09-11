import { CheckCircle2, Cpu, Eye, HardDriveDownload, ShieldCheck } from "lucide-react";

const stages = [
  {
    icon: Cpu,
    title: "Match capacity",
    detail: "Check architecture, memory, disk, and virtualisation without changing the host.",
  },
  {
    icon: ShieldCheck,
    title: "Review the effect",
    detail: "Show downloads, ports, replacements, exact commands, and how to stop or remove it.",
  },
  {
    icon: HardDriveDownload,
    title: "Prepare the lab",
    detail: "Persist real pull, create, install, boot, failure, and stop events.",
  },
  {
    icon: Eye,
    title: "Observe readiness",
    detail: "Expose the console when reachable, while named checks decide when the lab is ready.",
  },
  {
    icon: CheckCircle2,
    title: "Keep the result",
    detail: "Attach artifacts and check receipts to the step without claiming who did the work.",
  },
];

/** A compact explanation of the engine's trust boundaries in the language of the learner. */
export function LabEngineExplainer() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border/60 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">How labs run</p>
        <h2 className="mt-1 font-semibold">One operation, five visible stages</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Fadi should never jump from “machine selected” to “ready.” Each stage records a different
          fact and gives you a clear place to intervene.
        </p>
      </header>
      <ol className="grid md:grid-cols-5">
        {stages.map((stage, index) => (
          <li
            key={stage.title}
            className="relative border-b border-border/60 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
          >
            <div className="flex items-center gap-2 md:block">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <stage.icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="md:mt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Stage {index + 1}
                </p>
                <h3 className="text-sm font-semibold">{stage.title}</h3>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
