import { cn } from "@/lib/utils";
import {
  DEFAULT_SECTION_ORDER,
  resolveResumeFont,
  resolveResumeFontSize,
  type ResumeData,
  type ResumeSectionKey,
  type ResumeTemplate,
} from "@/lib/documents/resume";

type TemplateStyle = {
  header: string;
  name: string;
  sectionHeader: string;
  root: string;
};

// Print-safe colors (oklch/theme tokens don't print reliably).
const TEMPLATES: Record<ResumeTemplate, TemplateStyle> = {
  classic: {
    root: "space-y-4",
    header: "text-center",
    name: "text-xl font-bold tracking-tight",
    sectionHeader: "mb-1 border-b border-zinc-300 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-700",
  },
  modern: {
    root: "space-y-4",
    header: "border-l-4 border-teal-600 pl-3",
    name: "text-2xl font-bold tracking-tight text-zinc-900",
    sectionHeader: "mb-1.5 text-[12px] font-bold uppercase tracking-wider text-teal-700",
  },
  compact: {
    root: "space-y-2.5 text-[12px]",
    header: "text-center",
    name: "text-lg font-bold tracking-tight",
    sectionHeader: "mb-0.5 border-b border-zinc-300 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600",
  },
  // Maximally ATS-safe: single column, left-aligned, black text, no accent
  // colour, plain rules — the layout parsers read most reliably.
  ats: {
    root: "space-y-3.5",
    header: "text-left",
    name: "text-2xl font-bold tracking-tight text-zinc-900",
    sectionHeader: "mb-1 border-b border-zinc-400 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-900",
  },
  // Refined serif, centered — still single column and ATS-safe.
  executive: {
    root: "space-y-4 font-serif",
    header: "text-center border-b-2 border-zinc-800 pb-2",
    name: "text-2xl font-bold tracking-wide text-zinc-900",
    sectionHeader: "mb-1.5 text-[12px] font-bold uppercase tracking-[0.15em] text-zinc-800",
  },
};

/** Pure render of a resume — shared by the editor's live preview and the
 *  print/PDF page. Honors the chosen template + the section order. */
