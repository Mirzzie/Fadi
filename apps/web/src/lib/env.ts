import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// An empty `NEXT_PUBLIC_APP_URL=` arrives as "" (not undefined) and would fail `.url()`.
// Treat empty as unset so `.optional()` applies — same rule the server env uses.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: appUrl === "" ? undefined : appUrl,
});
