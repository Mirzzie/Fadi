import { evidenceRelevance, toEvidenceView, type TrackTerms } from "@/lib/evidence/pool";
import type { EvidenceItem } from "@careeros/database";

export type Selection = {
  factId: string;
  mode: "auto" | "include" | "exclude";
  keepWording: boolean;
  sortOrder: number;
};
export type SelectedRecord = {
  factId: string;
  evidenceId: string;
  kind: string;
  title: string;
  organization: string | null;
  period: string | null;
  detail: string;
  metrics: string | null;
  attribution: string;
  tags: string[];
  marketTags: string[];
  updatedAt: string;
  mode: Selection["mode"];
  keepWording: boolean;
  sortOrder: number;
  score: number;
  matched: string[];
};
const kinds = new Set([
  "experience",
  "project",
  "achievement",
  "skill",
  "education",
  "certification",
]);
export function selectCareerRecords(
  rows: EvidenceItem[],
  direction: Selection[],
  application: Selection[],
  terms: TrackTerms,
  maxAuto = 8
) {
  const choices = new Map(direction.map((s) => [s.factId, s]));
  for (const s of application) choices.set(s.factId, s);
  const eligible = rows.filter(
    (r) => r.isCanonical && r.reviewStatus === "accepted" && kinds.has(r.kind)
  );
  const counts = new Map<string, number>();
  for (const row of eligible)
    counts.set(row.factId ?? row.id, (counts.get(row.factId ?? row.id) ?? 0) + 1);
  // A corrupt group cannot safely provide a single identity. Hold all its heads for review.
  const available: SelectedRecord[] = eligible
    .filter((r) => counts.get(r.factId ?? r.id) === 1)
    .map((r) => {
      const factId = r.factId ?? r.id;
      const choice = choices.get(factId);
      const rank = evidenceRelevance(toEvidenceView(r), terms);
      return {
        factId,
        evidenceId: r.id,
        kind: r.kind,
        title: r.title,
        organization: r.organization,
        period: r.period,
        detail: r.detail,
        metrics: r.metrics,
        attribution: r.attribution,
        tags: r.tags,
        marketTags: r.marketTags,
        updatedAt: r.updatedAt.toISOString(),
        mode: choice?.mode ?? "auto",
        keepWording: choice?.keepWording ?? false,
        sortOrder: choice?.sortOrder ?? 0,
        score: rank.score,
        matched: rank.matched,
      };
    });
  const order = (a: SelectedRecord, b: SelectedRecord) =>
    a.sortOrder - b.sortOrder || b.score - a.score || a.factId.localeCompare(b.factId);
  const included = available.filter((r) => r.mode === "include").sort(order);
  const automatic = available
    .filter((r) => r.mode === "auto")
    .sort(order)
    .slice(0, maxAuto);
  // Explicit includes are never removed by the automatic context limit.
  return { available, selected: [...included, ...automatic], held: rows.length - available.length };
}

export function formatCareerRecords(rows: SelectedRecord[]): string {
  if (!rows.length) return "";
  return [
    "SELECTED CAREER RECORDS — marked accepted in Fadi, not independently verified. Use only these facts; selection is not proof of mastery.",
    ...rows.map(
      (r) =>
        `[${r.factId}] ${r.kind}: ${r.title}${r.organization ? ` @ ${r.organization}` : ""}${r.period ? ` (${r.period})` : ""}\n${r.detail}\nAttribution: ${r.attribution}\nRecorded skills: ${r.tags.join(", ")}${r.metrics ? `\nRecorded results: ${r.metrics}` : ""}${r.keepWording ? "\nKEEP WORDING: preserve this record's description verbatim." : ""}`
    ),
  ].join("\n\n");
}
