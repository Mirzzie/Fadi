import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ResumeStudio } from "@/components/documents/resume-studio";
import { getCurrentAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Template Studio" };
export const dynamic = "force-dynamic";

// New "Template Studio" route (ADR 0010, Phase 2). A static sibling of the [id] document
// editor route — Next gives static segments precedence over the dynamic [id], so this
// doesn't collide. Additive: the existing editor is untouched.
export default async function TemplateStudioPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/documents/studio");

  return (
    <AppShell>
      <div className="mx-auto max-w-shell space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Template Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview Reactive Resume templates live, rendered by the engine now built into Fadi.
            Interactive editing and your real résumé data come next.
          </p>
        </div>
        <ResumeStudio />
      </div>
    </AppShell>
  );
}
