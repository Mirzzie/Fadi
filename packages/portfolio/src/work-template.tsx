import type { PortfolioItemView, PortfolioView } from "./view";
import { MediaViewer } from "./media-viewer";
import { PortfolioAnalytics } from "./analytics-client";
import { PortfolioChrome } from "./portfolio-theme";
import { ResumeButton } from "./resume-button";
import { FeedbackForm } from "./feedback-form";
import { SkillFilter } from "./skill-filter";
import {
  caseSkills,
  hasArtifact,
  pickLead,
  rankCases,
  skillIndex,
  slugify,
  labelsFor,
  latestYear,
  splitBullets,
} from "./work-index";
import type { PageLabels } from "./work-index";

/**
 * THE WORK INDEX — a portfolio that is not a résumé.
 *
 * The template this replaces was a CV with better typography: sections, entries,
 * dates, bullets. If a recruiter already has the CV attached to the application,
 * a page repeating it in a nicer font tells them nothing new. So the unit here is a
 * CASE — a piece of work with the artefact attached — and the page is organised
 * around evidence rather than employment history.
 *
 * Four decisions carry the whole design:
 *
 *   1. IT INTRODUCES THE PERSON, THEN PROVES THEM. The page states who you are and
 *      what position you hold, then immediately shows the strongest-evidenced piece
 *      of work. (An earlier version buried the name in the corner and led with a
 *      project — a designer's instinct, not a reader's. Someone landing here needs to
 *      know what you ARE before they can judge what you made.)
 *
 *   2. SKILLS ARE AN INDEX INTO THE PROOF. Click one and the page filters to the
 *      work that demonstrates it. A skill nothing backs is never listed at all —
 *      listing it would be exactly the unbacked claim this platform refuses to make.
 *
 *   3. MISSING PROOF IS SHOWN, NOT PADDED — but only for career work. A project
 *      with no image, gallery or link gets a labelled gap; a hobby without a
 *      screenshot gets nothing, because it isn't a failing. Padding a real gap with
 *      confident prose is how a portfolio quietly turns back into a résumé; nagging
 *      about someone's hobbies is how it turns into an audit.
 *
 *   4. IT IS NOT A JOB APPLICATION. Career, passion and hobbies all belong here —
 *      "Outside the job" catches whatever the owner adds later without a code change.
 *      The CV is one link among the contact details, not the point of the page.
 *
 * EMPHASIS IS RATIONED. Only measurements and evidence links carry the accent; the
 * reader chooses what to look at via the skill filter and the visitor lens. A page
 * that shouts at every element has no hierarchy left when something actually matters.
 *
 * NOTHING IS HARDCODED — the owner will keep adding work. The lead is picked, the
 * skills are derived, empty sections vanish, and the ordering is by evidence. Adding
 * a project should never mean editing this file. See `work-index.ts` for that logic.
 *
 * Colours are explicit rather than themed: this renders both inside Fadi (whose
 * <html> is always `dark`) and as a standalone static export, and it must look the
 * same in both.
 */
