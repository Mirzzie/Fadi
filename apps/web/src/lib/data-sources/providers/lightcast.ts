/**
 * Lightcast Open Skills — the world's most-used open skills taxonomy (35k+
 * standardized skills), free with a sign-up (Client ID + Secret). We use it to
 * map the user's role/skill-gap terms to canonical, in-demand skills, surfaced as
 * a skill_trend signal ("here are the recognized skills in your field"). Honest:
 * grounded in a real taxonomy, never invented. Self-disables until creds are set.
 *
 * Auth: OAuth2 client-credentials against auth.emsicloud.com (scope emsi_open).
 * https://docs.lightcast.dev/apis/skills
 */

import type { DataSourceCapability, MarketSignal, SignalQuery, SignalSource } from "../types";

const TOKEN_URL = "https://auth.emsicloud.com/connect/token";
const SKILLS_API = "https://emsiservices.com/skills/versions/latest/skills";

/** Tidy a Lightcast skill name for display (pure, testable). */
export function normalizeSkillName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Build a skill_trend signal from canonical skill names (pure, testable). */
export function skillsToSignal(skillNames: string[], keywords: string[]): MarketSignal | null {
  const skills = Array.from(new Set(skillNames.map(normalizeSkillName).filter(Boolean))).slice(0, 8);
  if (skills.length === 0) return null;
  const role = keywords[0] ?? "your field";
  return {
    sourceId: "lightcast",
    kind: "skill_trend",
    title: `In-demand skills mapped to ${role} (Lightcast Open Skills): ${skills.slice(0, 6).join(", ")}`,
    url: "https://lightcast.io/open-skills",
    skills,
    regions: [],
    sectors: [],
  };
}

export class LightcastSkillsSource implements SignalSource {
  readonly id = "lightcast";
  readonly name = "Lightcast Open Skills";
  readonly capabilities: DataSourceCapability[] = ["skill_trend"];
  readonly cost = "free" as const;
  readonly isConfigured: boolean;

  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
  ) {
    this.isConfigured = Boolean(clientId && clientSecret);
  }

  /** Cached OAuth bearer token; refreshes ~60s before expiry. */
  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    if (!this.clientId || !this.clientSecret) return null;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
        scope: "emsi_open",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }

  async fetchSignals(query: SignalQuery): Promise<MarketSignal[]> {
    if (!this.isConfigured) return [];
    try {
      const token = await this.getToken();
      if (!token) return [];

      const terms = query.keywords.slice(0, 3).filter(Boolean);
      if (terms.length === 0) return [];

      // The per-term lookups are independent — run them concurrently (one slow or
      // failing term shouldn't serialize or sink the others).
      const perTerm = await Promise.all(
        terms.map(async (term) => {
          try {
            const params = new URLSearchParams({ q: term, limit: "5", fields: "id,name" });
            const res = await fetch(`${SKILLS_API}?${params}`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) return [];
            const data = (await res.json()) as { data?: Array<{ name?: string }> };
            return (data.data ?? []).map((s) => s.name).filter((n): n is string => Boolean(n));
          } catch {
            return [];
          }
        }),
      );

      const signal = skillsToSignal(perTerm.flat(), query.keywords);
      return signal ? [signal] : [];
    } catch {
      return [];
    }
  }
}
