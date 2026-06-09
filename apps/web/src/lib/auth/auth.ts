import { account, session, user, verification } from "@careeros/database";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDatabase } from "@/lib/database/client";
import { serverEnv } from "@/lib/env.server";

const appUrl = serverEnv.BETTER_AUTH_URL ?? serverEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const configuredTrustedOrigins =
  serverEnv.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
const localTrustedOrigins =
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3001"];

// In production a real, strong secret is mandatory — never ship the dev default
// (it would let anyone forge sessions). Fail fast at boot instead.
const DEV_SECRET = "local-development-better-auth-secret-change-me";
const configuredSecret = serverEnv.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a strong value (>=32 chars) in production. Generate one with `openssl rand -base64 32`.",
  );
}
const authSecret = configuredSecret ?? DEV_SECRET;

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: Array.from(new Set([appUrl, ...configuredTrustedOrigins, ...localTrustedOrigins])),
  secret: authSecret,
  database: drizzleAdapter(getDatabase(), {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: false,
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  plugins: [nextCookies()],
});

export type BetterAuthSession = typeof auth.$Infer.Session;
