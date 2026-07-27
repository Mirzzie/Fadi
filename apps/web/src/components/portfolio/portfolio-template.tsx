import Link from "next/link";

import { accentFor } from "@/lib/portfolio/themes";
import type { PortfolioItemView, PortfolioView } from "@/lib/portfolio/view";
import { GalleryLightbox } from "@/components/portfolio/gallery-lightbox";
import { Reveal } from "@/components/portfolio/reveal";
import { Cursor, Marquee, PortfolioBackground, WordRise } from "@/components/portfolio/site-chrome";
import { WelcomeGate } from "@/components/portfolio/welcome-gate";
import { TuneTheStory } from "@/components/portfolio/tune-the-story";
import { ResumeButton } from "@/components/portfolio/resume-button";

/**
 * The portfolio template — the ONE renderer for a published portfolio.
 *
 * Extracted from app/p/[handle]/page.tsx so the exact same output can be produced by
 * BOTH the live dynamic route (data from the DB) and the static-export build (data baked
 * in at build time) — ADR 0009. The only thing that differs between the two is where a
 * case-study link points, so that is the single injected seam: `itemHref(id)`.
 *   · live app  → `/p/<handle>/<id>`
 *   · static export (portfolio IS the site root) → `/<id>`
 *
 * Server component that composes the client (framer-motion) pieces; no server-only
 * imports, so it is safe to render in a static export.
 */
const GOLD = "text-[var(--pf-accent)]";

