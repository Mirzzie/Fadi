import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createMcpConnectionsRepository, createProfilesRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { AiProviderForm } from "@/components/settings/ai-provider-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { AutoPrepToggle } from "@/components/settings/auto-prep-toggle";
import { ConnectedAccounts } from "@/components/settings/connected-accounts";
import { ConnectedTools } from "@/components/settings/connected-tools";
import { McpTokens } from "@/components/settings/mcp-tokens";
import { NotionIntegration } from "@/components/settings/notion-integration";
import { listMcpTokens } from "@/lib/mcp/tokens";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getEnabledSocialProviders } from "@/lib/auth/social";
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
  const mcpTokens = await listMcpTokens(user.id);
  const connections = await createMcpConnectionsRepository(getDatabase()).listForUser(user.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 pb-12">
        <header className="border-b border-border pb-8 pt-3">
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Set your appearance, connections and how Fadi prepares work. Review permissions
            before enabling actions that affect other services.
          </p>
        </header>

        <AppearanceSettings />
        <AiProviderForm descriptors={PROVIDER_DESCRIPTORS} initial={settings} />

        <ConnectedTools
          connections={connections.map((connection) => ({
            id: connection.id,
            label: connection.label,
            slug: connection.slug,
            url: connection.url,
            status: connection.status,
            statusDetail: connection.statusDetail,
            toolCount: connection.tools.length,
            mayAct: connection.autoApprove,
            lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
          }))}
        />

        <AutoPrepToggle initial={profile?.autoPrepEnabled ?? false} />

        <ConnectedAccounts providers={getEnabledSocialProviders()} />

        <NotionIntegration connected={Boolean(profile?.notionDatabaseId)} />

        <McpTokens tokens={mcpTokens} />
      </div>
    </AppShell>
  );
}
