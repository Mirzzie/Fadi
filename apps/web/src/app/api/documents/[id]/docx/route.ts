import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { documentToDocx } from "@/lib/documents/docx";
import { createDocumentsRepository } from "@careeros/database";

/** Export a document as a .docx download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await createDocumentsRepository(getDatabase()).getForUser(user.id, id);
  if (!doc) return new Response("Not found", { status: 404 });

  const buffer = await documentToDocx({
    kind: doc.kind,
    title: doc.title,
    content: doc.content,
    template: doc.template,
  });
  const filename = `${doc.title.replace(/[^\w.-]+/g, "_") || "document"}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