export function PortfolioTemplate({
  data,
  itemHref,
}: {
  data: PortfolioView;
  /** Where a case study links to. Injected so live and static builds differ only here. */
  itemHref: (id: string) => string;
}) {
  const { site, items } = data;
  const profile = site.profile as {
    name?: string;
    location?: string;
    links?: string[];
    bio?: string;
    email?: string;
  };
  const g: Record<string, PortfolioItemView[]> = {};
  for (const it of items) (g[it.section] ??= []).push(it);

  const projects = g.project ?? [];
  const featured = projects.filter((p) => p.imageUrl);
  const rows = featured.length ? projects.filter((p) => !p.imageUrl) : projects;
  const experience = g.experience ?? [];
  const education = g.education ?? [];
  const skills = g.skill ?? [];
  const certs = g.certification ?? [];
  const extras = [...(g.hobby ?? []), ...(g.custom ?? [])];
  const pills = skills.slice(0, 12).map((s) => s.title);
  const interests = [...new Set(items.flatMap((i) => i.roles))].filter(Boolean);
  const email = profile.email?.trim();
  const contactHref: string | null = email
    ? `mailto:${email}`
    : ((profile.links ?? []).find((l) => l.trim()) ?? null);

  return (
    <main
      style={{ "--pf-accent": accentFor(site.template) } as React.CSSProperties}
      className="relative min-h-screen overflow-x-hidden text-zinc-100 antialiased selection:bg-[color-mix(in_srgb,var(--pf-accent)_30%,transparent)]"
    >
      <PortfolioBackground template={site.template} />
      <Cursor />
      <WelcomeGate interests={interests} />

      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0b]/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <a href="#top" className="flex items-center gap-2 font-medium tracking-tight" data-cursor>
            <span className={GOLD}>◆</span> {profile.name || site.title}
          </a>
          <div className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">
            <a href="#work" className="hover:text-[var(--pf-accent)]" data-cursor>
              Work
            </a>
            <a href="#path" className="hover:text-[var(--pf-accent)]" data-cursor>
              Path
            </a>
            <a
              href={contactHref ?? "#contact"}
              className="rounded-full bg-[var(--pf-accent)] px-4 py-1.5 font-medium text-black hover:bg-[color-mix(in_srgb,var(--pf-accent)_90%,transparent)]"
              data-cursor
            >
              Get in touch
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <span id="top" />

      <section className="mx-auto flex min-h-[90vh] w-full max-w-6xl flex-col justify-center px-6 py-24 md:px-10">
        <Reveal>
          <p className={`mb-6 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] ${GOLD}`}>
            <span className="h-px w-10 bg-[color-mix(in_srgb,var(--pf-accent)_60%,transparent)]" />
            {site.headline || "Hey there — welcome"}
          </p>
          <h1 className="text-[11vw] font-medium leading-[0.95] tracking-tight sm:text-[9vw] lg:text-[7rem]">
            <WordRise text={profile.name ? `Hi, I'm ${profile.name}.` : site.title} delay={0.1} />
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
            {profile.bio ||
              site.headline ||
              "Thanks for stopping by — take a look around at what I've been building."}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ResumeButton resumeLinks={site.resumeLinks} variant="solid" />
            <a
              href={contactHref ?? "#contact"}
              data-cursor
              className="group inline-flex items-center gap-2 rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-[var(--pf-accent)] hover:text-[var(--pf-accent)]"
            >
              Get in touch ↗
            </a>
            <a
              href="#work"
              className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-[var(--pf-accent)]"
            >
              See selected work ↓
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-[var(--pf-accent)]" /> Open to work
            </span>
            {profile.location && <span>{profile.location}</span>}
            {(profile.links ?? []).map((l) => (
              <a key={l} href={l} target="_blank" rel="noreferrer" className="hover:text-[var(--pf-accent)]">
                {prettyLink(l)}
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Animated marquee of skills */}
      <Marquee items={pills} />

      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        {interests.length > 0 && (
          <Section id="focus" index="01" title="Tune the story">
            <p className="max-w-xl text-zinc-400">
              Tell me what you&apos;re here for and the work reorders around it — the projects lead
              with what matters to you.
            </p>
            <TuneTheStory interests={interests} />
          </Section>
        )}

        {(featured.length > 0 || rows.length > 0) && (
          <Section id="work" index="02" title="Selected work">
            {featured.length > 0 && (
              <div className="flex flex-col gap-4">
                {featured.map((p) => (
                  <div key={p.id} data-portfolio-item data-roles={p.roles.join(" ")}>
                    <FeaturedCard item={p} itemHref={itemHref} />
                  </div>
                ))}
              </div>
            )}
            {rows.length > 0 && (
              <div className="mt-4 divide-y divide-zinc-800 border-t border-zinc-800">
                {rows.map((p, i) => (
                  <div key={p.id} data-portfolio-item data-roles={p.roles.join(" ")}>
                    <WorkRow item={p} n={i + 1} itemHref={itemHref} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {(experience.length > 0 || education.length > 0) && (
          <Section id="path" index="03" title="Career & study">
            <div className="grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
              {experience.length > 0 && (
                <div>
                  <h3 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Experience
                  </h3>
                  <div className="space-y-6">
                    {experience.map((e) => (
                      <TimelineRow key={e.id} item={e} />
                    ))}
                  </div>
                </div>
              )}
              {education.length > 0 && (
                <div>
                  <h3 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Education
                  </h3>
                  <div className="space-y-6">
                    {education.map((e) => (
                      <TimelineRow key={e.id} item={e} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {skills.length > 0 && (
          <Section id="skills" index="04" title="Skills & tools">
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
                >
                  {s.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {certs.length > 0 && (
          <Section id="certs" index="05" title="Certifications">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {certs.map((c) => (
                <a
                  key={c.id}
                  href={c.url || undefined}
                  target={c.url ? "_blank" : undefined}
                  rel="noreferrer"
                  className={`rounded-md border border-zinc-800 bg-zinc-900/40 p-5 transition-colors ${
                    c.url ? "hover:border-[var(--pf-accent)]" : ""
                  }`}
                >
                  <p className="font-medium">{c.title}</p>
                  {c.subtitle && <p className="mt-1 text-sm text-zinc-400">{c.subtitle}</p>}
                </a>
              ))}
            </div>
          </Section>
        )}

        {extras.length > 0 && (
          <Section id="more" index="06" title="More">
            <div className="divide-y divide-zinc-800 border-t border-zinc-800">
              {extras.map((e, i) => (
                <WorkRow key={e.id} item={e} n={i + 1} itemHref={itemHref} />
              ))}
            </div>
          </Section>
        )}

        <section id="contact" className="border-t border-zinc-800 py-20 md:py-28">
          <Reveal>
            <p className={`font-mono text-xs uppercase tracking-[0.3em] ${GOLD}`}>Let&apos;s talk</p>
            {contactHref ? (
              <a
                href={contactHref}
                className="mt-4 block text-4xl font-medium leading-[1.05] tracking-tight transition-colors hover:text-[var(--pf-accent)] md:text-7xl"
                data-cursor
              >
                {email ?? "Get in touch"} ↗
              </a>
            ) : (
              <p className="mt-4 block text-4xl font-medium leading-[1.05] tracking-tight md:text-7xl">
                Get in touch
              </p>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ResumeButton resumeLinks={site.resumeLinks} />
              <a
                href="#work"
                data-cursor
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-6 py-3 text-sm transition-colors hover:border-[var(--pf-accent)] hover:text-[var(--pf-accent)]"
              >
                See selected work ↓
              </a>
            </div>
          </Reveal>
        </section>
      </div>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 border-t border-zinc-800 px-6 py-8 text-xs uppercase tracking-[0.25em] text-zinc-500 md:flex-row md:items-center md:px-10">
        <span>
          © {new Date().getFullYear()} {profile.name || site.title}
        </span>
        <span>Powered by Fadi</span>
      </footer>
    </main>
  );
}

function prettyLink(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-zinc-800 py-16 md:py-24">
      <Reveal>
        <div className="mb-10 flex items-baseline gap-4">
          <span className={`font-mono text-xs ${GOLD}`}>{index}</span>
          <h2 className="text-3xl font-medium tracking-tight md:text-5xl">{title}</h2>
        </div>
        {children}
      </Reveal>
    </section>
  );
}

function FeaturedCard({
  item,
  itemHref,
}: {
  item: PortfolioItemView;
  itemHref: (id: string) => string;
}) {
  const meta = [item.subtitle, item.location, item.dateRange].filter(Boolean).join(" · ");
  const media = [item.imageUrl, ...item.gallery].filter((m): m is string => !!m);
  const card = (
    <div className="group grid grid-cols-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-[color-mix(in_srgb,var(--pf-accent)_60%,transparent)] md:grid-cols-5">
      <div className="relative min-h-[200px] overflow-hidden md:col-span-2">
        <GalleryLightbox media={media} />
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[color-mix(in_srgb,var(--pf-accent)_25%,transparent)] via-[color-mix(in_srgb,var(--pf-accent)_5%,transparent)] to-transparent" />
        )}
      </div>
      <div className="flex flex-col justify-between p-6 md:col-span-3 md:p-8">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className={`font-mono text-xs ${GOLD}`}>Featured{item.tag ? ` · ${item.tag}` : ""}</span>
          </div>
          <p className="mt-4 text-2xl font-medium leading-tight md:text-3xl">{item.title}</p>
          {meta && <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">{meta}</p>}
          {item.description && <p className="mt-4 text-sm text-zinc-400">{item.description}</p>}
          {item.bullets.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              {item.bullets.slice(0, 3).map((b, i) => (
                <li key={i}>· {b}</li>
              ))}
            </ul>
          )}
        </div>
        <span className={`mt-6 inline-flex items-center gap-2 text-sm ${GOLD}`}>
          View case study →
        </span>
      </div>
    </div>
  );
  return (
    <Link href={itemHref(item.id)} data-cursor>
      {card}
    </Link>
  );
}

function WorkRow({
  item,
  n,
  itemHref,
}: {
  item: PortfolioItemView;
  n: number;
  itemHref: (id: string) => string;
}) {
  const meta = [item.subtitle, item.location, item.dateRange].filter(Boolean).join(" · ");
  const row = (
    <div className="group flex items-center gap-6 py-6">
      <span className={`font-mono text-xs ${GOLD}`}>{String(n).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl transition-colors group-hover:text-[var(--pf-accent)] md:text-3xl">
          {item.title}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {meta}
          {item.tag && <span className="ml-2 text-[color-mix(in_srgb,var(--pf-accent)_70%,transparent)]">/ {item.tag}</span>}
        </p>
      </div>
      <span className="text-[var(--pf-accent)] opacity-0 transition-opacity group-hover:opacity-100">↗</span>
    </div>
  );
  return (
    <Link href={itemHref(item.id)} data-cursor>
      {row}
    </Link>
  );
}

function TimelineRow({ item }: { item: PortfolioItemView }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg">{item.title}</p>
        {item.dateRange && (
          <span className="text-xs uppercase tracking-wider text-zinc-500">{item.dateRange}</span>
        )}
      </div>
      {(item.subtitle || item.location) && (
        <p className="text-sm text-zinc-400">{[item.subtitle, item.location].filter(Boolean).join(" · ")}</p>
      )}
      {item.description && <p className="mt-2 text-sm text-zinc-500">{item.description}</p>}
    </div>
  );
}
