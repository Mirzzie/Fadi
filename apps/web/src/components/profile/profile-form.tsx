"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteAccountDataAction,
  updateProfileAction,
  type UpdateProfileInput,
} from "@/app/dashboard/profile/actions";

const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "principal"];

export function ProfileForm({
  email,
  initial,
}: {
  email: string;
  initial: UpdateProfileInput;
}) {
  const [form, setForm] = useState<UpdateProfileInput>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function set<K extends keyof UpdateProfileInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setStatus(null);
    startTransition(async () => setStatus(await updateProfileAction(form)));
  }

  function remove() {
    setStatus(null);
    startTransition(async () => {
      const res = await deleteAccountDataAction();
      // On success the action signs out + redirects; this only shows on failure.
      setStatus(res);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Field label="Full name">
          <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Email">
          <input value={email} disabled className={cn(inputCls, "opacity-60")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target role">
            <input value={form.targetRole} onChange={(e) => set("targetRole", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Location preference">
            <input value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Experience level">
          <select
            value={form.experienceLevel}
            onChange={(e) => set("experienceLevel", e.target.value)}
            className={inputCls}
          >
            <option value="">Not specified</option>
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl} className="capitalize">
                {lvl}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Career goal">
          <textarea
            value={form.careerGoal}
            onChange={(e) => set("careerGoal", e.target.value)}
            rows={3}
            className={cn(inputCls, "h-auto py-2")}
          />
        </Field>

        <Field label="LinkedIn profile URL">
          <input
            value={form.linkedInUrl}
            onChange={(e) => set("linkedInUrl", e.target.value)}
            placeholder="https://www.linkedin.com/in/your-handle/"
            className={inputCls}
          />
        </Field>
        <Field label="LinkedIn context (paste your About / experience)">
          <textarea
            value={form.linkedInText}
            onChange={(e) => set("linkedInText", e.target.value)}
            rows={4}
            placeholder="Paste your LinkedIn summary and experience so Kai can reason from it."
            className={cn(inputCls, "h-auto py-2")}
          />
        </Field>
        <Field label="Resume text">
          <textarea
            value={form.resumeText}
            onChange={(e) => set("resumeText", e.target.value)}
            rows={8}
            placeholder="Paste your full resume text here."
            className={cn(inputCls, "h-auto py-2 font-mono text-xs")}
          />
        </Field>

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

        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save changes
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h3 className="text-sm font-semibold text-destructive">Delete my data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently removes your profile, reports, saved jobs, applications, momentum, and AI
          settings, then signs you out. This can&apos;t be undone.
        </p>
        {confirmingDelete ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Are you sure?</span>
            <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" aria-hidden="true" />
              Yes, delete everything
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete my data
          </Button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
