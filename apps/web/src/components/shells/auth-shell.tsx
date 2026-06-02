import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthShellProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthShell({ mode }: AuthShellProps) {
  const isSignUp = mode === "sign-up";

  return (
    <div className="mx-auto flex min-h-screen max-w-shell items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Start your first Career Intelligence Report."
              : "Return to your CareerOS AI workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense
            fallback={
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Loading authentication form...
              </div>
            }
          >
            <AuthForm mode={mode} />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to CareerOS AI?"}{" "}
            <Link
              href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
