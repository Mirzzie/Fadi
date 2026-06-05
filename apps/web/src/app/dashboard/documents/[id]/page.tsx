import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentEditor } from "@/components/documents/document-editor";
import { ResumeEditor } from "@/components/documents/resume-editor";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { createDocumentsRepository } from "@careeros/database";

export const metadata: Metadata = { title: "Edit document" };
export const dynamic = "force-dynamic";

export default async function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const { id } = await params;
  const doc = await createDocumentsRepository(getDatabase()).getForUser(user.id, id);
  if (!doc) notFound();

  return (
    <AppShell>
      {doc.kind === "resume" ? (
        <ResumeEditor
          id={doc.id}
          initialTitle={doc.title}
          initialContent={doc.content}
          initialTemplate={doc.template}
        />
      ) : (
        <DocumentEditor
          id={doc.id}
          kind={doc.kind}
          initialTitle={doc.title}
          initialContent={doc.content}
        />
      )}
    </AppShell>
  );
}
