"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GithubPublishPanel } from "@/components/portfolio/github-publish";
import { HistoryCapture } from "@/components/evidence/history-capture";
import {
  checkIntegrity,
  deleteItem,
  exportPortfolio,
  importPortfolio,
  reorderItems,
  saveItem,
  seedFromEvidence,
  setItemPublished,
  setSitePublished,
  syncFromEvidence,
  updateSiteSettings,
} from "@/app/dashboard/portfolio/actions";
import {
  findDuplicates,
  type IntegrityFinding,
  type PortfolioItemView,
  type PortfolioSiteView,
} from "@careeros/portfolio";

import { DeveloperModal } from "./developer-modal";
import { IntegrityPanel } from "./integrity-panel";
import { ItemCard } from "./item-card";
import { ItemEditor } from "./item-editor";
import { Modal } from "./modal";
import { SettingsModal } from "./settings-modal";
import { SECTION_KEYS, SECTION_META, emptyForm, toForm, type ItemForm } from "./shared";

// Portfolio CMS — the orchestrator. State + server-action wiring live here; the list rows,
// editor, settings, developer and host dialogs are their own files (see ./*).
export function PortfolioManager({
  site,
  handle,
  isPublished,
  items,
}: {
  site: PortfolioSiteView;
  handle: string;
  isPublished: boolean;
  items: PortfolioItemView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("project");
  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Integrity: deterministic duplicate findings recompute for free on every change; the AI
  // pass (contradictions / timeline / anomalies) is on demand. The AI verdict is keyed to the
  // exact content it ran against, so a later edit invalidates it — derived, no effect needed.
  const [checking, setChecking] = useState(false);
  const [ai, setAi] = useState<{ key: string; findings: IntegrityFinding[]; note: string | null } | null>(null);
  const dupFindings = useMemo(() => findDuplicates(items), [items]);
  const titleById = useMemo(() => new Map(items.map((i) => [i.id, i.title])), [items]);
  const itemsKey = useMemo(
    () => items.map((i) => `${i.id}:${i.title}:${i.subtitle ?? ""}:${i.dateRange ?? ""}`).join("|"),
    [items],
  );
  const aiValid = ai && ai.key === itemsKey ? ai : null;
  const allFindings = [...dupFindings, ...(aiValid?.findings ?? [])];

  function runAiCheck() {
    setChecking(true);
    startTransition(async () => {
      const r = await checkIntegrity();
      setChecking(false);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAi({
        key: itemsKey,
        findings: r.findings,
        note: r.aiUnavailable
          ? "Connect an AI provider in Settings to run the Fadi AI check."
          : (r.aiError ?? null),
      });
    });
  }

  const grouped: Record<string, PortfolioItemView[]> = {};
  for (const it of items) (grouped[it.section] ??= []).push(it);
  const publicUrl = `/p/${handle}`;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok && r.message) setError(r.message);
      else router.refresh();
    });
  }

  function togglePublishSite() {
    run(() => setSitePublished({ published: !isPublished }));
  }
  // The seed failed because there's no CV/LinkedIn on file — offer capture inline.
  const needsHistory = Boolean(error && /career history/i.test(error));

  function seed() {
    run(() => seedFromEvidence());
  }
  function sync() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await syncFromEvidence();
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setNotice(
        r.added > 0
          ? `Added ${r.added} item${r.added === 1 ? "" : "s"} from your evidence.`
          : "You're all synced — no new evidence to add.",
      );
      router.refresh();
    });
  }

  function doExport() {
    setError(null);
    startTransition(async () => {
      const r = await exportPortfolio();
      if (!r.ok) return setError(r.message);
      const blob = new Blob([JSON.stringify(r.payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${handle}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setError("That file isn't valid JSON.");
      return;
    }
    const mode = confirm("OK = ADD to existing content.\nCancel = REPLACE all items (destructive).")
      ? "merge"
      : confirm("Really REPLACE all current items? This cannot be undone.")
        ? "replace"
        : null;
    if (!mode) return;
    startTransition(async () => {
      const r = await importPortfolio({ payload: payload as never, mode });
      if (!r.ok) setError(r.message);
      else router.refresh();
    });
  }

  function saveEditing(form: ItemForm) {
    run(async () => {
      const r = await saveItem({
        id: form.id,
        section: form.section,
        title: form.title,
        subtitle: form.subtitle,
        location: form.location,
        dateRange: form.dateRange,
        description: form.description,
        bullets: form.bulletsText.split("\n").map((b) => b.trim()).filter(Boolean),
        roles: form.roles,
        tag: form.tag,
        url: form.url,
        imageUrl: form.imageUrl,
        gallery: form.galleryText.split("\n").map((g) => g.trim()).filter(Boolean),
      });
      if (r.ok) setEditing(null);
      return r;
    });
  }

  // Native drag reorder within the active section.
  function onDropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const rows = grouped[activeTab] ?? [];
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null);
    run(() => reorderItems({ ids }));
  }

  const rows = grouped[activeTab] ?? [];
  const meta = SECTION_META[activeTab];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:px-10">
      {/* Header — mirrors the original portfolio CMS */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Portfolio CMS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Manage content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit, and remove anything on your portfolio. Changes appear live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
              isPublished
                ? "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
          <Button size="sm" variant="outline" onClick={togglePublishSite} disabled={pending}>
            {isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-4" /> Preview site
          </Button>
          <Button size="sm" variant="outline" onClick={() => setGithubOpen(true)}>
            <Rocket className="size-4" /> Host on the web
          </Button>
          {items.length > 0 && (
            <Button size="sm" variant="outline" onClick={sync} disabled={pending}>
              <Sparkles className="size-4" /> Sync evidence
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={doExport} disabled={pending || items.length === 0}>
            <Download className="size-4" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
            <Upload className="size-4" /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <Button size="sm" variant="outline" onClick={() => setDevOpen(true)}>
            <Code2 className="size-4" /> API &amp; SDK
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" /> Settings
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          {notice}
        </div>
      )}

      {items.length > 0 && (
        <IntegrityPanel
          findings={allFindings}
          checking={checking}
          aiRan={Boolean(aiValid)}
          aiNote={aiValid?.note ?? null}
          titleOf={(id) => titleById.get(id)}
          onRunAi={runAiCheck}
        />
      )}

      {items.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6">
          <p className="text-lg font-semibold">Let&apos;s build your portfolio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No blank canvas — Fadi turns your career data into a site in a few clicks.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            <li className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-sm font-medium">
                <span className="text-amber-400">1.</span> Add your content
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Seed it from your Fadi evidence — projects, experience, skills.
              </p>
              <Button size="sm" onClick={seed} disabled={pending} className="mt-3">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Seed from evidence
              </Button>
            </li>
            <li className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-sm font-medium">
                <span className="text-amber-400">2.</span> Pick a look
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a template in Settings — Noir &amp; Gold, Aurora, or Minimal.
              </p>
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)} className="mt-3">
                <Settings className="size-4" /> Choose template
              </Button>
            </li>
            <li className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-sm font-medium">
                <span className="text-amber-400">3.</span> Publish
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Go live at your handle — or export it to host on your own domain.
              </p>
              <Button size="sm" variant="outline" onClick={togglePublishSite} disabled={pending} className="mt-3">
                <Eye className="size-4" /> Publish site
              </Button>
            </li>
          </ol>

          {/* Seeding needs a CV on file. Rather than sending the user to Evidence (and
              from there to Profile), capture it here and retry the seed immediately —
              this is the same component the Evidence screen uses. */}
          {needsHistory ? (
            <div className="mt-4">
              <HistoryCapture
                title="First, add your career history"
                hint="Your portfolio is built from your real experience. Upload or paste your CV here and Fadi will fill it in — no need to leave this page."
                onSaved={() => {
                  setError(null);
                  seed();
                }}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1">
        {SECTION_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveTab(k)}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
              activeTab === k
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {SECTION_META[k].label}
            {grouped[k]?.length ? (
              <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                {grouped[k].length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Section header + add */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{meta.label}</h2>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <Button size="sm" onClick={() => setEditing(emptyForm(activeTab))} disabled={pending}>
          <Plus className="size-4" /> Add {meta.label.replace(/s$/, "").toLowerCase()}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/10 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No {meta.label.toLowerCase()} yet. Click “Add” to create the first one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              dragging={dragId === item.id}
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => setDragId(null)}
              onDrop={() => onDropOn(item.id)}
              onEdit={() => setEditing(toForm(item))}
              onDelete={() => {
                if (confirm(`Delete “${item.title}”?`)) run(() => deleteItem({ id: item.id }));
              }}
              onTogglePublish={() =>
                run(() => setItemPublished({ id: item.id, published: !item.isPublished }))
              }
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemEditor
          initial={editing}
          pending={pending}
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          site={site}
          handle={handle}
          pending={pending}
          onClose={() => setSettingsOpen(false)}
          onSave={(input) => {
            run(async () => {
              const r = await updateSiteSettings(input);
              if (r.ok) setSettingsOpen(false);
              return r;
            });
          }}
        />
      )}

      {devOpen && (
        <DeveloperModal handle={handle} published={isPublished} onClose={() => setDevOpen(false)} />
      )}

      {githubOpen && (
        <Modal title="Host on the web" onClose={() => setGithubOpen(false)}>
          <p className="mb-4 text-sm text-muted-foreground">
            Publish your full portfolio — hero, animations and case-study pages — to GitHub Pages
            and host it for free on your own account.
          </p>
          <GithubPublishPanel isPublished={isPublished} />
        </Modal>
      )}
    </div>
  );
}
