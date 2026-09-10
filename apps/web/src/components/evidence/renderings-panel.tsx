"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  labelRendering,
  listFactRenderings,
  promoteRendering,
  type FactRendering,
} from "@/app/dashboard/evidence/actions";

/**
 * THE OTHER WORDINGS OF ONE FACT.
 *
 * This is the point of separating fact from rendering. When you tailor your history
 * for a security role and again for an operations one, you have not gained a second
 * project — you have gained a second way of describing the same one, and the wording
 * is the valuable bit. De-duplication that threw it away would be solving the
 * accounting problem by destroying the useful output.
 *
 * So every phrasing is kept against its fact, labelled with the audience it was
 * written for, and any of them can be promoted to lead. The truth does not change —
 * only which words go first.
 */
export function RenderingsPanel({ itemId }: { itemId: string }) {
  const [renderings, setRenderings] = useState<FactRendering[] | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    void listFactRenderings({ id: itemId }).then((r) => setRenderings(r.ok ? r.renderings : []));
  }
  useEffect(load, [itemId]);

  // One wording is not a set of wordings — nothing to choose between.
  if (!renderings || renderings.length < 2) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Quote className="size-3.5 text-primary" aria-hidden="true" />
        {renderings.length} ways you&apos;ve described this
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        One real thing. Keep the phrasing that suits each audience — and put whichever leads.
      </p>

      <ul className="mt-2.5 space-y-2">
        {renderings.map((r) => (
          <li
            key={r.id}
            className={`rounded-md border p-2.5 ${
              r.isCanonical ? "border-primary/40 bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {r.isCanonical ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                  <Check className="size-3" aria-hidden="true" /> Leads
                </span>
              ) : null}
              <span className="text-sm font-medium">{r.title}</span>
            </div>
            {r.detail ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.detail}</p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                defaultValue={r.renderingFor ?? ""}
                placeholder="Written for… (e.g. SOC analyst roles)"
                className="h-8 max-w-[16rem] text-xs"
                onBlur={(e) => {
                  if ((r.renderingFor ?? "") === e.target.value.trim()) return;
                  startTransition(async () => {
                    await labelRendering({ id: r.id, renderingFor: e.target.value });
                    load();
                  });
                }}
              />
              {!r.isCanonical ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await promoteRendering({ id: r.id });
                      load();
                    })
                  }
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Make this lead
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
