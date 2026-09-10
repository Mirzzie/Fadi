"use client";

import { useEffect, useState, useTransition } from "react";
import { Crosshair, Eye, EyeOff, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  applyPortfolioFocus,
  listFocusDirections,
  planPortfolioFocus,
  type FocusPlan,
  type FocusPlanItem,
} from "@/app/dashboard/portfolio/actions";

import { Modal } from "./modal";

/**
 * FOCUS THE SITE ON ONE DIRECTION.
 *
 * A portfolio that spans four directions asks the reader to work out what you are.
 * This picks one and puts the rest away — reversibly.
 *
 * Every hide is a PROPOSAL with a tick-box, never an automatic action. That isn't
 * politeness, it's necessary: the matcher works on words, and words can't separate
 * "belongs to another direction" from "we have no vocabulary for this yet". On the
 * first real portfolio it wanted to hide `Linux` from a security focus, and
 * `Self-Hosted Nextcloud` because "next-cloud-" contains "cloud". The person
 * looking at the list catches those in a second; the algorithm never will.
 */
export function FocusModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [directions, setDirections] = useState<string[]>([]);
  const [direction, setDirection] = useState<string>("");
  const [plan, setPlan] = useState<FocusPlan | null>(null);
  const [hideIds, setHideIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listFocusDirections().then((res) => {
      if (!res.ok) return setError(res.message);
      setDirections(res.directions);
      setDirection((d) => d || res.directions[0] || "");
    });
  }, []);

  function preview() {
    setError(null);
    setPlan(null);
    startTransition(async () => {
      const res = await planPortfolioFocus({ direction });
      if (!res.ok) return setError(res.message);
      setPlan(res);
      // Pre-tick exactly what was proposed; the user unticks what's wrong.
      setHideIds(new Set(res.plan.filter((p) => p.verdict === "hide").map((p) => p.id)));
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyPortfolioFocus({ hideIds: [...hideIds] });
      if (!res.ok) return setError(res.message);
      onDone();
      onClose();
    });
  }

  function toggle(id: string) {
    setHideIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const proposed = plan?.plan.filter((p) => p.verdict === "hide") ?? [];
  const leading = plan?.plan.filter((p) => p.verdict === "lead") ?? [];
  const keeping = plan?.plan.filter((p) => p.verdict === "keep") ?? [];

  return (
    <Modal
      title="Focus this portfolio"
      onClose={onClose}
      footer={
        plan ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {hideIds.size} hidden · {plan.plan.length - hideIds.size} shown. Nothing is deleted.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={apply} disabled={pending}>
                {pending ? "Applying…" : "Apply focus"}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pick the one direction this site should argue for. Everything that belongs to a different
          direction gets unpublished — you can bring it back any time by focusing differently.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {directions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={preview} disabled={pending || !direction}>
            {pending && !plan ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Working…
              </>
            ) : (
              <>
                <Crosshair className="size-4" aria-hidden="true" /> Preview
              </>
            )}
          </Button>
        </div>

        {error ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">{error}</p>
        ) : null}

        {plan ? (
          <div className="space-y-4">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">{plan.note}</p>

            {leading.length > 0 ? (
              <Section
                icon={<Star className="size-3.5 text-primary" aria-hidden="true" />}
                title={`Leads with (${leading.length})`}
              >
                {leading.map((p) => (
                  <Row key={p.id} item={p} />
                ))}
              </Section>
            ) : null}

            {proposed.length > 0 ? (
              <Section
                icon={<EyeOff className="size-3.5 text-warning" aria-hidden="true" />}
                title={`Suggested to hide (${proposed.length}) — untick anything that belongs`}
              >
                {proposed.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 bg-background/40 p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={hideIds.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="mt-0.5 size-4 shrink-0 accent-current"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">
                        {p.title}{" "}
                        <span className="font-normal text-muted-foreground">· {p.section}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{p.reason}</span>
                    </span>
                  </label>
                ))}
              </Section>
            ) : null}

            {keeping.length > 0 ? (
              <Section
                icon={<Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                title={`Stays visible (${keeping.length})`}
              >
                <p className="text-xs text-muted-foreground">
                  {keeping.map((p) => p.title).join(" · ")}
                </p>
              </Section>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ item }: { item: FocusPlanItem }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
      <p className="text-sm font-medium leading-tight">
        {item.title} <span className="font-normal text-muted-foreground">· {item.section}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
    </div>
  );
}
