import type { StoredCareerReport } from "@/lib/career-report/schema";

/** The full Career Intelligence Report. Lives on its own page (/dashboard/report) so the
 *  dashboard can stay a launchpad — it shows only a compact summary that links here. */
export function CareerReportView({ report }: { report: StoredCareerReport }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="font-medium">Career summary</h3>
        <p className="mt-2 text-sm text-muted-foreground">{report.career_summary}</p>
      </div>
      <ReportList title="Strengths" items={report.strengths} />
      <ReportList title="Missing skills" items={report.missing_skills} />
      <div className="rounded-md border p-4">
        <h3 className="font-medium">Target role fit</h3>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          Rating: {report.target_role_fit?.rating ?? "unclear"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{report.target_role_fit?.explanation}</p>
      </div>
      <ReportList title="Recommended next steps" items={report.recommended_actions} />
      <ReportList title="Learning recommendations" items={report.recommended_learning_path} />
      <p className="text-xs text-muted-foreground">
        Generated{" "}
        {report.generated_at ? new Date(report.generated_at).toLocaleString() : "recently"}
        {report.model_name ? ` using ${report.model_name}` : ""}.
      </p>
    </div>
  );
}

function ReportList({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; detail: string }>;
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={`${title}-${item.title}`} className="text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
