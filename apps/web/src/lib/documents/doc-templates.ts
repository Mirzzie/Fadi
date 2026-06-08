import type { DocKind } from "@/lib/jobs/application-types";

/**
 * Built-in starter templates for prose documents — proven, recruiter-grounded
 * structures with [PLACEHOLDERS] so the user starts from a strong skeleton
 * instead of a blank page (less effort, more quality, less time). Kept within
 * the length targets in doc-guidance.ts. These are CONTENT scaffolds (resume
 * templates are style presets — different thing).
 */
export type DocTemplate = {
  id: string;
  name: string;
  description: string;
  content: string;
};

export const DOC_TEMPLATES: Partial<Record<DocKind, DocTemplate[]>> = {
  cover_letter: [
    {
      id: "cl-standard",
      name: "Standard (4 paragraphs)",
      description: "Hook → fit → proof → close. The reliable default.",
      content: `Dear [Hiring Manager],

I'm applying for the [Role] role at [Company]. [Open with a specific, real result — e.g. "After cutting onboarding drop-off 18% at [Past Company], I'm looking to do the same here."]

Over [X years] in [field], I've [your most relevant achievement, with a number]. That maps directly to what this role needs: [name 1–2 real requirements from the job post that you genuinely meet].

[One concrete proof point — a project, a metric, an outcome only you can claim.]

I'd welcome the chance to discuss how I can help [Company] [specific goal]. Thank you for your time.

Best,
[Your name]`,
    },
    {
      id: "cl-referral",
      name: "Referral",
      description: "Lead with a mutual connection.",
      content: `Dear [Hiring Manager],

[Referrer name] suggested I reach out about the [Role] role — we [how you know each other] at [context].

[Why you're a strong fit, anchored in one real result.] [A second proof point that maps to the role.]

I'd love to talk about how I can contribute to [Company]'s [specific goal]. Thanks for considering my application.

Best,
[Your name]`,
    },
    {
      id: "cl-career-changer",
      name: "Career changer",
      description: "Frame the pivot around transferable, proven results.",
      content: `Dear [Hiring Manager],

I'm moving into [target field] from [current field], and the [Role] role at [Company] is exactly the bridge I'm after. [The transferable result that proves you can do this work.]

The overlap is real: [skill/result from your background] is the same muscle this role needs for [specific requirement]. [One more concrete proof point.]

I'd welcome a conversation about the value I can bring. Thank you for your time.

Best,
[Your name]`,
    },
  ],
  email: [
    {
      id: "em-recruiter",
      name: "Recruiter intro",
      description: "Short, specific, one clear ask.",
      content: `Subject: [Role] — [Your name]

Hi [Name],

I saw [Company] is hiring for [Role]. In my last role I [one concrete result], which lines up with [specific need from the post].

Would a quick 15-minute call this week make sense?

Thanks,
[Your name]`,
    },
    {
      id: "em-hiring-manager",
      name: "Hiring manager (direct)",
      description: "Personalized outreach straight to the decision-maker.",
      content: `Subject: [Concrete result] for [Company]'s [team/goal]

Hi [Name],

I've followed [something specific — a product, a recent launch, a value]. I [one real, quantified result] and think I could help [Company] with [specific challenge].

Open to a 15-minute chat to see if there's a fit?

Best,
[Your name]`,
    },
    {
      id: "em-referral-ask",
      name: "Referral ask",
      description: "Ask a contact to refer or connect you.",
      content: `Subject: Quick favor re: [Company]

Hi [Name],

Hope you're well! I'm applying for [Role] at [Company] and saw you're connected there. [One line on why you're a strong fit, with a result.]

Would you be comfortable referring me or pointing me to the right person? Happy to send a blurb that makes it easy.

Thanks so much,
[Your name]`,
    },
  ],
  value_proposition: [
    {
      id: "vp-future-impact",
      name: "Future-impact pitch",
      description: "What you'd fix first, backed by real numbers.",
      content: `Why me, for [Role] at [Company]

In my first 90 days I'd [the first thing you'd fix or improve], [the second], and [the third] — the problems this role exists to solve.

I've done this before: [quantified result], and [a second quantified result].

[One line on why this company specifically — a value, a product, a direction you believe in.]`,
    },
  ],
};

export function templatesForKind(kind: DocKind): DocTemplate[] {
  return DOC_TEMPLATES[kind] ?? [];
}
