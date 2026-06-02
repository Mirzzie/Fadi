import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardShell />
    </AppShell>
  );
}
