import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PortfolioManager } from "@/components/portfolio/portfolio-manager";
import { getCurrentAuthUser } from "@/lib/auth/session";

import { loadPortfolio } from "./actions";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/portfolio");

  const data = await loadPortfolio();
  if (!data.ok) redirect("/auth/sign-in?next=/dashboard/portfolio");

  return (
    <AppShell>
      <PortfolioManager
        site={data.site}
        handle={data.handle}
        isPublished={data.isPublished}
        items={data.items}
      />
    </AppShell>
  );
}
