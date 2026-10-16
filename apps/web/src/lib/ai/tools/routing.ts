/**
 * WHICH TOOLS THIS TURN ACTUALLY NEEDS.
 *
 * Every chat turn shipped the whole catalogue — thirty tools, whether the person was reading a
 * job advert or editing a résumé. That costs tokens on every message, and it makes the model
 * choose between thirty similarly-named options when three were plausible, which is how an
 * assistant ends up running a lab check because someone asked about their CV.
 *
 * The rule is deliberately dull, because a clever router that drops the one tool the person
 * needed is worse than sending a few extra: a small core is always available, the area they are
 * standing in is always available, and any tool whose own words match what they just typed is
 * added. Everything else waits until it is relevant.
 */

export type RoutableTool = { name: string; description?: string };

/** Always available: the questions a person asks anywhere. */
const CORE = new Set([
  "open_page",
  "get_career_updates",
  "get_relevant_evidence",
  "get_performance",
  "get_momentum_reflection",
]);

/** The tools that belong to each place in the product. */
const BY_PLACE: [RegExp, string[]][] = [
  [
    /\/dashboard\/jobs/,
    ["search_jobs", "evaluate_fit", "scan_company_jobs", "get_rejection_patterns"],
  ],
  [
    /\/dashboard\/applications/,
    [
      "evaluate_fit",
      "prep_interview",
      "company_interview_brief",
      "draft_referral_outreach",
      "get_rejection_patterns",
    ],
  ],
  [/\/dashboard\/documents/, ["get_relevant_evidence", "evaluate_fit"]],
  [/\/dashboard\/evidence/, ["get_relevant_evidence", "get_career_updates"]],
  [/\/dashboard\/portfolio/, ["get_relevant_evidence"]],
  [
    /\/dashboard\/interview/,
    [
      "prep_interview",
      "mock_interview_questions",
      "score_interview_answer",
      "answer_behavioral_question",
      "company_interview_brief",
    ],
  ],
  [
    /\/dashboard\/learning/,
    [
      "plan_project",
      "project_status",
      "complete_project_step",
      "propose_lab_action",
      "inspect_machine",
      "lab_capacity",
      "start_lab_machine",
      "build_lab_image",
    ],
  ],
  [/\/dashboard\/network/, ["draft_referral_outreach", "scan_company_jobs"]],
];

/** Words that make a tool obviously relevant however far from its screen the person is. */
const CUES: [RegExp, string[]][] = [
  [/\bjobs?\b|vacanc|hiring|role|position|advert/i, ["search_jobs", "evaluate_fit"]],
  // Changes said in plain words. None of these had a cue, so "log that I applied to Stripe"
  // offered only read tools and the model ran a fit check instead (found by voice, 5 Oct 2026).
  [
    /\b(?:i\s+)?applied\b|\blog\b.*\b(?:application|applied)|\btrack\b.*\b(?:application|role|job)|\bmark\b.*\bapplied/i,
    ["track_application", "set_application_status"],
  ],
  // An application that is already tracked moving on. Same lesson: no cue, no tool.
  [
    /\b(?:got|have|landed)\b.*\b(?:interview|offer)\b|\brejected\b|turned (?:me )?down|\bwithdr[ae]w|\bstatus\b|\bmark\b.*\bas\b/i,
    ["set_application_status"],
  ],
  [
    /\b(?:save|keep|shortlist|unsave|bookmark)\b|\bsaved (?:roles?|jobs?)\b|\bnot interested\b|\bdrop\b.*\b(?:role|job)\b/i,
    ["save_job", "unsave_job"],
  ],
  [
    /\btoday\b|\bbrief me\b|\bwhat should i (?:do|work on)\b|\bwaiting (?:for|on) me\b|\bwhat'?s (?:on|waiting)\b/i,
    ["today_brief"],
  ],
  [
    /\bnext step\b|\bwhere was i\b|\bwhat'?s next\b|\bwhat now\b/i,
    ["project_status", "today_brief"],
  ],
  [
    /\badd\b.*\b(?:record|career|experience|achievement|certific|course|project)|\bi (?:passed|earned|completed|got certified|led|built|shipped)\b/i,
    ["add_experience"],
  ],
  [
    /\bflagships?\b|\bbig projects?\b|\bwhat should i build\b/i,
    ["list_flagships", "take_on_flagship"],
  ],
  [
    /\b(?:draft|write|tailor|generate|make)\b.*\b(?:cv|r[ée]sum[ée]|cover letter|cold email)\b/i,
    ["generate_document"],
  ],
  [
    /\b(?:new|add|create|switch to)\b.*\b(?:direction|track|career path)\b/i,
    ["create_career_track"],
  ],
  [
    /\binterview|star\b|behavioural|behavioral|question/i,
    ["prep_interview", "mock_interview_questions", "answer_behavioral_question", "interview_practice"],
  ],
  // A live spoken practice loop: starting one, or answering/continuing one.
  [
    /\bpractice\b.*\binterview|\binterview me\b|ask me (a|another) question|next question|my answer\b/i,
    ["interview_practice"],
  ],
  [
    /\bcv\b|\bcvs\b|r[ée]sum[ée]|cover letter|document/i,
    ["get_relevant_evidence", "list_documents", "read_document"],
  ],
  [
    /\blab\b|machine|container|vm\b|docker/i,
    ["inspect_machine", "propose_lab_action", "lab_capacity"],
  ],
  [
    /\bproject\b|practi[cs]e|learn|course|skill gap/i,
    ["plan_project", "project_status", "complete_project_step"],
  ],
  [/\brejection|ghosted|no reply|feedback/i, ["get_rejection_patterns", "get_performance"]],
  [/\brefer|network|connection|outreach/i, ["draft_referral_outreach"]],
  [/\bcompany\b|employer|they do|about them/i, ["scan_company_jobs", "company_interview_brief"]],
];

/** How many tools one turn may carry. Generous enough to be safe, small enough to matter. */
export const MAX_TOOLS_PER_TURN = 14;

export function toolsForTurn<T extends RoutableTool>(
  all: T[],
  turn: { pathname?: string | null; message?: string | null }
): T[] {
  const wanted = new Set<string>(CORE);

  const path = turn.pathname ?? "";
  for (const [pattern, names] of BY_PLACE) {
    if (pattern.test(path)) names.forEach((n) => wanted.add(n));
  }

  const said = turn.message ?? "";
  for (const [pattern, names] of CUES) {
    if (pattern.test(said)) names.forEach((n) => wanted.add(n));
  }

  const picked = all.filter((tool) => wanted.has(tool.name));
  // Nothing matched — an opening "hello" from the dashboard, say. Sending the core alone would
  // strand a first question, so fall back to everything rather than guess.
  if (picked.length <= CORE.size && !path && !said.trim()) return all;
  return picked.slice(0, MAX_TOOLS_PER_TURN);
}
