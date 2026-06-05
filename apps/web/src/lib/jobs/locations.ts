/**
 * Country catalog for job-location filtering. Drives the location switcher UI
 * (flag + name) and tells each source whether it can serve a given country.
 *
 * `adzuna` flags the ~19 countries Adzuna's API actually covers — notably NOT
 * Ireland, so for IE we lean on the keyless EU/remote sources (Arbeitnow,
 * Remotive) and, once configured, JSearch (Google-for-Jobs, global).
 */

export interface Country {
  /** ISO-3166 alpha-2, lowercase (Adzuna's path segment). */
  code: string;
  name: string;
  flag: string;
  /** Adzuna serves this country. */
  adzuna: boolean;
}

export const COUNTRIES: Country[] = [
  { code: "ie", name: "Ireland", flag: "🇮🇪", adzuna: false },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", adzuna: true },
  { code: "us", name: "United States", flag: "🇺🇸", adzuna: true },
  { code: "de", name: "Germany", flag: "🇩🇪", adzuna: true },
  { code: "nl", name: "Netherlands", flag: "🇳🇱", adzuna: true },
  { code: "fr", name: "France", flag: "🇫🇷", adzuna: true },
  { code: "es", name: "Spain", flag: "🇪🇸", adzuna: true },
  { code: "it", name: "Italy", flag: "🇮🇹", adzuna: true },
  { code: "be", name: "Belgium", flag: "🇧🇪", adzuna: true },
  { code: "at", name: "Austria", flag: "🇦🇹", adzuna: true },
  { code: "ch", name: "Switzerland", flag: "🇨🇭", adzuna: true },
  { code: "pl", name: "Poland", flag: "🇵🇱", adzuna: true },
  { code: "ca", name: "Canada", flag: "🇨🇦", adzuna: true },
  { code: "au", name: "Australia", flag: "🇦🇺", adzuna: true },
  { code: "nz", name: "New Zealand", flag: "🇳🇿", adzuna: true },
  { code: "in", name: "India", flag: "🇮🇳", adzuna: true },
  { code: "sg", name: "Singapore", flag: "🇸🇬", adzuna: true },
  { code: "za", name: "South Africa", flag: "🇿🇦", adzuna: true },
  { code: "br", name: "Brazil", flag: "🇧🇷", adzuna: true },
  { code: "mx", name: "Mexico", flag: "🇲🇽", adzuna: true },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

// Common cities → their country, so a freeform profile location like "Dublin"
// or "Dublin, Ireland" still resolves a country for the source layer.
const CITY_TO_COUNTRY: Record<string, string> = {
  dublin: "ie",
  cork: "ie",
  galway: "ie",
  london: "gb",
  manchester: "gb",
  berlin: "de",
  munich: "de",
  amsterdam: "nl",
  paris: "fr",
  madrid: "es",
  barcelona: "es",
  "new york": "us",
  "san francisco": "us",
  toronto: "ca",
  sydney: "au",
};

export function getCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toLowerCase()) : undefined;
}

export interface ParsedLocation {
  country?: string;
  city?: string;
}

/**
 * Best-effort parse of a freeform string into a country code + city. Finds a
 * known city or country mentioned ANYWHERE in the text — so "list jobs in
 * dublin", "Dublin, Ireland", and "remote roles in Germany" all resolve. Never
 * throws; unknown → empty. We deliberately do NOT match bare 2-letter codes
 * ("us", "ie") to avoid false positives on common words.
 */
export function parseLocation(input: string | null | undefined): ParsedLocation {
  if (!input) return {};
  const lower = input.toLowerCase();

  let country: string | undefined;
  let city: string | undefined;

  // 1) Known city mentioned anywhere (word-boundary).
  for (const [cityName, code] of Object.entries(CITY_TO_COUNTRY)) {
    if (new RegExp(`\\b${cityName}\\b`, "i").test(lower)) {
      city = cityName.replace(/\b\w/g, (c) => c.toUpperCase());
      country = code;
      break;
    }
  }

  // 2) An explicit country name present overrides/sets the country.
  for (const c of COUNTRIES) {
    if (new RegExp(`\\b${c.name.toLowerCase()}\\b`, "i").test(lower)) {
      country = c.code;
      break;
    }
  }

  return { country, city };
}
