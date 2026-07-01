import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  // Transactional email (password reset / verification). Both required to send.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // e.g. "Fadi <noreply@yourdomain.com>"
  // Shared secret for the background-agency cron route (/api/agent/run).
  CRON_SECRET: z.string().optional(),
  // Social sign-in (Better Auth) — a provider's buttons appear only when both
  // its values are set. Note: Indeed has no consumer OAuth program, so the
  // supported set is Google + LinkedIn.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  // Pluggable AI server-default provider. If unset, it auto-picks the first
  // configured key in order: Groq → Google → Anthropic → OpenAI.
  AI_PROVIDER: z.enum(["openai", "anthropic", "groq", "google"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_MODEL: z.string().optional(),
  // External data sources (see docs/DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md).
  // GDELT, Hacker News and Remotive are keyless and always active.
  JOB_SOURCE_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  // Phase B/C — providers self-report unavailable until their key is set.
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  REED_API_KEY: z.string().optional(), // reed.co.uk — UK + Ireland, salary
  JOOBLE_API_KEY: z.string().optional(), // jooble.org — global aggregator, covers IE
  JSEARCH_RAPIDAPI_KEY: z.string().optional(),
  // Apify — OPT-IN job scraping (e.g. Curious Coder's LinkedIn Jobs actor).
  // Off unless a token is set; the operator owns the ToS/legal decision.
  APIFY_TOKEN: z.string().optional(),
  APIFY_LINKEDIN_ACTOR: z.string().optional(), // default: curious_coder~linkedin-jobs-scraper
  BLS_API_KEY: z.string().optional(),
  ONET_API_KEY: z.string().optional(),
  FRED_API_KEY: z.string().optional(),
  // MCP server (Fadi-as-Lego): a Bearer token mapped to one user, for self-host.
  FADIOS_MCP_TOKEN: z.string().optional(),
  FADIOS_MCP_USER_ID: z.string().optional(),
  // Lightcast Open Skills — free skills taxonomy (sign-up → client id/secret).
  LIGHTCAST_CLIENT_ID: z.string().optional(),
  LIGHTCAST_CLIENT_SECRET: z.string().optional(),
});

export const serverEnv = {
  ...publicEnv,
  ...serverEnvSchema.parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_MODEL: process.env.GOOGLE_MODEL,
    JOB_SOURCE_API_KEY: process.env.JOB_SOURCE_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    REED_API_KEY: process.env.REED_API_KEY,
    JOOBLE_API_KEY: process.env.JOOBLE_API_KEY,
    JSEARCH_RAPIDAPI_KEY: process.env.JSEARCH_RAPIDAPI_KEY,
    APIFY_TOKEN: process.env.APIFY_TOKEN,
    APIFY_LINKEDIN_ACTOR: process.env.APIFY_LINKEDIN_ACTOR,
    BLS_API_KEY: process.env.BLS_API_KEY,
    ONET_API_KEY: process.env.ONET_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
    FADIOS_MCP_TOKEN: process.env.FADIOS_MCP_TOKEN,
    FADIOS_MCP_USER_ID: process.env.FADIOS_MCP_USER_ID,
    LIGHTCAST_CLIENT_ID: process.env.LIGHTCAST_CLIENT_ID,
    LIGHTCAST_CLIENT_SECRET: process.env.LIGHTCAST_CLIENT_SECRET,
  }),
};
