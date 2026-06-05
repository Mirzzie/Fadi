import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentsShell } from "@/components/documents/documents-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { createDocumentsRepository } from "@careeros/database";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/documents");

  const docs = await createDocumentsRepository(getDatabase()).listForUser(user.id);

  return (
    <AppShell>
      <DocumentsShell
        documents={docs.map((d) => ({
          id: d.id,
          kind: d.kind,
          title: d.title,
          updatedAt: d.updatedAt.toISOString(),
          preview: d.content.slice(0, 140),
        }))}
      />
    </AppShell>
  );
}
