import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Set a new password",
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="scout-glow-sm w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
