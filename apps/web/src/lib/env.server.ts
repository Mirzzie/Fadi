import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  JOB_SOURCE_API_KEY: z.string().optional(),
});

export const serverEnv = {
  ...publicEnv,
  ...serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    JOB_SOURCE_API_KEY: process.env.JOB_SOURCE_API_KEY,
  }),
};