export function WorkTemplate({
  data,
  itemHref,
  analyticsBase,
}: {
  data: PortfolioView;
  itemHref: (id: string) => string;
  analyticsBase?: string | null;
}) {
  const { site, items } = data;
  const profile = site.profile as {
    name?: string;
    location?: string;
    links?: string[];
    bio?: string;
    email?: string;
    /** Calendly (or any booking page). A reader who wants to talk should not have to
     *  compose an email and wait — the strongest call to action a portfolio has is a
     *  time they can just take. */
    bookingUrl?: string;
  };

  const cases = rankCases(items);
  const lead = pickLead(items);
  const rest = cases.filter((c) => c.id !== lead?.id);
  const skills = skillIndex(items);
  const experience = items.filter((i) => i.section === "experience");
  // Education and certifications are NOT the same class of thing. Rendering a degree
  // in the same list as a one-afternoon job simulation flattens the difference and
  // makes the degree look like a badge — and with a two-column grid in DOM order, the
  // left column read Triplebyte → AWS → Mastercard → BCA, which is no order at all.
  // Split, labelled, and each sorted newest first so the strongest leads.
  const byRecency = (a: PortfolioItemView, b: PortfolioItemView) =>
    latestYear(b.dateRange ?? b.subtitle) - latestYear(a.dateRange ?? a.subtitle);
  const education = items.filter((i) => i.section === "education").sort(byRecency);
  const certifications = items.filter((i) => i.section === "certification").sort(byRecency);
  // Everything that isn't career evidence or a credential. This page is not a job
  // application: it is what the owner does — career, passion AND hobbies — so the
  // sections they invent later (hardware tinkering, music, whatever) land here
  // automatically instead of needing a code change.
  const beyond = items.filter((i) => i.section === "hobby" || i.section === "interest");

  const name = profile.name || site.title;
  const email = profile.email?.trim();
  const links = (profile.links ?? []).filter((l) => l.trim());
  const hasResume = Object.values(site.resumeLinks ?? {}).some((v) => v?.trim());
  const booking = profile.bookingUrl?.trim();
  // Every heading below is the owner's to change (Settings → Page wording).
  const L = labelsFor(site.theme);

  return (
    <main
      data-pf-template="work"
      className="min-h-screen bg-[var(--pf-bg)] font-sans text-[var(--pf-ink)]"
    >
      <PortfolioChrome />
      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-16 sm:px-6">
        {/* WHO I AM — stated plainly, before anything else.
            An earlier version put the name in the corner and led with a project. That was
            a designer's instinct, not a reader's: someone landing here needs to know what
            you ARE before they can judge what you've made. Position first, then proof. */}
        <header className="border-b border-[var(--pf-line)] py-12 md:py-16">
          <h1 className="text-[clamp(34px,5.4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.032em]">
            {name}
          </h1>
          {site.headline ? (
            <p className="mt-2.5 text-[clamp(17px,2.2vw,22px)] font-medium text-[var(--pf-accent)]">
              {site.headline}
            </p>
          ) : null}
          {profile.bio ? (
            <p className="mt-5 max-w-[56ch] whitespace-pre-line text-[17px] leading-relaxed text-[var(--pf-ink-2)]">
              {profile.bio}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[14px]">
            {profile.location ? <span className="text-[var(--pf-ink-3)]">{profile.location}</span> : null}
            {email ? (
              <a href={`mailto:${email}`} className="text-[var(--pf-accent)] underline underline-offset-4">
                {email}
              </a>
            ) : null}
            {links.map((l) => (
              <a
                key={l}
                href={l}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--pf-ink-2)] underline decoration-[var(--pf-line)] underline-offset-4 hover:decoration-[var(--pf-ink)]"
              >
                {prettyLink(l)}
              </a>
            ))}
            {hasResume ? (
              <span className="print:hidden">
                <ResumeButton resumeLinks={site.resumeLinks ?? {}} />
              </span>
            ) : null}
            {booking ? (
              <a
                href={booking}
                target="_blank"
                rel="noreferrer"
                data-pf-booking
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-[var(--pf-accent)] px-3.5 text-[14px] font-medium text-[var(--pf-invert)] transition-opacity hover:opacity-90 print:hidden"
              >
                {L.bookingCta}
              </a>
            ) : email ? (
              <a
                href="#contact"
                className="inline-flex min-h-[36px] items-center rounded-lg border border-[var(--pf-line)] px-3.5 text-[14px] font-medium text-[var(--pf-ink-2)] transition-colors hover:border-[var(--pf-accent)] hover:text-[var(--pf-ink)] print:hidden"
              >
                {L.contactCta}
              </a>
            ) : null}
          </div>
        </header>

        {/* WHAT I'VE DONE — the strongest-evidenced piece, chosen not named. */}
        {lead ? (
          <section className="py-10">
            <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--pf-ink-3)]">
              {L.featured}
            </h2>
            <Lead item={lead} href={itemHref(lead.id)} labels={L} />
          </section>
        ) : null}

        {/* Skills, but only the ones the work backs. */}
        {skills.length > 0 ? (
          <section className="border-y border-[var(--pf-line)] py-6 print:hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-tight">
                {L.skills}
              </h2>
              <p className="text-[14px] text-[var(--pf-ink-3)]">{L.skillsHint}</p>
            </div>
            <div className="mt-3">
              <SkillFilter skills={skills} />
            </div>
          </section>
        ) : null}

        {/* Every other case, best evidenced first. */}
        {rest.length > 0 ? (
          <section className="grid gap-4 py-10">
            {rest.map((c) => (
              <Case key={c.id} item={c} href={itemHref(c.id)} labels={L} />
            ))}
          </section>
        ) : null}

        {experience.length > 0 ? (
          <section className="border-t border-[var(--pf-line)] py-10">
            <h2 className="text-[15px] font-bold tracking-tight">{L.history}</h2>
            <p className="mb-4 mt-1 text-[14px] text-[var(--pf-ink-3)]">
              {L.historyHint}
            </p>
            <div className="grid items-stretch border-t-2 border-[var(--pf-ink)] divide-y divide-[var(--pf-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {experience.map((e) => (
                <div
                  key={e.id}
                  data-portfolio-item
                  data-roles={e.roles.join(" ")}
                  className="px-0 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0"
                >
                  {e.dateRange ? (
                    <div className="font-mono text-[12px] tabular-nums text-[var(--pf-accent)]">
                      {e.dateRange}
                    </div>
                  ) : null}
                  <h3 className="mt-1.5 text-[16px] font-semibold">{e.title}</h3>
                  <p className="text-[14px] text-[var(--pf-ink-3)]">
                    {[e.subtitle, e.description].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {education.length > 0 || certifications.length > 0 ? (
          <section className="border-t border-[var(--pf-line)] py-10">
            <div className="grid gap-10 md:grid-cols-2">
              {education.length > 0 ? (
                <div>
                  <h2 className="text-[15px] font-bold tracking-tight">{L.education}</h2>
                  <ul className="mt-4 grid gap-3.5">
                    {education.map((c) => (
                      <li key={c.id} data-portfolio-item data-roles={c.roles.join(" ")}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="text-[16px] font-semibold">
                            <Credential item={c} />
                          </span>
                          {c.dateRange ? (
                            <span className="font-mono text-[12px] tabular-nums text-[var(--pf-ink-3)]">
                              {c.dateRange}
                            </span>
                          ) : null}
                        </div>
                        {c.subtitle ? (
                          <p className="text-[14px] text-[var(--pf-ink-3)]">{c.subtitle}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {certifications.length > 0 ? (
                <div>
                  <h2 className="text-[15px] font-bold tracking-tight">{L.certifications}</h2>
                  {/* One column: these are short lines, and a two-column grid made the
                      reading order zigzag between unrelated entries. */}
                  <ul className="mt-4 grid gap-2.5">
                    {certifications.map((c) => (
                      <li
                        key={c.id}
                        data-portfolio-item
                        data-roles={c.roles.join(" ")}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[var(--pf-line)] pb-2"
                      >
                        <span className="text-[15px]">
                          <Credential item={c} />
                          {c.subtitle ? (
                            <span className="text-[var(--pf-ink-3)]"> · {c.subtitle}</span>
                          ) : null}
                        </span>
                        {c.dateRange ? (
                          <span className="font-mono text-[12px] tabular-nums text-[var(--pf-ink-3)]">
                            {c.dateRange}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {beyond.length > 0 ? (
          <section className="border-t border-[var(--pf-line)] py-10">
            <h2 className="text-[15px] font-bold tracking-tight">{L.beyond}</h2>
            <p className="mb-5 mt-1 text-[14px] text-[var(--pf-ink-3)]">{L.beyondHint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {beyond.map((h) => (
                <div
                  key={h.id}
                  data-portfolio-item
                  data-roles={h.roles.join(" ")}
                  className="rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-4"
                >
                  <h3 className="text-[16px] font-semibold">{h.title}</h3>
                  {h.description ? (
                    <p className="mt-1 text-[15px] text-[var(--pf-ink-2)]">{h.description}</p>
                  ) : null}
                  {h.url && /^https?:\/\//i.test(h.url) ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[14px] text-[var(--pf-accent)] underline underline-offset-4"
                    >
                      {sourceLabel(h.url)} ↗
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Contact and the note form share one section, side by side.
            Separately they left a wide empty column on the right and read as two
            stray blocks; together they answer one question — "how do I reach him?" */}
        <section
          id="contact"
          className="scroll-mt-6 grid gap-10 border-t border-[var(--pf-line)] py-10 md:grid-cols-[minmax(0,1fr)_260px]"
        >
          <div className="print:hidden">
            <h2 className="text-[15px] font-bold tracking-tight">{L.note}</h2>
            <p className="mb-4 mt-1 max-w-[58ch] text-[15px] text-[var(--pf-ink-2)]">
              {L.noteHint}
            </p>
            <FeedbackForm handle={site.handle} base={analyticsBase} email={email ?? null} />
          </div>

          <div>
            <h2 className="text-[15px] font-bold tracking-tight">{L.contact}</h2>
            <div className="mt-3 flex flex-col gap-2.5 text-[15px]">
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="font-medium text-[var(--pf-accent)] underline underline-offset-4"
                >
                  {email}
                </a>
              ) : null}
              {links.map((l) => (
                <a
                  key={l}
                  href={l}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--pf-ink-2)] underline decoration-[var(--pf-line)] underline-offset-4 hover:text-[var(--pf-ink)]"
                >
                  {prettyLink(l)}
                </a>
              ))}
              {booking ? (
                <a
                  href={booking}
                  target="_blank"
                  rel="noreferrer"
                  data-pf-booking
                  className="font-medium text-[var(--pf-accent)] underline underline-offset-4"
                >
                  Book a 30-minute call ↗
                </a>
              ) : null}
              {profile.location ? (
                <span className="text-[14px] text-[var(--pf-ink-3)]">{profile.location}</span>
              ) : null}
            </div>
          </div>
        </section>

        <footer className="border-t border-[var(--pf-line)] py-6 text-[14px] text-[var(--pf-ink-3)]">
          {name}
          {profile.location ? ` · ${profile.location}` : ""}
        </footer>
      </div>

      <PortfolioAnalytics handle={site.handle} base={analyticsBase} />
    </main>
  );
}

function Lead({ item, href, labels }: { item: PortfolioItemView; href: string; labels: PageLabels }) {
  const { figures } = splitBullets(item.bullets ?? []);
  const leadMedia = [item.imageUrl, ...(item.gallery ?? [])].filter((m): m is string => !!m);
  return (
    <section
      data-case
      data-portfolio-item
      data-roles={item.roles.join(" ")}
      data-skills={caseSkills(item).map(slugify).join(" ")}
      className="grid items-start gap-8 py-2 md:grid-cols-[1.05fr_.95fr] md:gap-10"
    >
      <div>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--pf-accent)]">
          <span className="size-1.5 rounded-full bg-[var(--pf-accent)]" aria-hidden="true" />
          {item.subtitle || "Selected work"}
        </span>
        <h3 className="mt-3 text-balance text-[clamp(26px,3.6vw,38px)] font-extrabold leading-[1.05] tracking-[-0.028em]">
          {item.title}
        </h3>
        {item.description ? (
          <p className="mt-4 max-w-[46ch] text-[17px] text-[var(--pf-ink-2)]">{item.description}</p>
        ) : null}
        {figures.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-7">
            {figures.slice(0, 3).map((f) => (
              <Figure key={f} text={f} />
            ))}
          </div>
        ) : null}
        <Actions caseHref={href} url={item.url} primaryLabel={labels.caseCta} />
      </div>

      {leadMedia.length > 0 ? (
        <MediaViewer
          media={leadMedia}
          caption={[item.tag, item.dateRange].filter(Boolean).join(" · ") || item.title}
        />
      ) : null}
    </section>
  );
}

function Case({ item, href, labels }: { item: PortfolioItemView; href: string; labels: PageLabels }) {
  const { figures, notes } = splitBullets(item.bullets ?? []);
  const proven = hasArtifact(item);
  // Only career work is held to the evidence standard. A hobby or a side interest
  // without a screenshot isn't a gap — it's a hobby. Nagging about it would turn the
  // page back into an audit of the reader's own life.
  const expectsProof = item.section === "project";
  const media = [item.imageUrl, ...(item.gallery ?? [])].filter((m): m is string => !!m);

  return (
    <article
      data-case
      data-portfolio-item
      data-roles={item.roles.join(" ")}
      data-skills={caseSkills(item).map(slugify).join(" ")}
      className={`grid overflow-hidden rounded-xl border bg-[var(--pf-surface)] ${
        media.length > 0 ? "md:grid-cols-[300px_1fr]" : ""
      } ${proven ? "border-[var(--pf-line)]" : "border-dashed border-[var(--pf-line)]"}`}
    >
      {media.length > 0 ? (
        <div className="border-b border-[var(--pf-line)] p-3 md:border-b-0 md:border-r">
          <MediaViewer media={media} caption={item.title} className="h-full" />
        </div>
      ) : null}

      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[20px] font-bold tracking-[-0.018em]">{item.title}</h3>
          {item.dateRange || item.subtitle ? (
            <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-[var(--pf-ink-3)]">
              {item.dateRange || item.subtitle}
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="mt-2.5 max-w-[58ch] text-[16px] leading-relaxed text-[var(--pf-ink-2)]">{item.description}</p>
        ) : null}

        {notes.length > 0 ? (
          <ul className="mt-2.5 grid gap-1.5">
            {notes.map((n) => (
              <li key={n} className="flex gap-2.5 text-[16px] leading-relaxed text-[var(--pf-ink-2)]">
                <span aria-hidden="true" className="text-[var(--pf-accent)]">
                  —
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {figures.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {figures.map((f) => (
              <span
                key={f}
                className="rounded border border-[var(--pf-accent)]/25 bg-[var(--pf-accent-soft)] px-2.5 py-1 font-mono text-[12px] tabular-nums text-[var(--pf-accent)]"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}

        {proven ? <Actions caseHref={href} url={item.url} primaryLabel={labels.detailCta} /> : null}

        {/* The honest gap. This is the design doing its job — a case with nothing to
            show says so, instead of being padded with prose until it reads like a CV. */}
        {!proven && expectsProof ? (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--pf-gap)]/50 bg-[var(--pf-gap-soft)] p-3.5">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--pf-gap)]">
              {labels.gap}
            </span>
            <p className="m-0 text-[15px] text-[var(--pf-ink-2)]">
              A screenshot, a diagram, a repo or a short write-up would turn this from a claim into
              evidence.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The actions on a piece of work.
 *
 * Was a row of 22px mono chips: too small to hit on a phone, and labelled with the
 * bare hostname ("lnkd.in"), which tells a reader nothing about what they'd be
 * opening. Real buttons now, with a label that says what the link IS, and a minimum
 * height that a thumb can actually land on.
 *
 * Only absolute http(s) links are offered — a stored relative path like
 * "/case-study/x" is an internal reference, and rendering it as an outbound link
 * produced a dead end on the published site.
 */
function Actions({
  caseHref,
  url,
  primaryLabel,
}: {
  caseHref: string;
  url?: string | null;
  primaryLabel: string;
}) {
  const external = url && /^https?:\/\//i.test(url) ? url : null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      <a
        href={caseHref}
        className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[var(--pf-accent)] px-4 text-[14px] font-medium text-[var(--pf-invert)] transition-opacity hover:opacity-90"
      >
        {primaryLabel}
        <span aria-hidden="true">→</span>
      </a>
      {external ? (
        <a
          href={external}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[var(--pf-line)] px-4 text-[14px] font-medium text-[var(--pf-ink-2)] transition-colors hover:border-[var(--pf-accent)] hover:text-[var(--pf-ink)]"
        >
          {sourceLabel(external)}
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </div>
  );
}

/** Say what the link is, not where it points. */
function sourceLabel(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (/github\.com|gitlab\.com|bitbucket/.test(host)) return "View the code";
  if (/youtube|youtu\.be|vimeo/.test(host)) return "Watch the demo";
  if (/linkedin|lnkd\.in|medium|dev\.to|substack|notion/.test(host)) return "Read the write-up";
  return `Open ${host || "the source"}`;
}

/** A credential, linked to its verification page when there is one. */
function Credential({ item }: { item: PortfolioItemView }) {
  if (item.url && /^https?:\/\//i.test(item.url)) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-[var(--pf-line)] underline-offset-4 hover:decoration-[var(--pf-ink)]"
      >
        {item.title}
      </a>
    );
  }
  return <>{item.title}</>;
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
      {label ? <div className="mt-1.5 max-w-[20ch] text-[12.5px] text-[var(--pf-ink-3)]">{label}</div> : null}
    </div>
  );
}

function prettyLink(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^\//, "");
  }
}
