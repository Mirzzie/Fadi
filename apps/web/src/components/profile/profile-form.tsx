"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2, UserX, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CvUpload } from "@/components/profile/cv-upload";
import { FadiGuardianCallout } from "@/components/workspace/fadi-guardian-callout";
import { evaluateDeleteAllData } from "@/lib/guardian/guardian";
import { cn } from "@/lib/utils";
import {
  closeAccountAction,
  deleteAccountDataAction,
  updateProfileAction,
  type UpdateProfileInput,
} from "@/app/dashboard/profile/actions";

const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "principal"];

export function ProfileForm({
  email,
  initial,
  directionLabel,
}: {
  email: string;
  initial: UpdateProfileInput;
  /** The active direction's name — the resume below belongs to IT. */
  directionLabel?: string | null;
}) {
  const [form, setForm] = useState<UpdateProfileInput>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  // Which destructive action is being confirmed. Two distinct paths (ADR 0007):
  // "data" keeps the login and starts fresh; "account" is full erasure incl. credentials.
  const [confirming, setConfirming] = useState<null | "data" | "account">(null);

  function set<K extends keyof UpdateProfileInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setStatus(null);
    startTransition(async () => setStatus(await updateProfileAction(form)));
  }

  function removeData() {
    setStatus(null);
    startTransition(async () => {
      const res = await deleteAccountDataAction();
      // On success the action signs out + redirects; this only shows on failure.
      setStatus(res);
    });
  }

  function closeAccount() {
    setStatus(null);
    startTransition(async () => {
      const res = await closeAccountAction();
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
        <Field label="Career history — LinkedIn (your source of truth)">
          <p className="-mt-0.5 text-xs text-muted-foreground">
            The full, role-agnostic record Fadi grounds everything in. We can&apos;t pull it from
            LinkedIn automatically — paste your About + experience, or upload your LinkedIn
            &ldquo;Save to PDF&rdquo; export. Your resumes can be tailored per role; this stays complete.
          </p>
          <CvUpload label="Upload LinkedIn PDF export" onExtracted={(text) => set("linkedInText", text)} />
          <textarea
            value={form.linkedInText}
            onChange={(e) => set("linkedInText", e.target.value)}
            rows={6}
            placeholder="Paste your LinkedIn About + experience here, or upload the PDF above."
            className={cn(inputCls, "h-auto py-2")}
          />
        </Field>
        <Field label={directionLabel ? `Base resume — your “${directionLabel}” direction` : "Base resume / CV"}>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            Each direction keeps its own base resume — every job document Fadi tailors in{" "}
            {directionLabel ? `“${directionLabel}”` : "this direction"} starts from THIS text (your
            words are preserved, not rewritten). Add direction-specific projects or certifications
            here as you earn them. Your LinkedIn above stays the shared career history. Don&apos;t
            paste the same LinkedIn text here — it needs to be an actual resume.
          </p>
          <CvUpload onExtracted={(text) => set("resumeText", text)} />
          <textarea
            value={form.resumeText}
            onChange={(e) => set("resumeText", e.target.value)}
            rows={8}
            placeholder="Upload your CV above, or paste the text here."
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

      {/* Danger zone — two distinct actions, honestly labelled (ADR 0007). */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-6">
        {/* 1. Start over — wipe data, keep the login. */}
        <div>
          <h3 className="text-sm font-semibold text-destructive">Delete my data &amp; start over</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently removes your profile, reports, evidence, applications, momentum, and AI
            settings — then signs you out. <strong>Your login stays</strong>, so you can sign back
            in and start a fresh search. This can&apos;t be undone.
          </p>
          {confirming === "data" ? (
            <div className="mt-3 space-y-3">
              <FadiGuardianCallout verdict={evaluateDeleteAllData()} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Are you sure?</span>
                <Button variant="destructive" size="sm" onClick={removeData} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                  Yes, delete my data
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setConfirming("data")}
              disabled={pending}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete my data
            </Button>
          )}
        </div>

        <div className="border-t border-destructive/20" />

        {/* 2. Full closure — wipe data AND the login. GDPR erasure. */}
        <div>
          <h3 className="text-sm font-semibold text-destructive">Close my account</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything above, <strong>plus your login itself</strong>. Nothing is kept and there is
            no account to sign back into — this is full, permanent deletion.
          </p>
          {confirming === "account" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                Permanently close this account? There is no undo.
              </span>
              <Button variant="destructive" size="sm" onClick={closeAccount} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserX className="size-4" aria-hidden="true" />
                )}
                Yes, close my account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirming("account")}
              disabled={pending}
            >
              <UserX className="size-4" aria-hidden="true" />
              Close my account
            </Button>
          )}
        </div>
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
