import { ChevronDown } from "lucide-react";

import { structureJobDescription, type JdSection } from "@/lib/jobs/jd-structure";

/**
 * LinkedIn-style sectioned job description. Parses the raw text into headed
 * sections + bullet lists (deterministic, no AI); shows the lead-in and first
 * section, with the rest behind a no-JS <details> expander. Unstructured text
 * falls back to plain paragraphs — never worse than the old blob.
 */
export function JobDescription({ text }: { text: string | null }) {
  if (!text?.trim()) return null;

  const { sections, hasStructure } = structureJobDescription(text);

  if (!hasStructure) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        {sections.flatMap((s) => s.paragraphs).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }

  const visible = sections.slice(0, 2);
  const hidden = sections.slice(2);

  return (
    <div className="space-y-3">
      {visible.map((section, i) => (
        <Section key={i} section={section} />
      ))}
      {hidden.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show full description</span>
            <span className="hidden group-open:inline">Show less</span>
            <ChevronDown
              className="size-3.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-3 space-y-3">
            {hidden.map((section, i) => (
              <Section key={i} section={section} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Section({ section }: { section: JdSection }) {
  return (
    <div className="space-y-1.5">
      {section.title ? (
        <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
      ) : null}
      {section.paragraphs.map((p, i) => (
        <p key={`p-${i}`} className="text-sm text-muted-foreground">
          {p}
        </p>
      ))}
      {section.bullets.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {section.bullets.map((b, i) => (
            <li key={`b-${i}`} className="flex gap-2">
              <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
