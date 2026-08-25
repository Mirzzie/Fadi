"use client";

import { useState, useTransition } from "react";
import { Award, Check, Hammer, Map, Plus, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  commitToProjectAction,
  generateBlueprintAction,
} from "@/app/dashboard/learning/actions";
// Type-only — blueprint.ts is server-only; importing its value would pull server code
// into the client bundle. The generate/commit ACTIONS are RPC stubs (safe).
import type { CareerBlueprint } from "@/lib/learning/blueprint";

export function CareerBlueprint({ role }: { role: string | null }) {
  const [blueprint, setBlueprint] = useState<CareerBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateBlueprintAction();
      if (!res.ok) return setError(res.message);
      setBlueprint(res.blueprint);
      setCommitted(new Set());
    });
  }

  function commit(key: string, title: string, detail: string, kind: "project" | "certification") {
    if (committed.has(key)) return;
    setCommitted((prev) => new Set(prev).add(key));
    void commitToProjectAction({ gap: kind === "certification" ? "Certification" : "Portfolio", title, detail, kind });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Map className="size-4 text-primary" aria-hidden="true" />
            Blueprint{role ? ` for ${role}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The certifications, portfolio projects, and in-demand skills to actually get there — mapped to
            your background. Add any to your plan and it flows into your Evidence when you finish it.
          </p>
        </div>
        <Button size="sm" variant={blueprint ? "outline" : "default"} onClick={generate} disabled={pending}>
          <Sparkles className="size-4" aria-hidden="true" />
          {pending ? "Mapping…" : blueprint ? "Re-map" : "Map my path"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {blueprint ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Certifications */}
          {blueprint.certifications.length > 0 ? (
            <Group icon={Award} title="Certification path">
              {blueprint.certifications.map((c, i) => {
                const key = `cert-${i}`;
                return (
                  <Item
                    key={key}
                    title={c.name}
                    badge={c.level}
                    body={c.why}
                    meta={c.effort}
                    committed={committed.has(key)}
                    onCommit={() => commit(key, c.name, `${c.why} (${c.effort})`, "certification")}
                  />
                );
              })}
              <p className="pt-1 text-[0.7rem] text-muted-foreground">
                Verify current requirements, cost, and validity on each certification&apos;s official site.
              </p>
            </Group>
          ) : null}

          {/* Portfolio projects */}
          {blueprint.projects.length > 0 ? (
            <Group icon={Hammer} title="Portfolio proof-projects">
              {blueprint.projects.map((p, i) => {
                const key = `proj-${i}`;
                return (
                  <Item
                    key={key}
                    title={p.title}
                    body={p.proves}
                    meta={`Deliverable: ${p.deliverable}`}
                    committed={committed.has(key)}
                    onCommit={() => commit(key, p.title, `${p.proves} — ${p.deliverable}`, "project")}
                  />
                );
              })}
            </Group>
          ) : null}

          {/* In-demand skills */}
          {blueprint.inDemandSkills.length > 0 ? (
            <Group icon={TrendingUp} title="In demand right now" className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {blueprint.inDemandSkills.map((s, i) => (
                  <span
                    key={i}
                    title={s.why}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                  >
                    {s.skill}
                  </span>
                ))}
              </div>
            </Group>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Group({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: typeof Award;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2 rounded-lg border bg-background/40 p-3", className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden="true" /> {title}
      </p>
      {children}
    </div>
  );
}

function Item({
  title,
  badge,
  body,
  meta,
  committed,
  onCommit,
}: {
  title: string;
  badge?: string;
  body: string;
  meta?: string;
  committed: boolean;
  onCommit: () => void;
}) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {title}
          {badge ? (
            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] uppercase text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </p>
        <Button
          size="sm"
          variant={committed ? "secondary" : "outline"}
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onCommit}
          disabled={committed}
        >
          {committed ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
          {committed ? "Added" : "Add to plan"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-foreground/85">{body}</p>
      {meta ? <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{meta}</p> : null}
    </div>
  );
}
