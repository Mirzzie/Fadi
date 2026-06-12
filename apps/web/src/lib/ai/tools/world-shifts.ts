import "server-only";

import { createCareerProfilesRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getMarketIntelligence } from "@/lib/data-sources/service";
import {
  formatShiftsForPrompt,
  relevantShiftsFor,
  WORLD_SHIFTS_VERSION,
} from "@/lib/intelligence/world-shifts";

import type { ScoutTool, ScoutToolResult } from "./types";

/**
 * Global-shifts advisory: the curated structural-forces catalog ranked for
 * this user's field, plus live geopolitical/market news scored against their
 * profile. Honest by construction — catalog entries carry sources + review
 * dates, live items come from real feeds, and nothing here predicts. Scout's
 * job on top: scenario-frame ("if this persists, X faces pressure — here's
 * the hedge"), never doom.
 */
export const getWorldShifts: ScoutTool = {
  name: "get_world_shifts",
  description:
    "Get the structural global forces (AI disruption, geopolitical fragmentation, inflation, demographics, climate, shock-resilience) ranked for the user's field, plus live news signals scored against their profile. Use when the user asks whether world events should change their career strategy, whether their field is safe/future-proof, about wars/inflation/AI/climate and their career, or for a career direction stress-test.",
  parameters: { type: "object", properties: {} },

  async execute(_args, ctx): Promise<ScoutToolResult> {
    const track = await createCareerProfilesRepository(getDatabase()).getActiveForUser(ctx.userId);
    if (!track?.targetRole) {
      return {
        summary:
          "The user has no active career direction set — suggest setting one first so this analysis can be specific.",
        view: "none",
      };
    }

    const ranked = relevantShiftsFor(track.targetRole, track.domain);

    let liveNews: Array<{ title: string; url?: string; reason: string }> = [];
    try {
      const intel = await getMarketIntelligence(
        {
          targetRole: track.targetRole,
          skills: [],
          skillGaps: [],
          region: track.location,
          domain: track.domain,
        },
        { limit: 4 },
      );
      liveNews = intel.signals
        .filter((s) => s.kind === "news")
        .map((s) => ({ title: s.title, url: s.url, reason: s.reasons[0] ?? "" }));
    } catch {
      // Live feed down — the catalog still stands on its own.
    }

    const pressures = ranked.filter((r) => r.relation === "pressure").length;

    return {
      summary: `Structural forces ranked for "${track.targetRole}" (catalog v${WORLD_SHIFTS_VERSION}; ${pressures} directly pressure this field):\n${formatShiftsForPrompt(ranked)}${
        liveNews.length > 0
          ? `\nLive signals: ${liveNews.map((n) => n.title).join("; ")}`
          : "\nNo live news signals cleared the relevance bar right now."
      }\nFrame this as positioning, not prophecy: pair every pressure with the hedge and ONE controllable next move.`,
      view: "world_shifts",
      data: {
        version: WORLD_SHIFTS_VERSION,
        shifts: ranked.slice(0, 4).map(({ shift, relation }) => ({
          id: shift.id,
          name: shift.name,
          relation,
          implication: shift.careerImplication,
          positioningMove: shift.positioningMove,
          sources: shift.sources,
        })),
        liveNews,
      },
    };
  },
};
