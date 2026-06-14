import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import {
  DEFAULT_SECTION_ORDER,
  parseResume,
  resolveResumeFont,
  resolveResumeFontSize,
  type ResumeData,
  type ResumeSectionKey,
  type ResumeTemplate,
} from "./resume";
import {
  isProseKind,
  LETTER_FIELDS,
  parseLetter,
  resolveLetterSignature,
  type LetterData,
  type ProseKind,
} from "./letter";

type DocxStyle = {
  nameAlign: (typeof AlignmentType)[keyof typeof AlignmentType];
  nameSize: number;
  headerAlign: (typeof AlignmentType)[keyof typeof AlignmentType];
  sectionColor: string;
  sectionSize: number;
  bodyFont: string;
  border: boolean;
};

// Mirrors the on-screen / PDF templates so DOCX matches what the user sees.
const DOCX_TEMPLATES: Record<ResumeTemplate, DocxStyle> = {
  classic: {
    nameAlign: AlignmentType.CENTER,
    nameSize: 32,
    headerAlign: AlignmentType.CENTER,
    sectionColor: "333333",
    sectionSize: 19,
    bodyFont: "Calibri",
    border: true,
  },
  modern: {
    nameAlign: AlignmentType.LEFT,
    nameSize: 38,
    headerAlign: AlignmentType.LEFT,
    sectionColor: "0F766E",
    sectionSize: 20,
    bodyFont: "Calibri",
    border: false,
  },
  compact: {
    nameAlign: AlignmentType.CENTER,
    nameSize: 28,
    headerAlign: AlignmentType.CENTER,
    sectionColor: "555555",
    sectionSize: 17,
    bodyFont: "Calibri",
    border: true,
  },
  // ATS: single column, left-aligned, near-black, standard Arial — safest parse.
  ats: {
    nameAlign: AlignmentType.LEFT,
    nameSize: 34,
    headerAlign: AlignmentType.LEFT,
    sectionColor: "111111",
    sectionSize: 19,
    bodyFont: "Arial",
    border: true,
  },
  // Executive: centered serif (Georgia), restrained — refined but still parse-safe.
  executive: {
    nameAlign: AlignmentType.CENTER,
    nameSize: 34,
    headerAlign: AlignmentType.CENTER,
    sectionColor: "222222",
    sectionSize: 19,
    bodyFont: "Georgia",
    border: true,
  },
};

function sectionHeading(text: string, s: DocxStyle): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 60 },
    border: s.border
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } }
      : undefined,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: s.sectionSize, color: s.sectionColor })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 20 } });
}

function renderSection(key: ResumeSectionKey, data: ResumeData, s: DocxStyle): Paragraph[] {
  switch (key) {
    case "summary":
      return data.summary ? [sectionHeading("Summary", s), new Paragraph({ text: data.summary })] : [];
    case "experiences":
      if (!data.experiences.length) return [];
      return [
        sectionHeading("Experience", s),
        ...data.experiences.flatMap((e) => [
          new Paragraph({
            children: [
              new TextRun({ text: [e.title, e.company].filter(Boolean).join(" — "), bold: true }),
              ...(e.period ? [new TextRun({ text: `   ${e.period}`, color: "777777", size: 18 })] : []),
            ],
          }),
          ...(e.location ? [new Paragraph({ children: [new TextRun({ text: e.location, italics: true, color: "777777", size: 18 })] })] : []),
          ...e.bullets.split("\n").filter(Boolean).map(bullet),
        ]),
      ];
    case "projects":
      if (!data.projects.length) return [];
      return [
        sectionHeading("Projects", s),
        ...data.projects.flatMap((p) => [
          new Paragraph({ children: [new TextRun({ text: p.title || "Project", bold: true })] }),
          ...(p.description ? [new Paragraph({ text: p.description })] : []),
        ]),
      ];
    case "education":
      if (!data.education.length) return [];
      return [
        sectionHeading("Education", s),
        ...data.education.map(
          (ed) =>
            new Paragraph({
              children: [
                new TextRun({ text: [ed.degree, ed.school].filter(Boolean).join(" — "), bold: true }),
                ...(ed.period ? [new TextRun({ text: `   ${ed.period}`, color: "777777", size: 18 })] : []),
              ],
            }),
        ),
      ];
    case "skills":
      if (!data.skills) return [];
      return [sectionHeading("Skills", s), ...data.skills.split("\n").filter(Boolean).map((line) => new Paragraph({ text: line }))];
    default:
      return [];
  }
}

