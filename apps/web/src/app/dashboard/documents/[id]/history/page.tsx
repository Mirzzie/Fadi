import type { Metadata } from "next";
import { ArrowLeft, Clock3 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/layout/page-intro";
import { RestoreRevisionButton } from "@/components/documents/restore-revision-button";
import { ResumePreview } from "@/components/documents/resume-preview";
import { LetterPreview } from "@/components/documents/letter-preview";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { parseResume, resumeToPlainText, type ResumeTemplate } from "@/lib/documents/resume";
import { isProseKind, parseLetter, letterToPlainText } from "@/lib/documents/letter";
import { createDocumentsRepository, type DocumentRevisionSnapshot } from "@careeros/database";

export const metadata: Metadata = { title: "Document history" };
export const dynamic = "force-dynamic";

export default async function DocumentHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const { id } = await params;
  const repo = createDocumentsRepository(getDatabase());
  const [document, storedRevisions] = await Promise.all([
    repo.getForUser(user.id, id),
    repo.listRevisionsForUser(user.id, id),
  ]);
  if (!document) notFound();

  // Documents created before migration 0043 acquire their first stored snapshot on
  // the next save. Until then, include the current database state in this view.
  const currentSnapshot: DocumentRevisionSnapshot = {
    title: document.title,
    content: document.content,
    format: document.format,
    template: document.template,
    jobContext: document.jobContext,
    metadata: document.metadata,
  };
  const revisions = storedRevisions.some((revision) => revision.version === document.version)
    ? storedRevisions
    : [
        {
          id: `current-${document.id}`,
          documentId: document.id,
          userId: user.id,
          version: document.version,
          snapshot: currentSnapshot,
          createdAt: document.updatedAt,
        },
        ...storedRevisions,
      ];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-start gap-3">
          <Link
            href={`/dashboard/documents/${document.id}`}
            className="mt-1 grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to document"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <PageIntro
            compact
            eyebrow="Document history"
            title={document.title}
            description="Every accepted save is retained. Restoring creates a new version and does not erase later work."
          />
        </header>

        <section className="space-y-3">
          {revisions.map((revision) => {
            const isCurrent = revision.version === document.version;
            const readable =
              document.kind === "resume"
                ? resumeToPlainText(parseResume(revision.snapshot.content))
                : isProseKind(document.kind)
                  ? letterToPlainText(parseLetter(revision.snapshot.content, document.kind))
                  : revision.snapshot.content;
            const excerpt = readable.replace(/\s+/g, " ").trim();
            return (
              <article
                key={revision.id}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">Version {revision.version}</h2>
                      {isCurrent ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="size-3" aria-hidden="true" />
                      {revision.createdAt.toLocaleString("en-IE")}
                    </p>
                  </div>
                  {!isCurrent ? (
                    <RestoreRevisionButton
                      documentId={document.id}
                      revisionVersion={revision.version}
                      expectedVersion={document.version}
                    />
                  ) : null}
                </div>

                <p className="mt-3 break-words text-sm font-medium">{revision.snapshot.title}</p>
                <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">
                  {excerpt || "Empty document"}
                </p>
                {revision.snapshot.content.trim() ? (
                  <details className="mt-3 rounded-md border border-border/60 bg-background/60 p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      Preview this version
                    </summary>
                    <div className="nice-scrollbar mt-3 max-h-80 min-w-0 overflow-auto rounded-md bg-white p-4 text-sm text-zinc-800">
                      {document.kind === "resume" ? (
                        <ResumePreview
                          embedded
                          data={parseResume(revision.snapshot.content)}
                          template={(revision.snapshot.template ?? "classic") as ResumeTemplate}
                        />
                      ) : isProseKind(document.kind) ? (
                        <LetterPreview
                          data={parseLetter(revision.snapshot.content, document.kind)}
                          kind={document.kind}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap break-words leading-relaxed">
                          {readable}
                        </div>
                      )}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
