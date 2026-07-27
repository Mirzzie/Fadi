import Link from "next/link";

import { accentFor } from "@/lib/portfolio/themes";
import type { PortfolioItemView, PortfolioSiteView } from "@/lib/portfolio/view";
import { GalleryLightbox } from "@/components/portfolio/gallery-lightbox";
import { Reveal } from "@/components/portfolio/reveal";
import { Cursor, PortfolioBackground } from "@/components/portfolio/site-chrome";

/**
 * The case-study (item detail) template — the ONE renderer, shared by the live route
 * (app/p/[handle]/[id]) and the static export (ADR 0009). Only the "back" link differs:
 *   · live app → /p/<handle>
 *   · static export (portfolio is the site root) → /
 */
const GOLD = "text-[var(--pf-accent)]";
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

  return (
    <main
      style={{ "--pf-accent": accentFor(site.template) } as React.CSSProperties}
      className="relative min-h-screen overflow-x-hidden text-zinc-100 antialiased selection:bg-[color-mix(in_srgb,var(--pf-accent)_30%,transparent)]"
    >
      <PortfolioBackground template={site.template} />
      <Cursor />

      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-20">
        <Link
          href={backHref}
          data-cursor
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-400 transition-colors hover:text-[var(--pf-accent)]"
        >
          ← Back to portfolio
        </Link>

        <Reveal>
          <header className="mt-8 border-b border-zinc-800 pb-10">
            <span className={`font-mono text-xs uppercase tracking-[0.3em] ${GOLD}`}>
              {sectionLabel}
              {item.tag ? ` · ${item.tag}` : ""}
            </span>
            <h1 className="mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {item.title}
            </h1>
            {meta && <p className="mt-4 text-sm uppercase tracking-[0.2em] text-zinc-500">{meta}</p>}
            {item.description && (
              <p className="mt-6 max-w-3xl text-base text-zinc-400 md:text-lg">{item.description}</p>
            )}
            {external && (
              <div className="mt-6">
                <a
                  href={item.url!}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--pf-accent)] px-5 py-2.5 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
                >
                  View source ↗
                </a>
              </div>
            )}
          </header>
        </Reveal>

        {item.bullets.length > 0 && (
          <Reveal>
            <section className="mt-12">
              <h2 className="text-2xl font-medium md:text-3xl">Highlights</h2>
              <ul className="mt-6 space-y-3">
                {item.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-200 md:text-base"
                  >
                    <span className={`font-mono text-xs ${GOLD}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}

        {media.length > 0 && (
          <Reveal>
            <section className="mt-12">
              <h2 className="text-2xl font-medium md:text-3xl">Gallery</h2>
              <div className="relative mt-6 overflow-hidden rounded-xl border border-zinc-800">
                <GalleryLightbox media={media} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media[0]} alt="" className="w-full object-cover" />
              </div>
              {media.length > 1 && (
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                  {media.length} items — click to browse
                </p>
              )}
            </section>
          </Reveal>
        )}

        <footer className="mt-16 border-t border-zinc-800 pt-6 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <Link href={backHref} className="transition-colors hover:text-[var(--pf-accent)]">
            ← Back to portfolio
          </Link>
        </footer>
      </div>
    </main>
  );
}
