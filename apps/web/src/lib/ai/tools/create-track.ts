import type { FadiTool, FadiToolResult } from "./types";

/**
 * create_career_track — the proof that you can DRIVE FadiOS by speaking. When the
 * user says "start a new direction as a data analyst", Fadi calls this; it creates
 * and activates a new career track (the same mutation as the Create-track dialog),
 * and the chat client refreshes so the menu-bar switcher + dashboard follow.
 *
 * Honest by design: a track needs a name, target role, and goal — if any is missing
 * Fadi asks for it instead of creating a half-baked direction.
 */

const INTENTS = ["career", "exploration", "trial", "part_time"] as const;
type Intent = (typeof INTENTS)[number];

export type TrackInput = {
  label: string;
  targetRole: string;
  careerGoal: string;
  domain?: string;
  location?: string;
  experienceLevel?: string;
  intent: Intent;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function optStr(v: unknown): string | undefined {
  return str(v) || undefined;
}
function normIntent(v: unknown): Intent {
  const s = str(v).toLowerCase();
  return (INTENTS as readonly string[]).includes(s) ? (s as Intent) : "career";
}

export type ValidateTrackResult =
  | { ok: true; input: TrackInput }
  | { ok: false; missing: string[] };

/** Pure pre-check (testable): a track must have a name, target role, and goal. */
export function validateTrackArgs(args: Record<string, unknown>): ValidateTrackResult {
  const label = str(args.label);
  const targetRole = str(args.targetRole);
  const careerGoal = str(args.careerGoal);

  const missing: string[] = [];
  if (!label) missing.push("a short name for the direction");
  if (!targetRole) missing.push("the target role");
  if (!careerGoal) missing.push("what you want from it (your goal)");
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    input: {
      label,
      targetRole,
      careerGoal,
      domain: optStr(args.domain),
      location: optStr(args.location),
      experienceLevel: optStr(args.experienceLevel),
      intent: normIntent(args.intent),
    },
  };
}

export const createTrackTool: FadiTool = {
  name: "create_career_track",
  description:
    "Create and switch to a NEW career direction/track when the user wants to pursue a different role or path (e.g. 'start a new direction as a data analyst', 'I want to switch into product management'). Gather a short name, the target role, and their goal first.",
  parameters: {
    type: "object",
    properties: {
      label: { type: "string", description: "Short user-facing name, e.g. 'Break into Data Analytics'." },
      targetRole: { type: "string", description: "The role they're targeting, e.g. 'Data Analyst'." },
      careerGoal: { type: "string", description: "What they want from this direction (their goal/timeline)." },
      domain: { type: "string", description: "Industry/field, e.g. 'Finance', 'Healthcare', 'Information Technology'." },
      location: { type: "string", description: "Preferred location, e.g. 'Dublin, Ireland' or 'Remote'." },
      experienceLevel: { type: "string", description: "student | entry | junior | mid | senior | lead, if known." },
      intent: {
        type: "string",
        enum: [...INTENTS],
        description: "Why: a committed career change, exploration, a trial, or part-time/gig.",
      },
    },
    required: ["label", "targetRole", "careerGoal"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const v = validateTrackArgs(args);
    if (!v.ok) {
      return {
        summary: `Before I start that direction I need ${v.missing.join(", ")}. Tell me and I'll set it up.`,
        view: "none",
      };
    }

    // Dynamic import keeps the pure validator + tool spec import-safe for tests.
    const { createCareerProfilesRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");

    const track = await createCareerProfilesRepository(getDatabase()).createForUser(ctx.userId, {
      targetRole: v.input.targetRole,
      careerGoal: v.input.careerGoal,
      location: v.input.location ?? null,
      experienceLevel: v.input.experienceLevel ?? null,
      label: v.input.label,
      domain: v.input.domain ?? null,
      intent: v.input.intent,
      roleCluster: null,
      makeActive: true,
    });

    return {
      summary: `Done — I created your new direction "${v.input.label}" (${v.input.targetRole}) and switched you to it. Your jobs, documents, and plan now follow this track.`,
      view: "track_created",
      data: { trackId: track.id, label: v.input.label, targetRole: v.input.targetRole },
    };
  },
};
