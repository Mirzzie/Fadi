"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  signInWithPasswordAction,
  signUpWithPasswordAction,
  type AuthActionResult,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFormSchema, type AuthFormValues } from "@/lib/auth/validation";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(() => {
    if (searchParams.get("error") === "callback") {
      return {
        ok: false,
        message: "The authentication callback failed. Please sign in again.",
      };
    }

    return null;
  });

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSignUp = mode === "sign-up";

  function onSubmit(values: AuthFormValues) {
    setResult(null);

    startTransition(async () => {
      const actionResult = isSignUp
        ? await signUpWithPasswordAction(values)
        : await signInWithPasswordAction(values);

      if (actionResult.redirectTo) {
        const next = getSafeNextPath(searchParams.get("next"));
        router.push(!isSignUp && next ? next : actionResult.redirectTo);
        router.refresh();
        return;
      }

      setResult(actionResult);
    });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {result?.message ? (
        <div
          className={
            result.ok
              ? "rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
              : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {result.message}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={Boolean(form.formState.errors.email)}
          disabled={isPending}
          {...form.register("email")}
        />
        {form.formState.errors.email?.message ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="********"
          autoComplete={isSignUp ? "new-password" : "current-password"}
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
        {isPending ? "Working..." : isSignUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
