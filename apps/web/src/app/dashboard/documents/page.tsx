import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentsShell } from "@/components/documents/documents-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { isProseKind, letterSnippet } from "@/lib/documents/letter";
import { parseResume } from "@/lib/documents/resume";
import { createDocumentsRepository } from "@careeros/database";

/** A readable card snippet — content is JSON for structured kinds, so unpack it. */
function previewFor(kind: string, content: string): string {
  if (isProseKind(kind)) return letterSnippet(content, kind).slice(0, 140);
  if (kind === "resume") {
    const r = parseResume(content);
    return (r.summary || r.personal.headline || r.personal.name || "").slice(0, 140);
  }
  return content.slice(0, 140);
}

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
          preview: previewFor(d.kind, d.content),
        }))}
      />
    </AppShell>
  );
}
