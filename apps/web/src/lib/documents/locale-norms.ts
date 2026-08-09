// Locale hiring norms (ADR 0010 follow-on) — Fadi tailors a document to the TARGET job
// market's conventions, per `direction × location`. Norms drift, so every entry carries a
// `lastReviewed` date and an optional `trend`; Fadi surfaces them BEFORE creating a document
// and treats them as current guidance, not law. Evidence: see the global-hiring-norms notes.

export type PhotoNorm = "expected" | "neutral" | "avoid";

export type LocaleNorm = {
  /** ISO-ish code, for reference. */
  code: string;
  label: string;
  /** Substrings that map a free-text location ("Dublin, Ireland") to this market. */
  match: string[];
  documentTerm: "Résumé" | "CV";
  lengthPages: string;
  photo: PhotoNorm;
  /** Personal fields customarily included in this market. */
  personal: { dob: boolean; maritalStatus: boolean; nationality: boolean; gender: boolean };
  /** Work-authorization/visa status expected prominently (Gulf). */
  workAuthField: boolean;
  /** Education listed before experience. */
  educationFirst: boolean;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY/MM/DD";
  notes: string;
  trend?: string;
  lastReviewed: string; // ISO date
};

const NO_PERSONAL = { dob: false, maritalStatus: false, nationality: false, gender: false };
const REVIEWED = "2026-08-01";

