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
    ...timestamps,
  },
  (table) => [
    index("career_profiles_user_id_idx").on(table.userId),
    index("career_profiles_profile_id_idx").on(table.profileId),
    index("career_profiles_analysis_status_idx").on(table.analysisStatus),
    index("career_profiles_user_created_at_idx").on(table.userId, table.createdAt),
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
    status: text("status").notNull().default("saved"),
    priority: text("priority").notNull().default("medium"),
    notes: text("notes"),
    nextAction: text("next_action"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("applications_user_id_idx").on(table.userId),
    index("applications_status_idx").on(table.status),
    index("applications_user_status_idx").on(table.userId, table.status),
  ]
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type CareerProfile = typeof careerProfiles.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type LinkedInProfile = typeof linkedinProfiles.$inferSelect;
export type CareerReport = typeof careerReports.$inferSelect;
