import { account, session, user, verification } from "@careeros/database";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDatabase } from "@/lib/database/client";
import { isEmailConfigured, resetPasswordEmail, sendEmail, verifyEmailEmail } from "@/lib/email/send";
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
  // Social sign-in — each provider activates only when its env pair is set, so
  // local dev without keys keeps working. (Indeed offers no consumer OAuth.)
  socialProviders: {
    ...(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: serverEnv.GOOGLE_CLIENT_ID,
            clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(serverEnv.LINKEDIN_CLIENT_ID && serverEnv.LINKEDIN_CLIENT_SECRET
      ? {
          linkedin: {
            clientId: serverEnv.LINKEDIN_CLIENT_ID,
            clientSecret: serverEnv.LINKEDIN_CLIENT_SECRET,
          },
        }
      : {}),
  },
  emailAndPassword: {
    enabled: true,
    // Without a configured sender this logs the link (dev) / an error (prod)
    // instead of silently dropping it — see lib/email/send.ts.
    sendResetPassword: async ({ user: resetUser, url }) => {
      await sendEmail({ to: resetUser.email, ...resetPasswordEmail(url) });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour, matches the email copy
  },
  emailVerification: {
    sendVerificationEmail: async ({ user: verifyUser, url }) => {
      await sendEmail({ to: verifyUser.email, ...verifyEmailEmail(url) });
    },
    // Only auto-send on sign-up when a real sender exists; verification stays
    // optional (requireEmailVerification off) so nobody gets locked out.
    sendOnSignUp: isEmailConfigured(),
    autoSignInAfterVerification: true,
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
