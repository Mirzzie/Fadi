import type { ResumeData } from "@/lib/documents/resume";
import type { IdentityInput } from "@/lib/identity/resolve";

/**
 * Adapters into the one shape identity resolution understands.
 *
 * Kept apart from `reconcile.ts` on purpose: the comparison is pure and testable, and
 * this is where the two stores' quite different vocabularies get flattened. A résumé
 * calls it `company`, a portfolio calls it `subtitle`, and neither knows about the
 * other — the resolver should never learn either name.
 */

const text = (...parts: (string | null | undefined)[]) =>
  parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" · ") || null;

/** Résumé sections → comparable records. Skills are omitted deliberately: see below. */
export function resumeToIdentity(resume: ResumeData): IdentityInput[] {
  const out: IdentityInput[] = [];

  for (const e of resume.experiences ?? []) {
    if (!e.title?.trim() && !e.company?.trim()) continue;
    out.push({
      id: `resume:experience:${e.id}`,
      title: e.title?.trim() || e.company.trim(),
      organization: e.company?.trim() || null,
      period: e.period?.trim() || null,
      detail: text(e.bullets, e.location),
      kind: "experience",
    });
  }

  for (const p of resume.projects ?? []) {
    if (!p.title?.trim()) continue;
    out.push({
      id: `resume:project:${p.id}`,
      title: p.title.trim(),
      organization: null,
      period: null,
      detail: p.description?.trim() || null,
      url: p.url?.trim() || null,
      kind: "project",
    });
  }

  for (const e of resume.education ?? []) {
    if (!e.degree?.trim() && !e.school?.trim()) continue;
    out.push({
      id: `resume:education:${e.id}`,
      title: e.degree?.trim() || e.school.trim(),
      organization: e.school?.trim() || null,
      period: e.period?.trim() || null,
      detail: e.location?.trim() || null,
      kind: "education",
    });
  }

  for (const c of resume.certifications ?? []) {
    if (!c.name?.trim()) continue;
    out.push({
      id: `resume:certification:${c.id}`,
      title: c.name.trim(),
      organization: c.issuer?.trim() || null,
      period: c.date?.trim() || null,
      detail: null,
      kind: "certification",
    });
  }

  // Skills are NOT reconciled. A résumé skills line is a keyword list written for an
  // ATS, not a record of something that happened, and diffing it against a portfolio
  // produces dozens of findings that mean nothing. What a skill is missing is PROOF,
  // and the integrity panel already answers that question properly.
  return out;
}

type PortfolioItemLike = {
  id: string;
  section: string;
  title: string;
  subtitle?: string | null;
  dateRange?: string | null;
  description?: string | null;
  bullets?: string[] | null;
  url?: string | null;
  imageUrl?: string | null;
  gallery?: string[] | null;
  tag?: string | null;
};

/** Portfolio items → the same shape. Skills excluded to match the résumé side. */
export function portfolioToIdentity(items: PortfolioItemLike[]): IdentityInput[] {
  return items
    .filter((i) => i.section !== "skill")
    .map((i) => ({
      id: i.id,
      title: i.title,
      organization: i.subtitle?.trim() || null,
      period: i.dateRange?.trim() || null,
      detail: text(i.description, (i.bullets ?? []).join(" ")),
      url: i.url ?? null,
      imageUrl: i.imageUrl ?? null,
      gallery: i.gallery ?? [],
      tags: i.tag ? [i.tag] : [],
      kind: i.section,
    }));
}
