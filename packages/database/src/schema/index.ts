import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    fullName: text("full_name"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
    index("users_created_at_idx").on(table.createdAt),
  ]
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    providerEmail: text("provider_email"),
    providerProfile: jsonb("provider_profile")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_idx").on(table.provider, table.providerSubject),
    index("auth_identities_user_id_idx").on(table.userId),
  ]
);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("better_auth_user_email_idx").on(table.email),
    index("better_auth_user_created_at_idx").on(table.createdAt),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("better_auth_session_token_idx").on(table.token),
    index("better_auth_session_user_id_idx").on(table.userId),
    index("better_auth_session_expires_at_idx").on(table.expiresAt),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("better_auth_account_user_id_idx").on(table.userId),
    index("better_auth_account_provider_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("better_auth_verification_identifier_idx").on(table.identifier),
    index("better_auth_verification_expires_at_idx").on(table.expiresAt),
  ]
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    // When on, Scout auto-prepares the full document packet (CV, cover letter,
    // cold email, value proposition) the moment a user engages a job, instead
    // of waiting to be asked. Opt-in — defaults off so we never surprise users.
    autoPrepEnabled: boolean("auto_prep_enabled").notNull().default(false),
    // BYO-token Notion sync: the user's Notion internal-integration secret
    // (AES-GCM encrypted) + the target database id they shared with it.
    notionTokenCiphertext: text("notion_token_ciphertext"),
    notionDatabaseId: text("notion_database_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("profiles_user_id_idx").on(table.userId),
    index("profiles_onboarding_completed_idx").on(table.onboardingCompleted),
  ]
);

export const careerProfiles = pgTable(
  "career_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    targetRole: text("target_role").notNull(),
    location: text("location"),
    experienceLevel: text("experience_level"),
    careerGoal: text("career_goal").notNull(),
    importedFrom: text("imported_from").notNull().default("manual"),
    analysisStatus: text("analysis_status").notNull().default("not_started"),
    // A career_profile row IS a "career track" — a switchable direction the user
    // is pursuing. A user can run several in parallel (career change, exploration,
    // a trial, a part-time/gig hustle). Exactly one is active at a time.
    /** User-facing track name, e.g. "Break into Cybersecurity". Null → fall back to targetRole. */
    label: text("label"),
    /** Industry/domain the track lives in, e.g. "Finance", "Information Technology". Drives domain-aware sources + role families (not tech-only). */
    domain: text("domain"),
    /** Why this track exists: career | exploration | trial | part_time. */
    intent: text("intent").notNull().default("career"),
    /** For exploration tracks: several target roles to cast a wide net (fresher "any entry role"). */
    roleCluster: jsonb("role_cluster").$type<string[]>(),
    /**
     * Scout-generated equivalent job-title phrases for THIS track's role(s), used
     * to match title variants — domain-agnostic (works for nursing, finance,
     * trades, tech alike), replacing the old hardcoded IT-only synonym map.
     */
    roleSynonyms: jsonb("role_synonyms").$type<string[]>(),
    /** The one track currently driving jobs/report/documents/Scout for this user. */
    isActive: boolean("is_active").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("career_profiles_user_id_idx").on(table.userId),
    index("career_profiles_profile_id_idx").on(table.profileId),
    index("career_profiles_analysis_status_idx").on(table.analysisStatus),
    index("career_profiles_user_created_at_idx").on(table.userId, table.createdAt),
    index("career_profiles_user_active_idx").on(table.userId, table.isActive),
  ]
);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    fileName: text("file_name"),
    filePath: text("file_path"),
    fileMimeType: text("file_mime_type"),
    rawText: text("raw_text"),
    parsedText: text("parsed_text"),
    parseStatus: text("parse_status").notNull().default("manual_text"),
    ...timestamps,
  },
  (table) => [
    index("resumes_user_id_idx").on(table.userId),
    index("resumes_profile_id_idx").on(table.profileId),
    index("resumes_parse_status_idx").on(table.parseStatus),
    index("resumes_user_created_at_idx").on(table.userId, table.createdAt),
  ]
);

export const linkedinProfiles = pgTable(
  "linkedin_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    profileUrl: text("profile_url"),
    rawText: text("raw_text"),
    importStatus: text("import_status").notNull().default("manual_text"),
    ...timestamps,
  },
  (table) => [
    index("linkedin_profiles_user_id_idx").on(table.userId),
    index("linkedin_profiles_profile_id_idx").on(table.profileId),
    index("linkedin_profiles_import_status_idx").on(table.importStatus),
    index("linkedin_profiles_user_created_at_idx").on(table.userId, table.createdAt),
  ]
);

