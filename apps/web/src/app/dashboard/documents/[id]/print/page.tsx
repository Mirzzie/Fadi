import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintNow } from "@/components/documents/print-now";
import { ResumePreview } from "@/components/documents/resume-preview";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { parseResume, type ResumeTemplate } from "@/lib/documents/resume";
import { createDocumentsRepository } from "@careeros/database";

export const metadata: Metadata = { title: "Print" };
export const dynamic = "force-dynamic";

/** Standalone print page (no app chrome) → browser print → PDF. */
export default async function DocumentPrintPage({
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
    <div className="min-h-screen bg-zinc-100 py-8 text-[13px] text-zinc-800">
      <PrintNow />
      <div className="mx-auto max-w-[800px] bg-white p-12 shadow-md print:p-0 print:shadow-none">
        {doc.kind === "resume" ? (
          <ResumePreview
            data={parseResume(doc.content)}
            template={(doc.template as ResumeTemplate) || "classic"}
          />
        ) : (
          <article className="space-y-3">
            <h1 className="text-lg font-bold">{doc.title}</h1>
            <p className="whitespace-pre-wrap leading-relaxed">{doc.content}</p>
          </article>
        )}
      </div>
    </div>
  );
}
