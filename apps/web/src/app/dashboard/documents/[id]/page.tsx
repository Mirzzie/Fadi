import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentEditor } from "@/components/documents/document-editor";
import { LetterEditor } from "@/components/documents/letter-editor";
import { ResumeEditor } from "@/components/documents/resume-editor";
import { isProseKind } from "@/lib/documents/letter";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  createCareerProfilesRepository,
  createDocumentsRepository,
  createResumeTemplatesRepository,
} from "@careeros/database";

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

  // For resumes: tailor the advisor to real experience + load the user's saved templates.
  const [careerProfile, savedTemplates] =
    doc.kind === "resume"
      ? await Promise.all([
          createCareerProfilesRepository(db).getActiveForUser(user.id),
          createResumeTemplatesRepository(db).listForUser(user.id),
        ])
      : [null, []];

  return (
    <AppShell>
      {doc.kind === "resume" ? (
        <ResumeEditor
          id={doc.id}
          initialTitle={doc.title}
          initialContent={doc.content}
          initialTemplate={doc.template}
          experienceLevel={careerProfile?.experienceLevel ?? null}
          customTemplates={savedTemplates.map((t) => ({
            id: t.id,
            name: t.name,
            config: t.config,
          }))}
        />
      ) : isProseKind(doc.kind) ? (
        <LetterEditor
          id={doc.id}
          kind={doc.kind}
          initialTitle={doc.title}
          initialContent={doc.content}
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
