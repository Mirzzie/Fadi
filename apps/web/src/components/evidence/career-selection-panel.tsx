"use client";
import { useEffect, useState } from "react";
import {
  loadCareerSelectionAction,
  saveCareerSelectionAction,
} from "@/app/dashboard/evidence/selection-actions";
import type { SelectedRecord } from "@/lib/career/selection";

type Data = Awaited<ReturnType<typeof loadCareerSelectionAction>>;
type PanelProps = {
  directionId?: string | null;
  applicationId?: string | null;
  jobId?: string | null;
};
export function CareerSelectionPanel(props: PanelProps) {
  return (
    <SelectionPanel
      key={`${props.directionId ?? "active"}:${props.applicationId ?? ""}:${props.jobId ?? ""}`}
      {...props}
    />
  );
}
function SelectionPanel({ directionId, applicationId, jobId }: PanelProps) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let current = true;
    loadCareerSelectionAction({ directionId, applicationId, jobId })
      .then((value) => {
        if (current) setData(value);
      })
      .catch(() => {
        if (current) setError("Could not load your choices. Close and reopen to retry.");
      });
    return () => {
      current = false;
    };
  }, [directionId, applicationId, jobId, open]);
  async function save(
    record: SelectedRecord,
    mode: "auto" | "include" | "exclude" | "inherit",
    keepWording = record.keepWording
  ) {
    if (!data) return;
    const previous = data;
    setSaving(true);
    setError("");
    if (mode !== "inherit") {
      setData({
        ...data,
        available: data.available.map((item) =>
          item.factId === record.factId ? { ...item, mode, keepWording } : item
        ),
      });
    }
    try {
      setData(
        await saveCareerSelectionAction(data.scope, {
          factId: record.factId,
          mode,
          keepWording,
          sortOrder: record.sortOrder,
        })
      );
    } catch {
      setData(previous);
      setError("Your change was not confirmed. Reopen this panel to reload before trying again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <details
      className="mx-auto my-4 w-full max-w-5xl rounded-xl border p-4"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setData(null);
          setError("");
        }
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer font-medium">Choose what goes into new documents</summary>
      <p className="my-2 text-sm text-muted-foreground">
        Auto selects up to eight relevant records. Include always keeps an item; Exclude leaves it
        out. These choices apply to new résumé, cover letter and email drafts. Existing documents
        keep their saved content.
      </p>
      {error && (
        <p role="alert" className="my-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading choices…</p>}
      {data && (
        <>
          <p className="mb-3 text-sm font-medium">
            {data.label} · {data.selected.length} selected
          </p>
          {!applicationId && jobId && (
            <p className="mb-3 text-sm text-muted-foreground">
              These are direction defaults. Generate your first document to create this application,
              then return here for application-specific choices.
            </p>
          )}
          {!data.available.length && (
            <p className="text-sm">
              Add and review your career records in Evidence first. Imported CV text alone is not
              used as approved history.
            </p>
          )}
          <fieldset disabled={saving || Boolean(error)} className="space-y-2">
            <legend className="sr-only">Career records</legend>
            {data.available.map((record) => (
              <div key={record.factId} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{record.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[record.kind, record.organization, record.period]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · {data.selected.includes(record.factId) ? "Selected" : "Not selected"}
                    </p>
                  </div>
                  <select
                    aria-label={`Use ${record.title}`}
                    value={record.mode}
                    onChange={(event) =>
                      void save(record, event.target.value as SelectedRecord["mode"])
                    }
                    className="rounded-md border bg-background p-2 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="include">Include</option>
                    <option value="exclude">Exclude</option>
                  </select>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                  {["experience", "project"].includes(record.kind) && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={record.keepWording}
                        onChange={(event) => void save(record, record.mode, event.target.checked)}
                      />
                      Keep my description in the résumé
                    </label>
                  )}
                  {data.overrides.includes(record.factId) && (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void save(record, "inherit")}
                    >
                      {applicationId ? "Use direction default" : "Reset choice"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </fieldset>
          {saving && (
            <p role="status" className="mt-2 text-sm">
              Saving…
            </p>
          )}
        </>
      )}
    </details>
  );
}
