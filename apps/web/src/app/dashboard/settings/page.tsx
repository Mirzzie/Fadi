import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cpu } from "lucide-react";

import { createProfilesRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { AiProviderForm } from "@/components/settings/ai-provider-form";
import { AutoPrepToggle } from "@/components/settings/auto-prep-toggle";
import { NotionIntegration } from "@/components/settings/notion-integration";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserAiSettingsView } from "@/lib/ai/user-settings";
import { getDatabase } from "@/lib/database/client";
import { PROVIDER_DESCRIPTORS } from "@/lib/ai/providers/types";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const settings = await getUserAiSettingsView(user.id);
  const profile = await createProfilesRepository(getDatabase()).getByUserId(user.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="relative overflow-hidden rounded-xl border bg-card p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "oklch(0.66 0.22 285)" }}
          />
          <div className="relative flex items-start gap-4">
            <div className="glow-primary grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
              <Cpu className="size-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                AI{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
                  provider
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scout works with any provider. Bring your own key — it&apos;s encrypted at rest and
                only ever used to power your Scout.
              </p>
            </div>
          </div>
        </section>

        <AiProviderForm descriptors={PROVIDER_DESCRIPTORS} initial={settings} />

        <AutoPrepToggle initial={profile?.autoPrepEnabled ?? false} />

        <NotionIntegration connected={Boolean(profile?.notionDatabaseId)} />
      </div>
    </AppShell>
  );
}
