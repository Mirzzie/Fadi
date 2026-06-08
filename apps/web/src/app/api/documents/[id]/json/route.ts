import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { toJsonResume } from "@/lib/documents/json-resume";
import { parseResume } from "@/lib/documents/resume";
import { createDocumentsRepository } from "@careeros/database";

/** Export a resume as a JSON Resume (jsonresume.org) download — the open standard. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await createDocumentsRepository(getDatabase()).getForUser(user.id, id);
  if (!doc) return new Response("Not found", { status: 404 });
  if (doc.kind !== "resume") return new Response("Only resumes export to JSON Resume", { status: 400 });

  const jsonResume = toJsonResume(parseResume(doc.content));
  const filename = `${doc.title.replace(/[^\w.-]+/g, "_") || "resume"}.json`;

  return new Response(JSON.stringify(jsonResume, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
