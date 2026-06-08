"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Change password — Better Auth verifies the current password server-side, and
 * we revoke other sessions on success so a leaked old password can't linger on
 * another device. Works without any email infrastructure.
 */
export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");

    setResult(null);
    if (newPassword.length < 8) {
      setResult({ ok: false, message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirm) {
      setResult({ ok: false, message: "New password and confirmation don't match." });
      return;
    }

    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);

    if (error) {
      setResult({ ok: false, message: error.message ?? "Couldn't change your password." });
      return;
    }
    form.reset();
    setResult({ ok: true, message: "Password updated. Other devices have been signed out." });
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold tracking-tight">Password</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Change your password. We&apos;ll sign out your other devices for safety.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
              </div>
            </div>

            {result ? (
              <p className={result.ok ? "text-sm text-primary" : "text-sm text-destructive"} role="status">
                {result.message}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
