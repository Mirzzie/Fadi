import "server-only";

// Fadi Web Surfer — a server-side reader for the OPEN web: company career pages and ATS boards
// (Greenhouse, Lever) that no job API covers and that aren't behind a bot wall. It does NOT try
// to beat Cloudflare/LinkedIn — when it detects a wall it says so and hands off to the browser
// extension (a real human session). Doctrine: only forwards jobs actually present on the page.
//
// Reachability was verified empirically: Greenhouse/Lever JSON and JSON-LD career pages return
// 200 server-side; LinkedIn returns an authwall — hence this split.

export type SurfedJob = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  /** ISO date the posting was created/updated, when the source gives one. */
  postedAt?: string;
};

export type SurfResult =
  | { ok: true; jobs: SurfedJob[]; via: "greenhouse" | "lever" | "jsonld" | "ai" | "none" }
  | { ok: false; blocked: boolean; reason: string };

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";

// ── Wall detection ────────────────────────────────────────────────────────────
/** Does this response look like a bot wall / login gate rather than real content? */
export function looksBlocked(status: number, body: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status === 503) return true;
  const b = body.slice(0, 6000).toLowerCase();
  return (
    /just a moment|cf-browser-verification|challenge-platform|_cf_chl|captcha|access denied|are you a robot|authwall|please enable javascript to view/.test(
      b,
    )
  );
}

// ── ATS routing (no key, no wall) ─────────────────────────────────────────────
export type AtsRef = { kind: "greenhouse" | "lever"; token: string };

