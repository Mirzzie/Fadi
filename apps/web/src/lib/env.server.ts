import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  // Pluggable AI provider — "openai" | "anthropic", defaults to openai
  AI_PROVIDER: z.enum(["openai", "anthropic"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  // External data sources (see docs/DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md).
  // GDELT, Hacker News and Remotive are keyless and always active.
  JOB_SOURCE_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  // Phase B/C — providers self-report unavailable until their key is set.
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  JSEARCH_RAPIDAPI_KEY: z.string().optional(),
  BLS_API_KEY: z.string().optional(),
  ONET_API_KEY: z.string().optional(),
  FRED_API_KEY: z.string().optional(),
});

export const serverEnv = {
  ...publicEnv,
  ...serverEnvSchema.parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    JOB_SOURCE_API_KEY: process.env.JOB_SOURCE_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    JSEARCH_RAPIDAPI_KEY: process.env.JSEARCH_RAPIDAPI_KEY,
    BLS_API_KEY: process.env.BLS_API_KEY,
    ONET_API_KEY: process.env.ONET_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
  }),
};
