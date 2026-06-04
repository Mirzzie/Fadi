"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProviderDescriptor } from "@/lib/ai/providers/types";
import type { AiSettingsView } from "@/lib/ai/user-settings";
import {
  removeAiSettingsAction,
  saveAiSettingsAction,
  testAiConnectionAction,
} from "@/app/dashboard/settings/actions";

type Props = {
  descriptors: ProviderDescriptor[];
  initial: AiSettingsView | null;
};

export function AiProviderForm({ descriptors, initial }: Props) {
  const [providerId, setProviderId] = useState(initial?.provider ?? descriptors[0]?.id ?? "openai");
  const descriptor = descriptors.find((d) => d.id === providerId) ?? descriptors[0];

  const [model, setModel] = useState(initial?.model ?? descriptor?.defaultModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const savedForThisProvider = initial?.provider === providerId && initial?.hasKey;

  function onProviderChange(id: string) {
    setProviderId(id);
    const d = descriptors.find((x) => x.id === id);
    setModel(initial?.provider === id ? (initial?.model ?? d?.defaultModel ?? "") : d?.defaultModel ?? "");
    setApiKey("");
    setStatus(null);
  }

  function payload() {
    return { provider: providerId, model, apiKey, baseUrl };
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setStatus(null);
    startTransition(async () => setStatus(await action()));
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      {/* Provider picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Provider</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {descriptors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onProviderChange(d.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                providerId === d.id
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <label htmlFor="model" className="text-sm font-medium">Model</label>
        <input
          id="model"
          list="model-options"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={descriptor?.defaultModel}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
        <datalist id="model-options">
          {descriptor?.models.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>

      {/* API key */}
      {descriptor?.requiresApiKey ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="apiKey" className="text-sm font-medium">API key</label>
            {descriptor.docsUrl ? (
              <a
                href={descriptor.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Get a key <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={savedForThisProvider ? `Saved ···· ${initial?.keyHint ?? ""} — leave blank to keep` : "sk-…"}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
          <p className="text-xs text-muted-foreground">Stored encrypted (AES-256-GCM). Never shown again after saving.</p>
        </div>
      ) : null}

      {/* Base URL (Ollama / custom) */}
      {providerId === "ollama" ? (
        <div className="space-y-2">
          <label htmlFor="baseUrl" className="text-sm font-medium">Base URL</label>
          <input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      ) : null}

      {/* Status */}
      {status ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            status.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200",
          )}
        >
          {status.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{status.message}</span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button onClick={() => run(() => saveAiSettingsAction(payload()))} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
        <Button variant="outline" onClick={() => run(() => testAiConnectionAction(payload()))} disabled={pending}>
          Test connection
        </Button>
        {initial ? (
          <Button variant="ghost" onClick={() => run(() => removeAiSettingsAction())} disabled={pending}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
