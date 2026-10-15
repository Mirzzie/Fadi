"use client";

import { ExternalLink, Loader2, Server } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  projectServicesAction,
  proposeServiceAction,
  type ProjectService,
} from "@/app/dashboard/learning/stack-actions";

/**
 * The services a project runs beside its machine (a SIEM, say): whether each is up, one click
 * to start or stop it, and where to open it. Polls with the rest of the lab panel.
 */
export function ProjectServices({
  runId,
  tick,
  onProposed,
}: {
  runId: string;
  /** Changes when the panel refreshes, so services refresh with it. */
  tick: number;
  onProposed: (message: string) => void;
}) {
  const [services, setServices] = useState<ProjectService[]>([]);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    () =>
      projectServicesAction({ runId }).then((result) => {
        if (result.ok) setServices(result.services);
      }),
    [runId]
  );

  useEffect(() => {
    let alive = true;
    void projectServicesAction({ runId }).then((result) => {
      if (alive && result.ok) setServices(result.services);
    });
    return () => {
      alive = false;
    };
  }, [runId, tick]);

  if (services.length === 0) return null;

  const propose = (stack: string, op: "start" | "stop") =>
    startTransition(async () => {
      const result = await proposeServiceAction({ runId, stack, op });
      onProposed(result.message);
      await load();
    });

  return (
    <div className="border-b border-border/70 px-4 py-3">
      <p className="mb-2 text-xs text-muted-foreground">Services beside the machine</p>
      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.key} className="rounded-xl border border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{service.label}</p>
                <p className="text-xs text-muted-foreground">{describe(service)}</p>
              </div>
              {service.state === "running" || service.state === "partial" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => propose(service.key, "stop")}
                >
                  Stop
                </Button>
              ) : ["absent", "stopped", "failed"].includes(service.state) ? (
                <Button size="sm" disabled={pending} onClick={() => propose(service.key, "start")}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Start
                </Button>
              ) : null}
            </div>
            {service.open && service.state === "running" ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <a
                  href={service.open.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open {service.open.label} <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                <span>
                  Sign in{" "}
                  <code className="rounded bg-muted px-1 text-foreground">{service.open.user}</code>{" "}
                  /{" "}
                  <code className="rounded bg-muted px-1 text-foreground">
                    {service.open.password}
                  </code>
                </span>
                <span>
                  Agents connect to{" "}
                  <code className="rounded bg-muted px-1 text-foreground">
                    {service.agentAddress}
                  </code>
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function describe(service: ProjectService): string {
  switch (service.state) {
    case "running":
      return "Running.";
    case "starting":
      return `Starting… ${service.running} of ${service.total} up. The first start downloads the images.`;
    case "partial":
      return `${service.running} of ${service.total} parts running.`;
    case "stopped":
      return "Stopped. Its data is kept.";
    case "waiting":
      return "Waiting for your approval.";
    case "failed":
      return service.detail ?? "It didn't start.";
    case "unknown":
      return service.detail ?? "Fadi can't see it right now.";
    default:
      return service.purpose;
  }
}