// Ordered so more specific/aliased markets match before broad ones during resolution.
export const LOCALE_NORMS: LocaleNorm[] = [
  {
    code: "US", label: "United States", match: ["united states", " usa", " us ", "u.s", "america"],
    documentTerm: "Résumé", lengthPages: "1–2", photo: "avoid", personal: NO_PERSONAL,
    workAuthField: false, educationFirst: false, dateFormat: "MM/DD/YYYY", lastReviewed: REVIEWED,
    notes: "No photo, no DOB/marital/nationality (anti-discrimination law). Education after experience unless entry-level.",
  },
  {
    code: "CA", label: "Canada", match: ["canada", "toronto", "vancouver", "montreal", "ontario"],
    documentTerm: "Résumé", lengthPages: "1–2", photo: "avoid", personal: NO_PERSONAL,
    workAuthField: false, educationFirst: false, dateFormat: "YYYY/MM/DD", lastReviewed: REVIEWED,
    notes: "Same anti-discrimination stance as the US — no photo or personal details.",
  },
  {
    code: "UK", label: "United Kingdom", match: ["united kingdom", "uk", "england", "scotland", "wales", "london", "britain"],
    documentTerm: "CV", lengthPages: "2", photo: "avoid", personal: NO_PERSONAL,
    workAuthField: false, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Called a CV, ~2 pages. No photo or personal details (equality law).",
  },
  {
    code: "IE", label: "Ireland", match: ["ireland", "dublin", "cork", "galway"],
    documentTerm: "CV", lengthPages: "1–2", photo: "avoid", personal: NO_PERSONAL,
    workAuthField: false, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "CV, no photo or personal details — same as the UK.",
  },
  {
    code: "AU", label: "Australia", match: ["australia", "sydney", "melbourne", "brisbane"],
    documentTerm: "Résumé", lengthPages: "2–3", photo: "avoid", personal: NO_PERSONAL,
    workAuthField: false, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "2–3 pages, no photo or personal details.",
  },
  {
    code: "DE", label: "Germany", match: ["germany", "berlin", "munich", "frankfurt", "hamburg", "austria", "vienna"],
    documentTerm: "CV", lengthPages: "2–3", photo: "expected",
    personal: { dob: true, maritalStatus: false, nationality: true, gender: false },
    workAuthField: false, educationFirst: true, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Lebenslauf: professional photo and date of birth customary; education prominent.",
    trend: "Photo expectation is gradually declining, especially at international firms.",
  },
  {
    code: "FR", label: "France", match: ["france", "paris", "lyon", "spain", "madrid", "italy", "rome", "milan"],
    documentTerm: "CV", lengthPages: "1–2", photo: "expected",
    personal: { dob: true, maritalStatus: false, nationality: true, gender: false },
    workAuthField: false, educationFirst: true, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Photo common; nationality typical. (Also covers Spain/Italy.)",
  },
  {
    code: "NL", label: "Netherlands", match: ["netherlands", "amsterdam", "rotterdam", "holland"],
    documentTerm: "CV", lengthPages: "2", photo: "neutral",
    personal: { dob: true, maritalStatus: false, nationality: false, gender: false },
    workAuthField: false, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Photo optional/neutral; DOB common.",
  },
  {
    code: "AE", label: "United Arab Emirates", match: ["united arab emirates", "uae", "dubai", "abu dhabi", "gulf", "gcc", "qatar", "kuwait", "bahrain", "oman"],
    documentTerm: "CV", lengthPages: "1–2", photo: "expected",
    personal: { dob: true, maritalStatus: true, nationality: true, gender: false },
    workAuthField: true, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Gulf CV: photo + DOB/nationality/marital status, and VISA STATUS at the very top. Board: Bayt.",
  },
  {
    code: "SA", label: "Saudi Arabia", match: ["saudi arabia", "saudi", "riyadh", "jeddah"],
    documentTerm: "CV", lengthPages: "1–2", photo: "expected",
    personal: { dob: true, maritalStatus: true, nationality: true, gender: false },
    workAuthField: true, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "As the wider Gulf — photo, personal details, visa/iqama status prominent.",
  },
  {
    code: "IN", label: "India", match: ["india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai"],
    documentTerm: "Résumé", lengthPages: "2+", photo: "neutral",
    personal: { dob: true, maritalStatus: true, nationality: false, gender: false },
    workAuthField: false, educationFirst: true, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Traditional biodata (photo/DOB/marital) common domestically.",
    trend: "Drop the biodata block for MNC / GCC-employer / product-company roles — increasingly Western-style.",
  },
  {
    code: "JP", label: "Japan", match: ["japan", "tokyo", "osaka", "kyoto"],
    documentTerm: "CV", lengthPages: "standardized form", photo: "expected",
    personal: { dob: true, maritalStatus: false, nationality: false, gender: true },
    workAuthField: false, educationFirst: true, dateFormat: "YYYY/MM/DD", lastReviewed: REVIEWED,
    notes: "Standardized rirekisho form with a required photo (+ shokumu-keirekisho for experience). Fadi's free-form doc is a poor fit here — warn the user.",
  },
  {
    code: "CN", label: "China", match: ["china", "beijing", "shanghai", "shenzhen", "guangzhou"],
    documentTerm: "CV", lengthPages: "1–2", photo: "expected",
    personal: { dob: true, maritalStatus: false, nationality: false, gender: true },
    workAuthField: false, educationFirst: true, dateFormat: "YYYY/MM/DD", lastReviewed: REVIEWED,
    notes: "Photo, DOB and gender standard. Party-membership only for state-owned-enterprise roles.",
  },
  {
    code: "SG", label: "Singapore", match: ["singapore"],
    documentTerm: "CV", lengthPages: "1–2", photo: "neutral",
    personal: { dob: true, maritalStatus: false, nationality: true, gender: false },
    workAuthField: true, educationFirst: false, dateFormat: "DD/MM/YYYY", lastReviewed: REVIEWED,
    notes: "Photo optional; nationality/PR status commonly stated (work-pass relevant).",
  },
];

/** US is the safest default — most restrictive on personal data, so nothing is over-shared. */
export const DEFAULT_LOCALE_NORM = LOCALE_NORMS[0];

/** Resolve a free-text target location ("Dublin, Ireland", "Dubai, UAE") to its market norms. */
export function resolveLocaleNorm(location: string | undefined | null): LocaleNorm {
  const s = ` ${(location ?? "").toLowerCase()} `;
  return LOCALE_NORMS.find((n) => n.match.some((m) => s.includes(m))) ?? DEFAULT_LOCALE_NORM;
}
