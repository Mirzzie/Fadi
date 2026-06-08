import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentEditor } from "@/components/documents/document-editor";
import { ResumeEditor } from "@/components/documents/resume-editor";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { createCareerProfilesRepository, createDocumentsRepository } from "@careeros/database";

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
  const db = getDatabase();
  const doc = await createDocumentsRepository(db).getForUser(user.id, id);
  if (!doc) notFound();

  // For resumes, the recruiter advisor tailors its length tip to real experience.
  const careerProfile =
    doc.kind === "resume" ? await createCareerProfilesRepository(db).getActiveForUser(user.id) : null;

  return (
    <AppShell>
      {doc.kind === "resume" ? (
        <ResumeEditor
          id={doc.id}
          initialTitle={doc.title}
          initialContent={doc.content}
          initialTemplate={doc.template}
          experienceLevel={careerProfile?.experienceLevel ?? null}
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
