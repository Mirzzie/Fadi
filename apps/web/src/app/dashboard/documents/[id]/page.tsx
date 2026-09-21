import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentEditor } from "@/components/documents/document-editor";
import { LetterEditor } from "@/components/documents/letter-editor";
import { ResumeEditor } from "@/components/documents/resume-editor";
import { FreshnessNote } from "@/components/documents/freshness-note";
import { TailoringPanel } from "@/components/documents/tailoring-panel";
import { TruthReport } from "@/components/documents/truth-report";
import { isProseKind } from "@/lib/documents/letter";
import { checkDocumentTruth } from "@/lib/documents/corpus";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { documentFreshness } from "@/lib/documents/freshness.server";
import { resolveLocaleNorm } from "@/lib/documents/locale-norms";
import {
  createCareerProfilesRepository,
  createDocumentsRepository,
  createJobsRepository,
  createResumeTemplatesRepository,
} from "@careeros/database";

export const metadata: Metadata = { title: "Edit document" };
export const dynamic = "force-dynamic";

export default async function DocumentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const { id } = await params;
  const db = getDatabase();
  const doc = await createDocumentsRepository(db).getForUser(user.id, id);
  if (!doc) notFound();

  // For resumes: tailor the advisor to real experience + load the user's saved templates.
  // The active direction is loaded for EVERY kind, not only résumés: it carries the person's
  // region, which decides the local standard shown above a cover letter too. Only the résumé
  // needs the saved style templates.
  const [careerProfile, savedTemplates] = await Promise.all([
    createCareerProfilesRepository(db).getActiveForUser(user.id),
    doc.kind === "resume" ? createResumeTemplatesRepository(db).listForUser(user.id) : [],
  ]);

  // Truth gate: re-check this document, as it stands, against the candidate's current record —
  // the trust glance that replaces defensive re-reading (the hidden hour). JD (when the doc is
  // linked to a job) powers the JD-contamination check; the number/seniority checks run regardless.
  const job = doc.jobId ? await createJobsRepository(db).findByIdForUser(user.id, doc.jobId) : null;
  const jobDescription = job?.description ?? null;

  // What this document is for, and the norms of the place it is going: an Irish employer expects
  // a CV of 1–2 pages with no photo, a US one a résumé with no personal details. Resolved from
  // the JOB's location when there is one, otherwise where the person is.
  const standard = resolveLocaleNorm(job?.location ?? careerProfile?.location ?? null);
  const truthFindings = await checkDocumentTruth(user.id, doc.content, jobDescription);

  // Has the person's record moved on since this was written? Compared against the material
  // generation captured, so the answer names what changed instead of nagging — see
  // lib/documents/freshness.ts.
  const freshness = await documentFreshness(user.id, doc);
  const freshnessAsk = freshness.state === "stale" ? freshness.ask : null;

  return (
    <AppShell>
      {/* ONE WIDTH FOR THE PAGE. The panels were 1180px and the editor 1152px, so their edges
          missed each other by 28px on every document — and on a wide screen both sat in a narrow
          column with the preview cramped. Reported as "spacing and alignments". The editors below
          now fill this container instead of centring themselves at their own widths. */}
      <div className="mx-auto w-full max-w-[100rem] space-y-3 px-3 pb-4 sm:px-5">
        <TailoringPanel
          documentId={doc.id}
          job={
            job
              ? { id: job.id, title: job.title, company: job.company, location: job.location }
              : null
          }
          standard={{
            label: standard.label,
            documentTerm: standard.documentTerm,
            lengthPages: standard.lengthPages,
            photo: standard.photo,
            dateFormat: standard.dateFormat,
            notes: standard.notes,
          }}
        />
        <FreshnessNote freshness={freshness} />
        <TruthReport findings={truthFindings} />

        {doc.kind === "resume" ? (
          <ResumeEditor
            id={doc.id}
            initialTitle={doc.title}
            initialContent={doc.content}
            initialTemplate={doc.template}
            initialVersion={doc.version}
            hasJob={Boolean(job)}
            freshnessAsk={freshnessAsk}
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
            hasJob={Boolean(job)}
            freshnessAsk={freshnessAsk}
            kind={doc.kind}
            initialTitle={doc.title}
            initialContent={doc.content}
            initialVersion={doc.version}
          />
        ) : (
          <DocumentEditor
            id={doc.id}
            kind={doc.kind}
            initialTitle={doc.title}
            initialContent={doc.content}
            initialVersion={doc.version}
          />
        )}
      </div>
    </AppShell>
  );
}
