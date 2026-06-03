"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { authFormSchema, type AuthFormValues } from "@/lib/auth/validation";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

type AuthActionResult = {
  ok: boolean;
  message?: string;
};

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

function getSafeAuthMessage(message?: string) {
  if (!message) {
    return "Authentication failed. Please try again.";
  }

  if (/rate limit/i.test(message)) {
    return "Too many authentication attempts. Please wait a moment and try again.";
  }

  return message;
}

function getDefaultDisplayName(email: string) {
  return email.split("@")[0] ?? "CareerOS user";
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
        ? await authClient.signUp.email({
            email: values.email,
            password: values.password,
            name: getDefaultDisplayName(values.email),
          })
        : await authClient.signIn.email({
            email: values.email,
            password: values.password,
            rememberMe: true,
          });

      if (actionResult.error) {
        setResult({
          ok: false,
          message: getSafeAuthMessage(actionResult.error.message),
        });
        return;
      }

      if (actionResult.data) {
        const next = getSafeNextPath(searchParams.get("next"));
        router.push(!isSignUp && next ? next : "/dashboard");
        router.refresh();
        return;
      }

      setResult({
        ok: false,
        message: "Authentication failed. Please try again.",
      });
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
