import "server-only";

import { serverEnv } from "@/lib/env.server";

export type SocialProvider = "google" | "linkedin";

/** Which social providers are actually configured — drives which buttons render. */
export function getEnabledSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (serverEnv.LINKEDIN_CLIENT_ID && serverEnv.LINKEDIN_CLIENT_SECRET) providers.push("linkedin");
  return providers;
}
