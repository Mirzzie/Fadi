import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return (
    <AppShell>
      <DashboardShell userEmail={user.email} />
    </AppShell>
  );
}
