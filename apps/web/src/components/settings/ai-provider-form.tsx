"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Loader2, Plus, X, XCircle } from "lucide-react";

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

type Slot = { provider: string; model: string; apiKey: string; baseUrl: string };

export function AiProviderForm({ descriptors, initial }: Props) {
  const defaultProvider = descriptors[0]?.id ?? "openai";
  const findDesc = (id: string) => descriptors.find((d) => d.id === id) ?? descriptors[0];

  const [primary, setPrimary] = useState<Slot>({
    provider: initial?.provider ?? defaultProvider,
    model: initial?.model ?? findDesc(initial?.provider ?? defaultProvider)?.defaultModel ?? "",
    apiKey: "",
    baseUrl: initial?.baseUrl ?? "",
  });
  const [fallbackOn, setFallbackOn] = useState(Boolean(initial?.fallbackProvider));
  const [fallback, setFallback] = useState<Slot>({
    provider: initial?.fallbackProvider ?? "ollama",
    model: initial?.fallbackModel ?? findDesc(initial?.fallbackProvider ?? "ollama")?.defaultModel ?? "",
    apiKey: "",
    baseUrl: initial?.fallbackBaseUrl ?? "",
  });

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function payload() {
    return {
      provider: primary.provider,
      model: primary.model,
      baseUrl: primary.baseUrl,
      apiKey: primary.apiKey,
      ...(fallbackOn
        ? {
            fallbackProvider: fallback.provider,
            fallbackModel: fallback.model,
            fallbackBaseUrl: fallback.baseUrl,
            fallbackApiKey: fallback.apiKey,
          }
        : {}),
    };
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setStatus(null);
    startTransition(async () => setStatus(await action()));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <h3 className="text-sm font-semibold">Primary provider</h3>
        <ProviderFields
          descriptors={descriptors}
          slot={primary}
          onChange={setPrimary}
          savedHint={initial?.provider === primary.provider ? initial?.keyHint ?? null : null}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(() => testAiConnectionAction({ ...primary, role: "primary" }))}
          disabled={pending}
        >
          Test primary
        </Button>
      </div>

      {/* Fallback */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Fallback provider</h3>
            <p className="text-xs text-muted-foreground">
              Used automatically when the primary is rate-limited or out of quota — Kai stays up.
              Tip: a free local Ollama makes a great fallback.
            </p>
          </div>
          {fallbackOn ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setFallbackOn(false)} aria-label="Remove fallback">
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setFallbackOn(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add fallback
            </Button>
          )}
        </div>
        {fallbackOn ? (
          <>
            <ProviderFields
              descriptors={descriptors}
              slot={fallback}
              onChange={setFallback}
              savedHint={initial?.fallbackProvider === fallback.provider ? initial?.fallbackKeyHint ?? null : null}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run(() =>
                  testAiConnectionAction({
                    provider: fallback.provider,
                    model: fallback.model,
                    baseUrl: fallback.baseUrl,
                    apiKey: fallback.apiKey,
                    role: "fallback",
                  }),
                )
              }
              disabled={pending}
            >
              Test fallback
            </Button>
          </>
        ) : null}
      </div>

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

      {/* Save / remove */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run(() => saveAiSettingsAction(payload()))} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
        {initial ? (
          <Button variant="ghost" onClick={() => run(() => removeAiSettingsAction())} disabled={pending}>
            Remove all
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProviderFields({
  descriptors,
  slot,
  onChange,
  savedHint,
}: {
  descriptors: ProviderDescriptor[];
  slot: Slot;
  onChange: (s: Slot) => void;
  savedHint: string | null;
}) {
  const descriptor = descriptors.find((d) => d.id === slot.provider) ?? descriptors[0];

  function pickProvider(id: string) {
    const d = descriptors.find((x) => x.id === id);
    onChange({ ...slot, provider: id, model: d?.defaultModel ?? "", apiKey: "" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {descriptors.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => pickProvider(d.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              slot.provider === d.id
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Model</label>
          <input
            value={slot.model}
            onChange={(e) => onChange({ ...slot, model: e.target.value })}
            placeholder={descriptor?.defaultModel}
            list={`models-${descriptor?.id}`}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
          <datalist id={`models-${descriptor?.id}`}>
            {descriptor?.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>

        {descriptor?.requiresApiKey ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API key</label>
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
              type="password"
              value={slot.apiKey}
              onChange={(e) => onChange({ ...slot, apiKey: e.target.value })}
              placeholder={savedHint ? `Saved ···· ${savedHint} — blank keeps it` : "sk-…"}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
        ) : null}
      </div>

      {slot.provider === "ollama" ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Base URL</label>
          <input
            value={slot.baseUrl}
            onChange={(e) => onChange({ ...slot, baseUrl: e.target.value })}
            placeholder="http://localhost:11434/v1"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      ) : null}

      {slot.provider === "openrouter" ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          To use the <span className="text-foreground">:free</span> models, enable them once at{" "}
          <a
            href="https://openrouter.ai/settings/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            openrouter.ai/settings/privacy
          </a>{" "}
          (allow free / prompt-training models) — otherwise free models return a &ldquo;no
          endpoints&rdquo; error.
        </p>
      ) : null}
    </div>
  );
}
