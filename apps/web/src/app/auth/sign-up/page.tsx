import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/shells/auth-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getEnabledSocialProviders } from "@/lib/auth/social";

export const metadata: Metadata = {
  title: "Sign up",
};

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const user = await getCurrentAuthUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthShell mode="sign-up" socialProviders={getEnabledSocialProviders()} />;
}
