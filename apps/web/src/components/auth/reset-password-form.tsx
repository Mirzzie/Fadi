"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "" },
  });

  if (!token) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="status">
          This reset link is missing its token — it may have been truncated by your email client.
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  function onSubmit(values: ResetValues) {
    setError(null);
    startTransition(async () => {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token: token!,
      });
      if (result.error) {
        setError(
          result.error.message ??
            "That link is invalid or has expired. Request a new one and try again.",
        );
        return;
      }
      router.push("/auth/sign-in?reset=success");
    });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="status">
          {error}{" "}
          <Link href="/auth/forgot-password" className="font-medium underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          placeholder="********"
          autoComplete="new-password"
          aria-invalid={Boolean(form.formState.errors.password)}
          disabled={isPending}
          {...form.register("password")}
        />
        {form.formState.errors.password?.message ? (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isPending ? "Working..." : "Set new password"}
      </Button>
    </form>
  );
}