function resumeParagraphs(data: ResumeData, s: DocxStyle): Paragraph[] {
  const p: Paragraph[] = [
    new Paragraph({
      alignment: s.nameAlign,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: data.personal.name || "Your Name", bold: true, size: s.nameSize })],
    }),
  ];
  if (data.personal.headline)
    p.push(new Paragraph({ alignment: s.headerAlign, children: [new TextRun({ text: data.personal.headline })] }));
  const contact = [data.personal.email, data.personal.phone, data.personal.location, data.personal.links]
    .filter(Boolean)
    .join("  ·  ");
  if (contact)
    p.push(new Paragraph({ alignment: s.headerAlign, children: [new TextRun({ text: contact, size: 18, color: "666666" })] }));

  const order = data.order?.length ? data.order : DEFAULT_SECTION_ORDER;
  for (const key of order) p.push(...renderSection(key, data, s));
  return p;
}

/** Build the paragraphs for a cover letter / cold email / value proposition. */
function letterParagraphs(data: LetterData, kind: ProseKind): Paragraph[] {
  const fields = LETTER_FIELDS[kind];
  const p: Paragraph[] = [];
  const line = (text: string, opts?: { bold?: boolean; color?: string; size?: number }) =>
    new Paragraph({ children: [new TextRun({ text, bold: opts?.bold, color: opts?.color, size: opts?.size })] });

  if (fields.sender && data.sender.name) p.push(line(data.sender.name, { bold: true }));
  if (fields.sender) {
    const contact = [data.sender.email, data.sender.phone, data.sender.location, data.sender.links]
      .filter(Boolean)
      .join("  ·  ");
    if (contact) p.push(line(contact, { size: 18, color: "666666" }));
  }
  if (fields.date && data.date) p.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: data.date })] }));
  if (fields.recipient) {
    for (const text of [data.recipient.name, data.recipient.title, data.recipient.company, data.recipient.location].filter(Boolean))
      p.push(line(text));
  }
  if (fields.subject && data.subject) {
    p.push(
      kind === "value_proposition"
        ? new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: data.subject, bold: true })] })
        : line(`Subject: ${data.subject}`, { bold: true }),
    );
  }
  if (fields.greeting && data.greeting) p.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: data.greeting })] }));

  for (const para of data.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean))
    p.push(new Paragraph({ spacing: { after: 120 }, text: para }));

  if (fields.signOff && data.signOff) p.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: data.signOff })] }));
  const signature = resolveLetterSignature(data);
  if (fields.signature && signature) p.push(line(signature, { bold: true }));
  return p;
}

/** Build a .docx Buffer — template + section order aware for resumes. */
export async function documentToDocx(doc: {
  kind: string;
  title: string;
  content: string;
  template?: string | null;
}): Promise<Buffer> {
  const style = DOCX_TEMPLATES[(doc.template as ResumeTemplate) || "classic"] ?? DOCX_TEMPLATES.classic;

  let bodyFont = style.bodyFont;
  let bodySize = 21; // half-points (~10.5pt) default
  let children;

  if (doc.kind === "resume") {
    const data = parseResume(doc.content);
    // User font/size overrides win over the template defaults.
    bodyFont = resolveResumeFont(data.font)?.docxName ?? style.bodyFont;
    bodySize = resolveResumeFontSize(data.fontSize)?.docxHalfPt ?? 21;
    children = resumeParagraphs(data, style);
  } else if (isProseKind(doc.kind)) {
    const data = parseLetter(doc.content, doc.kind);
    bodyFont = resolveResumeFont(data.font)?.docxName ?? style.bodyFont;
    bodySize = resolveResumeFontSize(data.fontSize)?.docxHalfPt ?? 21;
    children = letterParagraphs(data, doc.kind);
  } else {
    children = [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: doc.title, bold: true })] }),
      ...doc.content.split("\n").map((line) => new Paragraph({ text: line })),
    ];
  }

  const document = new Document({
    styles: { default: { document: { run: { font: bodyFont, size: bodySize } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(document);
}