export const careerReports = pgTable(
  "career_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    careerProfileId: uuid("career_profile_id").references(() => careerProfiles.id, {
      onDelete: "set null",
    }),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    linkedinProfileId: uuid("linkedin_profile_id").references(() => linkedinProfiles.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("draft"),
    careerSummary: text("career_summary"),
    strengths: jsonb("strengths")
      .$type<Array<{ title: string; detail: string }>>()
      .notNull()
      .default([]),
    skillAnalysis: jsonb("skill_analysis")
      .$type<Array<{ title: string; detail: string }>>()
      .notNull()
      .default([]),
    missingSkills: jsonb("missing_skills")
      .$type<Array<{ title: string; detail: string }>>()
      .notNull()
      .default([]),
    targetRoleFit: jsonb("target_role_fit")
      .$type<{ rating?: string; explanation?: string }>()
      .notNull()
      .default({}),
    careerOpportunities: jsonb("career_opportunities")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    marketDemand: jsonb("market_demand").$type<Record<string, unknown>>().notNull().default({}),
    recommendedLearningPath: jsonb("recommended_learning_path")
      .$type<Array<{ title: string; detail: string }>>()
      .notNull()
      .default([]),
    resumeQualityScore: integer("resume_quality_score"),
    careerReadinessScore: integer("career_readiness_score"),
    recommendedActions: jsonb("recommended_actions")
      .$type<Array<{ title: string; detail: string }>>()
      .notNull()
      .default([]),
    modelName: text("model_name"),
    promptVersion: text("prompt_version"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("career_reports_user_id_idx").on(table.userId),
    index("career_reports_status_idx").on(table.status),
    index("career_reports_user_created_at_idx").on(table.userId, table.createdAt),
  ]
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    remoteMode: text("remote_mode"),
    employmentType: text("employment_type"),
    seniority: text("seniority"),
    description: text("description"),
    url: text("url"),
    salaryText: text("salary_text"),
    status: text("status").notNull().default("active"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jobs_source_external_id_idx").on(table.source, table.externalId),
    index("jobs_status_idx").on(table.status),
    index("jobs_title_idx").on(table.title),
    index("jobs_company_idx").on(table.company),
  ]
);

export const savedJobs = pgTable(
  "saved_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("saved"),
    matchScore: integer("match_score"),
    matchSummary: text("match_summary"),
    matchedSkills: jsonb("matched_skills").$type<string[]>().notNull().default([]),
    missingSkills: jsonb("missing_skills").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("saved_jobs_user_job_idx").on(table.userId, table.jobId),
    index("saved_jobs_user_id_idx").on(table.userId),
    index("saved_jobs_status_idx").on(table.status),
  ]
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    careerReportId: uuid("career_report_id").references(() => careerReports.id, {
      onDelete: "set null",
    }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    // Pasted job description — the context Scout tailors documents against.
    jobDescription: text("job_description"),
    status: text("status").notNull().default("saved"),
    priority: text("priority").notNull().default("medium"),
    notes: text("notes"),
    nextAction: text("next_action"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    // ── Outcome tracking (Resilience Engine) ──
    // outcome is the controllable-vs-uncontrollable boundary: we record it for
    // honest pattern analysis, but NEVER reward the outcome itself.
    outcome: text("outcome").notNull().default("pending"), // pending | rejected | ghosted | interview | offer | withdrawn
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    rejectionStage: text("rejection_stage"), // keyword | screen | interview | final
    rejectionVerified: boolean("rejection_verified").notNull().default(false),
    // AQS captured at send time — gates the "quality application" reward.
    qualityScore: integer("quality_score"),
    ...timestamps,
  },
  (table) => [
    index("applications_user_id_idx").on(table.userId),
    index("applications_status_idx").on(table.status),
    index("applications_user_status_idx").on(table.userId, table.status),
    index("applications_outcome_idx").on(table.outcome),
  ]
);

// ── Resilience & Momentum Engine ──────────────────────────────────────────────
// Forward-motion ledger. Every row is a CONTROLLABLE action the user took
// (quality applications, rejection autopsies, skill closures, referrals, rest).
// We score the process, never the outcome — this is what makes the system
// honest and un-fakeable: there is no points-for-rejections to farm.
export const resilienceEvents = pgTable(
  "resilience_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // quality_application | rejection_logged | rejection_autopsy |
    // skill_closed | referral_added | rest_day | comeback
    kind: text("kind").notNull(),
    momentumDelta: integer("momentum_delta").notNull().default(0),
    // Provenance link — rejection-related events must reference a real application.
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    // Free-form payload: { stage, lesson, nextAction, verification, skillName, ... }
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("resilience_events_user_id_idx").on(table.userId),
    index("resilience_events_kind_idx").on(table.kind),
    index("resilience_events_user_created_at_idx").on(table.userId, table.createdAt),
  ]
);

// Per-user momentum snapshot. Momentum decays gently and never resets to zero
// (no shame cliff). Rest is protected. Peak is remembered so the user always
// has a personal best to climb back toward — you-vs-past-self, never vs others.
export const momentumStates = pgTable(
  "momentum_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    momentum: integer("momentum").notNull().default(0), // 0–100, decayed snapshot
    peakMomentum: integer("peak_momentum").notNull().default(0),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    // Commitment cadence the user set for themselves (their terms, not ours).
    cadenceTarget: integer("cadence_target"), // quality applications per period
    cadencePeriod: text("cadence_period").notNull().default("week"),
    // Deliberate rest that pauses decay — Scout protects momentum during recovery.
    restingUntil: timestamp("resting_until", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("momentum_states_user_id_idx").on(table.userId)]
);

