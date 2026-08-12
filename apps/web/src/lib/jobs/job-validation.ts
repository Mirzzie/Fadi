// Validate a scraped job before it reaches the user: is it still open, and does it look like a
// real role rather than a scam/lead-gen trap? Deterministic + free (no AI needed) so it always
// runs; an AI pass can layer on top when a provider is available. Errs toward KEEPING a job
// unless the signal is strong — better a borderline real job than a dropped one.

export type ValidatableJob = {
  title?: string;
  description?: string | null;
  url?: string | null;
  validThrough?: string | null;
};

/** Closed/expired: past its validThrough date, or the page says so in plain words. */
export function isExpired(job: ValidatableJob): boolean {
  if (job.validThrough) {
    const end = Date.parse(job.validThrough);
    if (!Number.isNaN(end) && end < Date.now()) return true;
  }
  const hay = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();
  return /no longer (available|accepting)|position (has been|is) (filled|closed)|this (job|role|vacancy) (has )?(expired|closed)|applications? (are )?closed|posting has expired/.test(
    hay,
  );
}

// Lead-gen / survey / MLM / advance-fee patterns — the "€20/hr surveys, no experience, unlimited
// earnings" noise that pollutes aggregators. Each hit is a weak signal; we need a couple.
const SCAM_PATTERNS: RegExp[] = [
  /\bpaid surveys?\b|survey takers?|complete surveys/,
  /no experience (needed|required)[^.]{0,40}(work from home|earn|\$|€|£)/,
  /unlimited (earning|income|commission)/,
  /earn (up to )?[€$£]?\d[\d,]*\s*(per|a|\/)\s*(hour|day|week)\s*(from home|online)/,
  /\b(mlm|pyramid|network marketing)\b/,
  /(pay|send|wire|deposit)[^.]{0,30}(upfront|registration fee|to (start|apply|begin))/,
  /be your own boss|work from home.{0,20}(no experience|start today|immediately)/,
  /(whatsapp|telegram)[^.]{0,20}(to apply|for details|hiring)/,
];

/** Looks like a scam / lead-gen trap rather than a genuine posting. */
export function looksLikeScam(job: ValidatableJob): boolean {
  const hay = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();
  let hits = 0;
  for (const re of SCAM_PATTERNS) {
    if (re.test(hay)) hits += 1;
    if (hits >= 2) return true;
  }
  // A single blatant survey/MLM tell in a short posting is enough.
  return hits === 1 && hay.length < 400;
}

/** Keep only genuine, still-open jobs. */
export function isLegitJob(job: ValidatableJob): boolean {
  return Boolean(job.title?.trim()) && !isExpired(job) && !looksLikeScam(job);
}
