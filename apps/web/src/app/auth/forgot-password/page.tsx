import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Forgot password",
};

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await getCurrentAuthUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="scout-glow-sm w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your account email and we&apos;ll send a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/auth/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
