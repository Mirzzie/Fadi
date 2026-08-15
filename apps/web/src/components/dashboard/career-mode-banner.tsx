"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setCareerModeAction, type CareerMode } from "@/app/dashboard/mode-actions";

/**
 * The two-mode frame: one Fadi, two phases of the same journey — Apply (actively hunting) and
 * Prepare (building up first). Switching reframes the primary focus; both share the same record,
 * and outcomes in one feed the other. Deliberately career-agnostic: "evidence" is a project, a
 * portfolio piece, a certification, a case study, a shadowing/volunteer stint — whatever proves
 * capability in YOUR field, not just code.
 */
export function CareerModeBanner({ mode }: { mode: CareerMode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const apply = mode === "apply";

  const set = (m: CareerMode) => {
    if (m === mode || pending) return;
    start(async () => {
      await setCareerModeAction(m);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          role="tablist"
          aria-label="Career mode"
          className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm"
        >
          <ModeTab label="Apply" active={apply} disabled={pending} onClick={() => set("apply")} />
          <ModeTab
            label="Prepare"
            active={!apply}
            disabled={pending}
            onClick={() => set("prepare")}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {apply
            ? "Actively applying — the focus is sending strong, truthful applications."
            : "Building up first — the focus is real, provable evidence and interview practice."}
        </p>
      </div>

      <Link
        href={apply ? "/dashboard/jobs" : "/dashboard/evidence"}
        className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {apply ? "Go to your pipeline →" : "Build your evidence →"}
      </Link>
    </div>
  );
}

function ModeTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-60 ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