/** Recognise a Greenhouse / Lever board URL (or bare "greenhouse:token") → an ATS reference. */
export function detectAts(input: string): AtsRef | null {
  const s = input.trim();
  const shorthand = s.match(/^(greenhouse|lever)\s*[:/]\s*([a-z0-9-]+)$/i);
  if (shorthand) return { kind: shorthand[1].toLowerCase() as AtsRef["kind"], token: shorthand[2] };

  let u: URL;
  try {
    u = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  if (host.includes("greenhouse.io")) {
    // boards.greenhouse.io/<token>, job-boards.greenhouse.io/<token>, boards-api…/v1/boards/<token>/jobs
    const t = host.startsWith("boards-api") ? seg[seg.indexOf("boards") + 1] : seg[0];
    return t ? { kind: "greenhouse", token: t } : null;
  }
  if (host.includes("lever.co")) {
    // jobs.lever.co/<token>, api.lever.co/v0/postings/<token>
    const t = host.startsWith("api") ? seg[seg.indexOf("postings") + 1] : seg[0];
    return t ? { kind: "lever", token: t } : null;
  }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapGreenhouse(json: any, company?: string): SurfedJob[] {
  const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
  return jobs
    .map((j: any) => ({
      title: clean(j?.title),
      company,
      location: clean(j?.location?.name) || undefined,
      url: clean(j?.absolute_url) || undefined,
      description: clean(j?.content ? String(j.content).replace(/<[^>]+>/g, " ") : "").slice(0, 4000) || undefined,
      postedAt: clean(j?.updated_at) || undefined,
    }))
    .filter((j: SurfedJob) => j.title);
}

export function mapLever(json: any, company?: string): SurfedJob[] {
  const arr = Array.isArray(json) ? json : [];
  return arr
    .map((j: any) => ({
      title: clean(j?.text),
      company: company || clean(j?.categories?.team) || undefined,
      location: clean(j?.categories?.location) || undefined,
      url: clean(j?.hostedUrl) || undefined,
      description: clean(j?.descriptionPlain).slice(0, 4000) || undefined,
      postedAt: typeof j?.createdAt === "number" ? new Date(j.createdAt).toISOString() : undefined,
    }))
    .filter((j: SurfedJob) => j.title);
}

// ── JSON-LD JobPosting extraction (career pages) ──────────────────────────────
const orgName = (o: any): string => (typeof o === "string" ? o : clean(o?.name));
const locName = (o: any): string => {
  const first = Array.isArray(o) ? o[0] : o;
  const a = first?.address ?? {};
  if (typeof a === "string") return clean(a);
  return [a.addressLocality, a.addressRegion, a.addressCountry].map(clean).filter(Boolean).join(", ");
};

/** Pull schema.org JobPosting objects out of <script type="application/ld+json"> blocks. No DOM. */
export function extractJsonLdJobs(html: string): SurfedJob[] {
  const out: SurfedJob[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: any;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes: any[] = [];
    const visit = (n: any) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(visit);
      nodes.push(n);
      if (Array.isArray(n["@graph"])) n["@graph"].forEach(visit);
      if (Array.isArray(n.itemListElement)) n.itemListElement.forEach((el: any) => visit(el?.item ?? el));
    };
    visit(data);
    for (const n of nodes) {
      const type = n["@type"];
      const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJob || !clean(n.title)) continue;
      out.push({
        title: clean(n.title).slice(0, 300),
        company: orgName(n.hiringOrganization) || undefined,
        location: locName(n.jobLocation) || undefined,
        url: clean(n.url) || undefined,
        description: clean(String(n.description ?? "").replace(/<[^>]+>/g, " ")).slice(0, 4000) || undefined,
      });
    }
  }
  // Dedupe by title|company.
  const seen = new Set<string>();
  return out.filter((j) => {
    const k = `${j.title}|${j.company ?? ""}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Strip a page down to readable text for the AI fallback. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function getText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/json,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Surf a company career page or ATS board for jobs. Tries the reliable, key-less path first
 * (Greenhouse/Lever JSON), then JSON-LD, then optionally the AI text fallback. Detects bot
 * walls and reports them honestly instead of returning nothing.
 */
export async function surfForJobs(
  input: string,
  opts?: { ai?: boolean },
): Promise<SurfResult> {
  const ats = detectAts(input);
  try {
    if (ats?.kind === "greenhouse") {
      const { status, body } = await getText(
        `https://boards-api.greenhouse.io/v1/boards/${ats.token}/jobs?content=true`,
      );
      if (looksBlocked(status, body)) return { ok: false, blocked: true, reason: wallMsg };
      return { ok: true, jobs: mapGreenhouse(safeJson(body), ats.token), via: "greenhouse" };
    }
    if (ats?.kind === "lever") {
      const { status, body } = await getText(
        `https://api.lever.co/v0/postings/${ats.token}?mode=json`,
      );
      if (looksBlocked(status, body)) return { ok: false, blocked: true, reason: wallMsg };
      return { ok: true, jobs: mapLever(safeJson(body), ats.token), via: "lever" };
    }

    const url = input.includes("://") ? input : `https://${input}`;
    const { status, body } = await getText(url);
    if (looksBlocked(status, body)) return { ok: false, blocked: true, reason: wallMsg };

    const ld = extractJsonLdJobs(body);
    if (ld.length > 0) return { ok: true, jobs: ld, via: "jsonld" };

    if (opts?.ai) {
      const { aiExtractJobs } = await import("@/lib/data-sources/providers/fadi-scraper/ai-extract");
      let host = "career page";
      try {
        host = new URL(url).hostname;
      } catch {
        /* keep default */
      }
      const extracted = await aiExtractJobs(htmlToText(body).slice(0, 12_000), host);
      const jobs: SurfedJob[] = extracted
        .filter((j) => clean(j.title))
        .map((j) => ({
          title: clean(j.title),
          company: j.company ? clean(j.company) : undefined,
          location: j.location ? clean(j.location) : undefined,
          url: j.url ? clean(j.url) : undefined,
        }));
      if (jobs.length > 0) return { ok: true, jobs, via: "ai" };
    }
    return { ok: true, jobs: [], via: "none" };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "The page took too long to respond." : "Couldn't reach that page.";
    return { ok: false, blocked: false, reason };
  }
}

const wallMsg =
  "This site is bot-protected (Cloudflare / login wall). Open it with the Fadi extension to read it in your own session.";

function safeJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