export function ResumePreview({
  data,
  template = "classic",
}: {
  data: ResumeData;
  template?: ResumeTemplate;
}) {
  const t = TEMPLATES[template] ?? TEMPLATES.classic;
  const contact = [data.personal.email, data.personal.phone, data.personal.location, data.personal.links]
    .filter(Boolean)
    .join("  ·  ");
  const order = data.order?.length ? data.order : DEFAULT_SECTION_ORDER;

  // Optional font/size overrides — when unset, the template's defaults apply.
  const fontDef = resolveResumeFont(data.font);
  const sizeDef = resolveResumeFontSize(data.fontSize);
  const rootStyle: React.CSSProperties = {
    ...(fontDef ? { fontFamily: fontDef.cssStack } : {}),
    ...(sizeDef ? { fontSize: `${sizeDef.previewPx}px` } : {}),
  };

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section>
        <h2 className={t.sectionHeader}>{title}</h2>
        {children}
      </section>
    );
  }

  function renderSection(key: ResumeSectionKey) {
    switch (key) {
      case "summary":
        return data.summary ? (
          <Section title="Summary">
            <p className="leading-relaxed">{data.summary}</p>
          </Section>
        ) : null;
      case "experiences":
        return data.experiences.length ? (
          <Section title="Experience">
            {data.experiences.map((e) => (
              <div key={e.id} className="mb-2">
                <div className="flex justify-between font-semibold">
                  <span>
                    {e.title || "Role"}
                    {e.company ? ` — ${e.company}` : ""}
                  </span>
                  <span className="text-[11px] font-normal text-zinc-500">{e.period}</span>
                </div>
                {e.location ? <p className="text-[11px] text-zinc-500">{e.location}</p> : null}
                <ul className="ml-4 list-disc">
                  {e.bullets
                    .split("\n")
                    .filter(Boolean)
                    .map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                </ul>
              </div>
            ))}
          </Section>
        ) : null;
      case "projects":
        return data.projects.length ? (
          <Section title="Projects">
            {data.projects.map((p) => (
              <div key={p.id} className="mb-1.5">
                <p className="font-semibold">{p.title || "Project"}</p>
                {p.description ? <p className="text-zinc-700">{p.description}</p> : null}
              </div>
            ))}
          </Section>
        ) : null;
      case "education":
        return data.education.length ? (
          <Section title="Education">
            {data.education.map((ed) => (
              <div key={ed.id} className="flex justify-between">
                <span>
                  <span className="font-semibold">{ed.degree || "Degree"}</span>
                  {ed.school ? ` — ${ed.school}` : ""}
                </span>
                <span className="text-[11px] text-zinc-500">{ed.period}</span>
              </div>
            ))}
          </Section>
        ) : null;
      case "certifications":
        return data.certifications.length ? (
          <Section title="Certifications & Licenses">
            {data.certifications.map((c) => (
              <div key={c.id} className="flex justify-between">
                <span>
                  <span className="font-semibold">{c.name || "Certification"}</span>
                  {c.issuer ? ` — ${c.issuer}` : ""}
                </span>
                <span className="text-[11px] text-zinc-500">{c.date}</span>
              </div>
            ))}
          </Section>
        ) : null;
      case "languages":
        return data.languages.length ? (
          <Section title="Languages">
            <p className="leading-relaxed">
              {data.languages
                .map((l) => (l.level ? `${l.name} (${l.level})` : l.name))
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Section>
        ) : null;
      case "awards":
        return data.awards.length ? (
          <Section title="Awards & Honours">
            {data.awards.map((a) => (
              <div key={a.id} className="flex justify-between">
                <span>
                  <span className="font-semibold">{a.title || "Award"}</span>
                  {a.awarder ? ` — ${a.awarder}` : ""}
                </span>
                <span className="text-[11px] text-zinc-500">{a.date}</span>
              </div>
            ))}
          </Section>
        ) : null;
      case "volunteer":
        return data.volunteer.length ? (
          <Section title="Volunteer & Community">
            {data.volunteer.map((v) => (
              <div key={v.id} className="mb-1.5">
                <div className="flex justify-between font-semibold">
                  <span>
                    {v.role || "Role"}
                    {v.organization ? ` — ${v.organization}` : ""}
                  </span>
                  <span className="text-[11px] font-normal text-zinc-500">{v.period}</span>
                </div>
                {v.summary ? <p className="text-zinc-700">{v.summary}</p> : null}
              </div>
            ))}
          </Section>
        ) : null;
      case "references":
        return data.references.length ? (
          <Section title="References">
            {data.references.map((r) => (
              <div key={r.id}>
                <span className="font-semibold">{r.name || "Reference"}</span>
                {r.reference ? <span className="text-zinc-700"> — {r.reference}</span> : null}
              </div>
            ))}
          </Section>
        ) : null;
      case "publications":
        return data.publications.length ? (
          <Section title="Publications">
            {data.publications.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>
                  <span className="font-semibold">{p.name || "Publication"}</span>
                  {p.publisher ? ` — ${p.publisher}` : ""}
                </span>
                <span className="text-[11px] text-zinc-500">{p.date}</span>
              </div>
            ))}
          </Section>
        ) : null;
      case "interests":
        return data.interests.length ? (
          <Section title="Interests">
            <p className="leading-relaxed">
              {data.interests
                .map((it) => (it.keywords ? `${it.name} (${it.keywords})` : it.name))
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Section>
        ) : null;
      case "skills":
        return data.skills ? (
          <Section title="Skills">
            {data.skills
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <p key={i}>{line}</p>
              ))}
          </Section>
        ) : null;
      default:
        return null;
    }
  }

  return (
    <div className={t.root} style={rootStyle}>
      <header className={t.header}>
        {data.personal.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.personal.photo}
            alt=""
            className="mx-auto mb-2 size-20 rounded-full object-cover"
          />
        ) : null}
        <h1 className={t.name}>{data.personal.name || "Your Name"}</h1>
        {data.personal.headline ? <p className="text-sm text-zinc-600">{data.personal.headline}</p> : null}
        {contact ? <p className={cn("mt-1 text-[11px] text-zinc-500")}>{contact}</p> : null}
      </header>
      {order.map((key) => (
        <div key={key}>{renderSection(key)}</div>
      ))}
    </div>
  );
}
