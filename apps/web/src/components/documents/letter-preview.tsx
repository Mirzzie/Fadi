import {
  LETTER_FIELDS,
  resolveLetterSignature,
  type LetterData,
  type ProseKind,
} from "@/lib/documents/letter";
import { resolveResumeFont, resolveResumeFontSize } from "@/lib/documents/resume";

/**
 * Pure render of a cover letter / cold email / value proposition — shared by the
 * editor's live preview and the print/PDF page (so it must stay server-renderable,
 * like ResumePreview). Honors the per-kind field config and the shared font/size.
 */
export function LetterPreview({ data, kind }: { data: LetterData; kind: ProseKind }) {
  const fields = LETTER_FIELDS[kind];
  const fontDef = resolveResumeFont(data.font);
  const sizeDef = resolveResumeFontSize(data.fontSize);
  const rootStyle: React.CSSProperties = {
    ...(fontDef ? { fontFamily: fontDef.cssStack } : {}),
    ...(sizeDef ? { fontSize: `${sizeDef.previewPx}px` } : {}),
  };

  const contact = [data.sender.email, data.sender.phone, data.sender.location, data.sender.links]
    .filter(Boolean)
    .join("  ·  ");
  const paragraphs = data.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const signature = resolveLetterSignature(data);

  return (
    <div className="space-y-4 leading-relaxed text-zinc-800" style={rootStyle}>
      {/* Sender header (cover letter) */}
      {fields.sender && (data.sender.name || contact) ? (
        <header className="space-y-0.5">
          {data.sender.name ? (
            <p className="text-base font-bold tracking-tight text-zinc-900">{data.sender.name}</p>
          ) : null}
          {contact ? <p className="text-[11px] text-zinc-500">{contact}</p> : null}
        </header>
      ) : null}

      {fields.date && data.date ? <p className="text-zinc-600">{data.date}</p> : null}

      {/* Recipient block (cover letter) */}
      {fields.recipient && hasRecipient(data) ? (
        <address className="not-italic text-zinc-700">
          {data.recipient.name ? <p className="font-medium">{data.recipient.name}</p> : null}
          {data.recipient.title ? <p>{data.recipient.title}</p> : null}
          {data.recipient.company ? <p>{data.recipient.company}</p> : null}
          {data.recipient.location ? <p>{data.recipient.location}</p> : null}
        </address>
      ) : null}

      {/* Subject (email) / Headline (VPD) */}
      {fields.subject && data.subject ? (
        kind === "value_proposition" ? (
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">{data.subject}</h1>
        ) : (
          <p className="font-semibold text-zinc-900">
            <span className="text-zinc-500">Subject: </span>
            {data.subject}
          </p>
        )
      ) : null}

      {fields.greeting && data.greeting ? <p>{data.greeting}</p> : null}

      {/* Body */}
      {paragraphs.length ? (
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-zinc-400">Your {fields.bodyLabel.toLowerCase()} will appear here…</p>
      )}

      {/* Sign-off + signature */}
      {fields.signOff && data.signOff ? <p className="pt-1">{data.signOff}</p> : null}
      {fields.signature && signature ? <p className="font-medium text-zinc-900">{signature}</p> : null}
    </div>
  );
}

function hasRecipient(data: LetterData): boolean {
  const r = data.recipient;
  return Boolean(r.name || r.title || r.company || r.location);
}
