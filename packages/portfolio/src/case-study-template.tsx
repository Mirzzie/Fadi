import Link from "next/link";

import type { PortfolioItemView, PortfolioSiteView } from "./view";
import { GalleryLightbox } from "./gallery-lightbox";
import { PortfolioChrome } from "./portfolio-theme";
import { splitBullets } from "./work-index";

/**
 * The case-study page — where a piece of work is shown in full.
 *
 * The ONE renderer, shared by the live route (app/p/[handle]/[id]) and the static
 * export (ADR 0009). Only the "back" link differs:
 *   · live app → /p/<handle>
 *   · static export (portfolio is the site root) → /
 *
 * Restyled to match the work index. It used to be dark — a hangover from the noir
 * template — so following "Read the case study" from a light page dropped the reader
 * into a black one, which read as landing on somebody else's site. Same ground, same
 * accent, same treatment of figures, so a click feels like going deeper rather than
 * going elsewhere.
 */
const SECTION_LABEL: Record<string, string> = {
  project: "Project",
  experience: "Experience",
  education: "Education",
  certification: "Certification",
  skill: "Skill",
  hobby: "Interest",
  custom: "More",
};

export function CaseStudyTemplate({
  site,
  item,
  backHref,
}: {
  site: PortfolioSiteView;
  item: PortfolioItemView;
  /** Where "back to portfolio" points. The single seam between live and static builds. */
  backHref: string;
}) {
  const sectionLabel = SECTION_LABEL[item.section] ?? "Project";
  const meta = [item.subtitle, item.location, item.dateRange].filter(Boolean).join(" · ");
  const media = [item.imageUrl, ...item.gallery].filter((m): m is string => !!m);
  const external = !!item.url && /^https?:\/\//.test(item.url);
  const { figures, notes } = splitBullets(item.bullets ?? []);

  return (
    <main
      className="min-h-screen bg-[var(--pf-bg)] font-sans text-[var(--pf-ink)] antialiased"
    >
      <PortfolioChrome />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link
          href={backHref}
          className="font-mono text-[12px] text-[var(--pf-ink-3)] transition-colors hover:text-[var(--pf-ink)]"
        >
          ← Back to portfolio
        </Link>

        <header className="mt-7 border-b border-[var(--pf-line)] pb-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--pf-accent)]">
            {sectionLabel}
            {item.tag ? ` · ${item.tag}` : ""}
          </span>
          <h1 className="mt-3 text-balance text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            {item.title}
          </h1>
          {meta ? <p className="mt-3 text-[14px] text-[var(--pf-ink-3)]">{meta}</p> : null}
          {item.description ? (
            <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--pf-ink-2)]">
              {item.description}
            </p>
          ) : null}

          {/* Measurements lead, exactly as they do on the index — a number a reader
              can check is worth more than the paragraph around it. */}
          {figures.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-7">
              {figures.map((f) => (
                <Figure key={f} text={f} />
              ))}
            </div>
          ) : null}

          {external ? (
            <div className="mt-6">
              <a
                href={item.url!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--pf-ink)] px-4 py-2 text-[14px] font-medium text-[var(--pf-invert)]"
              >
                View the source ↗
              </a>
            </div>
          ) : null}
        </header>

        {notes.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--pf-ink-3)]">
              What it involved
            </h2>
            <ul className="mt-4 grid gap-2.5">
              {notes.map((b) => (
                <li key={b} className="flex gap-3 text-[16px] leading-relaxed text-[var(--pf-ink-2)]">
                  <span aria-hidden="true" className="text-[var(--pf-accent)]">
                    —
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {media.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--pf-ink-3)]">
              The artefact
            </h2>
            <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)]">
              <GalleryLightbox media={media} />
              <img src={media[0]} alt="" className="w-full object-cover" />
            </div>
            {media.length > 1 ? (
              <p className="mt-2 font-mono text-[11.5px] text-[var(--pf-ink-3)]">
                {media.length} items — click to browse
              </p>
            ) : null}
          </section>
        ) : (
          // The same honesty as the index: an empty case says so.
          <section className="mt-10 rounded-lg border border-dashed border-[var(--pf-gap)]/50 bg-[var(--pf-gap-soft)] p-4">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--pf-gap)]">
              No artefact yet
            </span>
            <p className="m-0 text-[14px] text-[var(--pf-ink-2)]">
              This case has nothing to show yet — a screenshot, a diagram or a repo would make it
              evidence rather than a description.
            </p>
          </section>
        )}

        <footer className="mt-14 border-t border-[var(--pf-line)] pt-6 text-[13px] text-[var(--pf-ink-3)]">
          <Link href={backHref} className="transition-colors hover:text-[var(--pf-ink)]">
            ← Back to {(site.profile as { name?: string })?.name || site.title}
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Splits "100% block rate on SQLi / XSS" into the number and what it measures. */
function Figure({ text }: { text: string }) {
  const match = text.match(/^([<>~]?\s?[\d.,]+\s?[%a-zA-Z]*)\s*(.*)$/);
  const value = match?.[1]?.trim() ?? text;
  const label = match?.[2]?.trim() ?? "";
  return (
    <div>
      <div className="font-mono text-[27px] font-semibold leading-none tabular-nums text-[var(--pf-accent)]">
        {value}
      </div>
      {label ? <div className="mt-1.5 max-w-[22ch] text-[12.5px] text-[var(--pf-ink-3)]">{label}</div> : null}
    </div>
  );
}