export const learningRecommendations = pgTable(
  "learning_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    careerReportId: uuid("career_report_id").references(() => careerReports.id, {
      onDelete: "set null",
    }),
    skillName: text("skill_name").notNull(),
    title: text("title").notNull(),
    provider: text("provider"),
    url: text("url"),
    reason: text("reason"),
    estimatedTime: text("estimated_time"),
    status: text("status").notNull().default("recommended"),
    ...timestamps,
  },
  (table) => [
    index("learning_recommendations_user_id_idx").on(table.userId),
    index("learning_recommendations_status_idx").on(table.status),
  ]
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    contextSummary: text("context_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("agent_messages_user_id_idx").on(table.userId),
    index("agent_messages_role_idx").on(table.role),
  ]
);

export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("product_events_user_id_idx").on(table.userId),
    index("product_events_event_type_idx").on(table.eventType),
    index("product_events_created_at_idx").on(table.createdAt),
  ]
);

// Per-user AI provider config (BYOK). The API key is stored ENCRYPTED at rest;
// never persist plaintext. One row per user.
export const userAiSettings = pgTable(
  "user_ai_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // openai | anthropic | google | groq | ollama
    model: text("model"),
    baseUrl: text("base_url"), // for ollama / custom-compatible endpoints
    apiKeyCiphertext: text("api_key_ciphertext"), // AES-GCM payload, null for keyless (ollama)
    apiKeyHint: text("api_key_hint"), // last 4 chars, safe to display
    // Optional fallback provider — used when the primary is rate-limited/exhausted.
    fallbackProvider: text("fallback_provider"),
    fallbackModel: text("fallback_model"),
    fallbackBaseUrl: text("fallback_base_url"),
    fallbackApiKeyCiphertext: text("fallback_api_key_ciphertext"),
    fallbackApiKeyHint: text("fallback_api_key_hint"),
    ...timestamps,
  },
  (table) => [uniqueIndex("user_ai_settings_user_id_idx").on(table.userId)]
);

// Career documents Scout helps create — resumes, cover letters, emails, value
// propositions. Optionally tied to a specific job/application. Rich-text body
// stored as `content`; exported to PDF/DOCX on demand. Saved, versionable,
// downloadable — the backbone of the document workspace.
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(), // resume | cover_letter | email | value_proposition | note
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    format: text("format").notNull().default("richtext"), // richtext | markdown | plain
    template: text("template"), // selected resume/letter template id
    // Pasted job context for paste-a-JD workspaces (company, role, raw JD).
    jobContext: jsonb("job_context").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_job_id_idx").on(table.jobId),
    index("documents_kind_idx").on(table.kind),
    index("documents_user_updated_at_idx").on(table.userId, table.updatedAt),
  ]
);

// User-saved resume style presets (base template + font + size + section order),
// reusable across their resumes — "save my styling as a template".
export const resumeTemplates = pgTable(
  "resume_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [index("resume_templates_user_id_idx").on(table.userId)]
);

// Scout's background agency. One agent_runs row per pass Scout makes over a user's
// market while they're away; agent_findings are the auditable evidence behind
// the "since you were away" digest — Scout may only claim what a finding records.
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"), // running | ok | error
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    findingsCount: integer("findings_count").notNull().default(0),
    error: text("error"),
  },
  (table) => [
    index("agent_runs_user_id_idx").on(table.userId),
    index("agent_runs_started_at_idx").on(table.startedAt),
  ]
);

export const agentFindings = pgTable(
  "agent_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // new_role | expired_saved_role | market_signal | world_shift
    title: text("title").notNull(),
    detail: text("detail"),
    href: text("href"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_findings_user_seen_idx").on(table.userId, table.seenAt),
    index("agent_findings_run_id_idx").on(table.runId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type BetterAuthUser = typeof user.$inferSelect;
export type BetterAuthSession = typeof session.$inferSelect;
export type BetterAuthAccount = typeof account.$inferSelect;
export type BetterAuthVerification = typeof verification.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type CareerProfile = typeof careerProfiles.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type LinkedInProfile = typeof linkedinProfiles.$inferSelect;
export type CareerReport = typeof careerReports.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type SavedJob = typeof savedJobs.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ResilienceEvent = typeof resilienceEvents.$inferSelect;
export type NewResilienceEvent = typeof resilienceEvents.$inferInsert;
export type MomentumState = typeof momentumStates.$inferSelect;
export type UserAiSettings = typeof userAiSettings.$inferSelect;
export type NewUserAiSettings = typeof userAiSettings.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ResumeTemplateRow = typeof resumeTemplates.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentFinding = typeof agentFindings.$inferSelect;
export type NewAgentFinding = typeof agentFindings.$inferInsert;
