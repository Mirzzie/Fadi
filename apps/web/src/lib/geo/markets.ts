// ─── Job market definitions ────────────────────────────────────────────────────

export type MarketTier = "global_hub" | "regional_hub" | "emerging" | "local";

export interface JobMarket {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  flag: string;
  tier: MarketTier;
  primaryLanguage: string;
  cvFormat: "cv" | "resume"; // CV = longer, resume = 1-2 pages
  photoExpected: boolean; // true = photo on CV is expected/normal
  coverLetterNorm: "required" | "expected" | "optional" | "uncommon";
  linkedinAdoption: "dominant" | "strong" | "moderate" | "low";
  primaryJobBoards: string[];
  regions: Region[];
  hiringNotes: string;
  culturalAlerts: string[];
}

export interface Region {
  name: string;
  code?: string;
  cities?: string[];
  marketStrength?: "strong" | "moderate" | "limited";
}

// ─── Markets ──────────────────────────────────────────────────────────────────

export const JOB_MARKETS: JobMarket[] = [
  {
    code: "IE",
    name: "Ireland",
    flag: "🇮🇪",
    tier: "regional_hub",
    primaryLanguage: "en",
    cvFormat: "cv",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "IrishJobs", "Jobs.ie", "Indeed", "Glassdoor"],
    regions: [
      { name: "Dublin", marketStrength: "strong", cities: ["Dublin 1-18", "Tallaght", "Blanchardstown"] },
      { name: "Cork", marketStrength: "strong" },
      { name: "Limerick", marketStrength: "moderate" },
      { name: "Galway", marketStrength: "moderate" },
      { name: "Waterford", marketStrength: "limited" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Ireland has a large multinational tech sector (Google, Meta, Apple, Stripe HQ). Cover letters are expected. Strong demand for tech, pharma, finance, and medical devices. Work permit requirements apply strictly for non-EU candidates.",
    culturalAlerts: [
      "Cover letters are expected and read — do not skip them",
      "Ireland has strict work authorisation requirements — check stamp/visa status before applying",
      "Multinational companies often follow US/UK hiring norms, Irish SMEs follow local norms",
      "Networking and referrals are significant — LinkedIn connections in Dublin matter",
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    tier: "global_hub",
    primaryLanguage: "en",
    cvFormat: "cv",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Reed.co.uk", "TotalJobs", "Indeed", "CV-Library", "Glassdoor"],
    regions: [
      { name: "London", marketStrength: "strong", cities: ["City of London", "Canary Wharf", "Tech City / Shoreditch", "West End"] },
      { name: "Manchester", marketStrength: "strong" },
      { name: "Birmingham", marketStrength: "strong" },
      { name: "Edinburgh", marketStrength: "strong" },
      { name: "Bristol", marketStrength: "moderate" },
      { name: "Leeds", marketStrength: "moderate" },
      { name: "Glasgow", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "CVs are typically 2 pages. References required. Cover letters standard. Post-Brexit right-to-work checks are strictly enforced. Strong finance, legal, media, and tech sectors.",
    culturalAlerts: [
      "UK CVs must not include photo, age, or date of birth — inclusion can hurt your application",
      "Post-Brexit visa checks are mandatory — confirm right-to-work status",
      "UK cover letters are formal and concise — avoid American-style overselling",
      "London tech market is highly competitive — referrals are crucial",
      "References are typically expected — prepare 2 professional referees",
    ],
  },
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    tier: "global_hub",
    primaryLanguage: "en",
    cvFormat: "resume",
    photoExpected: false,
    coverLetterNorm: "optional",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Indeed", "Glassdoor", "Wellfound", "Handshake", "ZipRecruiter"],
    regions: [
      { name: "San Francisco Bay Area", marketStrength: "strong", cities: ["San Francisco", "San Jose", "Oakland", "Palo Alto", "Mountain View"] },
      { name: "New York Metro", marketStrength: "strong", cities: ["Manhattan", "Brooklyn", "New Jersey"] },
      { name: "Seattle", marketStrength: "strong" },
      { name: "Austin", marketStrength: "strong" },
      { name: "Boston", marketStrength: "strong" },
      { name: "Chicago", marketStrength: "moderate" },
      { name: "Los Angeles", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "1-page resume for <10 years experience. Quantified achievements expected. Visa sponsorship is a major barrier for international candidates — check if employer sponsors H-1B/OPT before applying. ATS usage is near-universal at mid/large companies.",
    culturalAlerts: [
      "Do NOT include photo, age, marital status, or nationality on US resumes — discrimination laws make these red flags",
      "Self-promotion is expected — be confident, specific, and results-driven",
      "Resume must be 1 page (entry/mid) or 2 pages max (senior) — CV format is not used",
      "Visa sponsorship (H-1B, OPT, TN) is required if not a US citizen/PR — confirm before applying",
      "Cover letters are optional but recommended when specifically requested",
      "Salary negotiation is expected — not negotiating is seen as a weakness",
    ],
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    tier: "global_hub",
    primaryLanguage: "en",
    cvFormat: "resume",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Indeed", "Workopolis", "Monster", "JobBank (govt)"],
    regions: [
      { name: "Toronto", marketStrength: "strong" },
      { name: "Vancouver", marketStrength: "strong" },
      { name: "Montreal", marketStrength: "strong" },
      { name: "Calgary", marketStrength: "moderate" },
      { name: "Ottawa", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Similar to US but cover letters are more expected. French is required for Quebec roles. Strong immigration pathways (Express Entry) — many companies open to sponsorship for skilled workers.",
    culturalAlerts: [
      "Quebec roles often require functional French — check language requirements",
      "Canada has strong immigration pathways — many employers sponsor skilled workers",
      "Do not include photo, age, or personal details",
    ],
  },
  {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    tier: "global_hub",
    primaryLanguage: "de",
    cvFormat: "cv",
    photoExpected: true,
    coverLetterNorm: "required",
    linkedinAdoption: "strong",
    primaryJobBoards: ["LinkedIn", "XING", "StepStone", "Indeed", "Arbeitsagentur"],
    regions: [
      { name: "Berlin", marketStrength: "strong" },
      { name: "Munich (München)", marketStrength: "strong" },
      { name: "Hamburg", marketStrength: "strong" },
      { name: "Frankfurt", marketStrength: "strong" },
      { name: "Cologne (Köln)", marketStrength: "moderate" },
      { name: "Stuttgart", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "German CVs (Lebenslauf) include photo and personal data. Cover letters (Anschreiben) are mandatory and formal. German language is required for most non-tech roles. Hiring processes are thorough and longer than UK/US.",
    culturalAlerts: [
      "CRITICAL: German CVs include a professional photo — absence is unusual and may hurt you",
      "Cover letter (Anschreiben) is mandatory and must be formal — casual tone will disqualify",
      "German language (B2+) is required for most roles outside international tech companies",
      "Germans value precision and thoroughness — vague claims without evidence are viewed poorly",
      "Applications typically require copies of certificates, degrees, and references (Zeugnisse)",
      "Hiring timelines are longer (6-12 weeks typical) — do not follow up aggressively",
      "XING is the dominant professional network in Germany, not just LinkedIn",
    ],
  },
  {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    tier: "global_hub",
    primaryLanguage: "en",
    cvFormat: "resume",
    photoExpected: true,
    coverLetterNorm: "optional",
    linkedinAdoption: "strong",
    primaryJobBoards: ["Naukri", "LinkedIn", "Shine", "Monster India", "Indeed", "Instahyre", "Cutshort"],
    regions: [
      { name: "Bengaluru (Bangalore)", marketStrength: "strong", cities: ["Whitefield", "Electronic City", "HSR Layout", "Koramangala"] },
      { name: "Hyderabad", marketStrength: "strong", cities: ["HITEC City", "Gachibowli"] },
      { name: "Mumbai", marketStrength: "strong", cities: ["BKC", "Andheri", "Powai"] },
      { name: "Delhi NCR", marketStrength: "strong", cities: ["Gurgaon", "Noida", "Delhi"] },
      { name: "Pune", marketStrength: "strong" },
      { name: "Chennai", marketStrength: "moderate" },
      { name: "Kolkata", marketStrength: "moderate" },
      { name: "Remote / Pan-India" },
    ],
    hiringNotes: "India's tech market is the world's largest by volume. Naukri.com dominates over LinkedIn for most roles. Photo on CV is standard and expected. Notice periods of 1-3 months are the norm — candidates should mention their notice period clearly. Salary packages often quoted in LPA (lakhs per annum).",
    culturalAlerts: [
      "Photo on CV is standard and expected in India — absence may seem unusual",
      "Notice period (typically 30-90 days) must be stated clearly in applications",
      "Naukri.com is the dominant job board — more important than LinkedIn for many roles",
      "Salaries are quoted in LPA (lakhs per annum) — know the local scale",
      "Technical interviews often include coding tests (HackerRank, etc.) — prepare for technical screening",
      "Family background, education tier (IIT/IIM vs others), and location significantly affect outcomes in some sectors",
      "Engineering and MBA credentials are highly valued — list them prominently",
    ],
  },
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    tier: "regional_hub",
    primaryLanguage: "en",
    cvFormat: "resume",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Seek", "Indeed", "Jora", "CareerOne"],
    regions: [
      { name: "Sydney", marketStrength: "strong" },
      { name: "Melbourne", marketStrength: "strong" },
      { name: "Brisbane", marketStrength: "moderate" },
      { name: "Perth", marketStrength: "moderate" },
      { name: "Adelaide", marketStrength: "limited" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "SEEK.com.au is the dominant job board. Cover letters are expected. Referees (2-3) typically listed at end of resume. Visa status must be declared (Australian citizens/PR preferred). Strong demand in healthcare, mining, construction, tech.",
    culturalAlerts: [
      "SEEK is more important than LinkedIn for most Australian job applications",
      "Referees (2-3) are expected — list them with contact details at the end of your resume",
      "Visa status must be explicitly stated — working rights are a key screening factor",
      "Australians use informal first-name communication from the start — formal tone can seem stiff",
      "Australian resumes should include a 'Key Skills' section near the top",
    ],
  },
  {
    code: "AE",
    name: "UAE",
    flag: "🇦🇪",
    tier: "regional_hub",
    primaryLanguage: "en",
    cvFormat: "cv",
    photoExpected: true,
    coverLetterNorm: "optional",
    linkedinAdoption: "strong",
    primaryJobBoards: ["LinkedIn", "Bayt", "Naukrigulf", "GulfTalent", "Indeed"],
    regions: [
      { name: "Dubai", marketStrength: "strong" },
      { name: "Abu Dhabi", marketStrength: "strong" },
      { name: "Sharjah", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "UAE CVs include photo and personal details. Nationality and visa status are significant factors. Arabic language is an advantage but not always required. Salary packages are tax-free. Free zone vs mainland employment has different rules.",
    culturalAlerts: [
      "Photo and nationality are included on UAE CVs — common practice and legally permitted",
      "Visa/sponsorship is required for all expatriates — employer typically sponsors work visa",
      "UAE salaries are tax-free — factor this into salary comparisons",
      "Dress code and professional conduct expectations are formal",
      "Relationships and referrals are highly important in the Gulf — network through events and LinkedIn",
      "Ramadan significantly slows hiring — plan applications around this period",
    ],
  },
  {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    tier: "global_hub",
    primaryLanguage: "en",
    cvFormat: "resume",
    photoExpected: false,
    coverLetterNorm: "optional",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "JobsDB", "MyCareersFuture (govt)", "Indeed", "Glassdoor"],
    regions: [
      { name: "Central (CBD / Marina Bay)", marketStrength: "strong" },
      { name: "One-North / Buona Vista", marketStrength: "strong" },
      { name: "Changi Business Park", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Singapore is a major APAC tech hub. Fair Consideration Framework (FCF) requires companies to consider Singaporeans first — EP (Employment Pass) is possible but scrutinised. MyCareersFuture.sg is the government job portal and commonly used.",
    culturalAlerts: [
      "Fair Consideration Framework means Singaporeans and PRs are prioritised — EP applications are scrutinised",
      "MyCareersFuture.sg is mandated for many job ads — register and use it",
      "Salary expectations are high — Singapore is one of the most expensive cities in Asia",
      "Multicultural workplace norms apply — respectful, professional communication is essential",
      "Strong demand for fintech, biotech, and digital roles",
    ],
  },
  {
    code: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    tier: "regional_hub",
    primaryLanguage: "en",
    cvFormat: "cv",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Nationale Vacaturebank", "Indeed", "Glassdoor", "Intermediair"],
    regions: [
      { name: "Amsterdam", marketStrength: "strong" },
      { name: "Rotterdam", marketStrength: "moderate" },
      { name: "The Hague (Den Haag)", marketStrength: "moderate" },
      { name: "Eindhoven", marketStrength: "moderate" },
      { name: "Utrecht", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Netherlands is a major EU tech hub with many English-language roles in Amsterdam. Dutch language is required for most non-tech/non-international roles. Direct, flat communication style — hierarchy is minimal.",
    culturalAlerts: [
      "Dutch communication is extremely direct — do not interpret bluntness as rudeness",
      "Work-life balance is highly valued — avoid suggesting you will work excessive hours",
      "English is widely spoken, but Dutch is required for most non-tech roles",
      "30% tax ruling is available for skilled expats — worth mentioning if you qualify",
    ],
  },
  {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    tier: "global_hub",
    primaryLanguage: "fr",
    cvFormat: "cv",
    photoExpected: false,
    coverLetterNorm: "required",
    linkedinAdoption: "strong",
    primaryJobBoards: ["LinkedIn", "Pôle Emploi", "Indeed", "APEC", "Welcome to the Jungle"],
    regions: [
      { name: "Paris (Île-de-France)", marketStrength: "strong" },
      { name: "Lyon", marketStrength: "moderate" },
      { name: "Bordeaux", marketStrength: "moderate" },
      { name: "Marseille", marketStrength: "limited" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "French language is essential for most roles. Cover letter (lettre de motivation) is mandatory and formal. CVs are 1 page typically. Strong labour protections — hiring is slower and more considered.",
    culturalAlerts: [
      "CRITICAL: French language (C1+) is required for nearly all roles outside Paris tech startups",
      "Cover letter is mandatory — a formal, well-structured lettre de motivation is expected",
      "Do not include photo on French CVs — not expected and may introduce bias",
      "French hiring processes are formal, thorough, and slow — do not rush or follow up aggressively",
      "Education pedigree (Grandes Écoles) matters significantly for many French companies",
    ],
  },
  {
    code: "SE",
    name: "Sweden",
    flag: "🇸🇪",
    tier: "regional_hub",
    primaryLanguage: "sv",
    cvFormat: "cv",
    photoExpected: false,
    coverLetterNorm: "expected",
    linkedinAdoption: "dominant",
    primaryJobBoards: ["LinkedIn", "Arbetsförmedlingen", "Indeed", "Blocket Jobb"],
    regions: [
      { name: "Stockholm", marketStrength: "strong" },
      { name: "Gothenburg (Göteborg)", marketStrength: "moderate" },
      { name: "Malmö", marketStrength: "moderate" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Sweden has a flat workplace culture (Janteloven-adjacent). English is widely spoken in tech/international companies. Swedish language required for many local roles. Strong work-life balance culture — overtime is not a selling point.",
    culturalAlerts: [
      "Swedish culture values humility — avoid aggressive self-promotion",
      "Work-life balance is a core value — do not suggest you sacrifice personal time",
      "Swedish language is required for most non-tech roles",
      "Flat hierarchy — address hiring managers by first name from the start",
    ],
  },
  {
    code: "JP",
    name: "Japan",
    flag: "🇯🇵",
    tier: "global_hub",
    primaryLanguage: "ja",
    cvFormat: "cv",
    photoExpected: true,
    coverLetterNorm: "required",
    linkedinAdoption: "low",
    primaryJobBoards: ["Recruit (Rikunabi)", "LinkedIn", "GaijinPot", "Daijob", "Indeed"],
    regions: [
      { name: "Tokyo", marketStrength: "strong" },
      { name: "Osaka", marketStrength: "moderate" },
      { name: "Yokohama", marketStrength: "moderate" },
      { name: "Nagoya", marketStrength: "limited" },
    ],
    hiringNotes: "Japanese job market has very specific conventions. Rirekisho (official CV form) is required for traditional companies. Keigo (formal language) is expected. Foreign candidates typically target English-language international companies. Very long hiring processes.",
    culturalAlerts: [
      "CRITICAL: Japan uses a specific CV format (Rirekisho) with photo — standard Western CVs are unusual",
      "Japanese (N2+) is required for most traditional companies — English-friendly roles are limited to international firms",
      "Hierarchical culture — show deep respect for seniority in all communication",
      "Punctuality is non-negotiable — 5 minutes early is on time",
      "LinkedIn is used but not dominant — recruiters often use Japanese-specific platforms",
      "Lifetime employment culture is changing but longevity is still valued — job-hopping is viewed negatively",
      "Dress code is formal — conservative, dark business attire for interviews",
    ],
  },
  {
    code: "BR",
    name: "Brazil",
    flag: "🇧🇷",
    tier: "regional_hub",
    primaryLanguage: "pt",
    cvFormat: "cv",
    photoExpected: true,
    coverLetterNorm: "uncommon",
    linkedinAdoption: "strong",
    primaryJobBoards: ["LinkedIn", "Catho", "InfoJobs", "Indeed", "Vagas.com"],
    regions: [
      { name: "São Paulo", marketStrength: "strong" },
      { name: "Rio de Janeiro", marketStrength: "moderate" },
      { name: "Campinas", marketStrength: "moderate" },
      { name: "Belo Horizonte", marketStrength: "limited" },
      { name: "Remote / Nationwide" },
    ],
    hiringNotes: "Portuguese (Brazilian) is essential for most roles. English is an advantage in tech and multinationals. LinkedIn is used widely. Photo is common on CVs. Strong fintech, agritech, and SaaS sectors in São Paulo.",
    culturalAlerts: [
      "Brazilian Portuguese is required for most roles — European Portuguese is understood but different",
      "Cover letters are uncommon — focus on the CV/resume quality",
      "Relationship-building (jogo bonito) is important in Brazilian business culture",
      "Warm, informal communication style is valued — overly formal tone can seem cold",
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getMarketByCode(code: string): JobMarket | undefined {
  return JOB_MARKETS.find((m) => m.code === code);
}

export function getMarketsForSelect() {
  return JOB_MARKETS.map((m) => ({
    value: m.code,
    label: `${m.flag} ${m.name}`,
    tier: m.tier,
  })).sort((a, b) => {
    const tierOrder: Record<MarketTier, number> = { global_hub: 0, regional_hub: 1, emerging: 2, local: 3 };
    return tierOrder[a.tier] - tierOrder[b.tier] || a.label.localeCompare(b.label);
  });
}

export function getRegionsForCountry(countryCode: string): Region[] {
  return getMarketByCode(countryCode)?.regions ?? [];
}

export function getCulturalAlerts(fromCountry: string | null, toCountry: string): string[] {
  const market = getMarketByCode(toCountry);
  if (!market) return [];

  const alerts = [...market.culturalAlerts];

  if (fromCountry && fromCountry !== toCountry) {
    const fromMarket = getMarketByCode(fromCountry);

    // Add cross-market specific warnings
    if (fromMarket?.cvFormat === "resume" && market.cvFormat === "cv") {
      alerts.unshift(`Switching from ${fromMarket.name} (1-2 page resume) to ${market.name} (longer CV format) — your document format needs to change.`);
    }

    if (!fromMarket?.photoExpected && market.photoExpected) {
      alerts.unshift(`${market.name} expects a professional photo on the CV — this is unusual in ${fromMarket?.name ?? "your home market"} but standard here.`);
    }

    if (fromMarket?.coverLetterNorm === "optional" && market.coverLetterNorm === "required") {
      alerts.unshift(`Cover letters are optional in ${fromMarket?.name ?? "your home market"} but required in ${market.name} — do not skip it.`);
    }
  }

  return alerts;
}
