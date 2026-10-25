import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageIntro } from "@/components/layout/page-intro";
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <PageIntro
            compact
            title="Reset your password"
            description="Enter your account email to request a reset link."
          />
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              href="/auth/sign-in"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
