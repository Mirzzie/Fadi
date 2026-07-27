"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GithubPublishPanel } from "@/components/portfolio/github-publish";
import { HistoryCapture } from "@/components/evidence/history-capture";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteItem,
  enhanceDescription,
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
import { isVideoUrl, mediaUploadConfigured, uploadPortfolioMedia } from "@/lib/portfolio/upload";
import type { PortfolioItemView, PortfolioSiteView } from "@/lib/portfolio/view";

const SECTION_KEYS = [
  "project",
  "experience",
  "education",
  "certification",
  "skill",
  "hobby",
  "custom",
] as const;

const SECTION_META: Record<string, { label: string; description: string }> = {
  project: { label: "Projects", description: "Case studies & featured work" },
  experience: { label: "Experience", description: "Jobs, internships, consulting" },
  education: { label: "Education", description: "Degrees & schooling" },
  certification: { label: "Certifications", description: "AWS, security, courses" },
  skill: { label: "Skills", description: "Tools, tech, and disciplines" },
  hobby: { label: "Hobbies & Interests", description: "Personal interests" },
  custom: { label: "Custom Section", description: "Anything else — awards, talks, etc." },
};

const ROLES = [
  { value: "support", label: "IT Support" },
  { value: "cloud", label: "Cloud" },
  { value: "security", label: "Security" },
];
const RESUME_KEYS = [
  { key: "default", label: "Default" },
  { key: "support", label: "IT Support" },
  { key: "cloud", label: "Cloud" },
  { key: "security", label: "Security" },
];

type ItemForm = {
  id?: string;
  section: string;
  title: string;
  subtitle: string;
  location: string;
  dateRange: string;
  tag: string;
  url: string;
  description: string;
  bulletsText: string;
  imageUrl: string;
  galleryText: string;
  roles: string[];
};

function emptyForm(section = "project"): ItemForm {
  return {
    section,
    title: "",
    subtitle: "",
    location: "",
    dateRange: "",
    tag: "",
    url: "",
    description: "",
    bulletsText: "",
    imageUrl: "",
    galleryText: "",
    roles: [],
  };
}

function toForm(item: PortfolioItemView): ItemForm {
  return {
    id: item.id,
    section: item.section,
    title: item.title,
    subtitle: item.subtitle ?? "",
    location: item.location ?? "",
    dateRange: item.dateRange ?? "",
    tag: item.tag ?? "",
    url: item.url ?? "",
    description: item.description ?? "",
    bulletsText: (item.bullets ?? []).join("\n"),
    imageUrl: item.imageUrl ?? "",
    galleryText: (item.gallery ?? []).join("\n"),
    roles: item.roles ?? [],
  };
}

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

/* --------------------------------- developer modal --------------------------------- */
function DeveloperModal({
  handle,
  published,
  onClose,
}: {
  handle: string;
  published: boolean;
  onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-fadi-host";
  const api = `${origin}/api/portfolio/${handle}`;
  const [copied, setCopied] = useState<string | null>(null);

  const snippets: { label: string; code: string }[] = [
    { label: "REST API", code: api },
    {
      label: "Fetch (any site)",
      code: `const res = await fetch("${api}");\nconst portfolio = await res.json();\n// { site, items }`,
    },
    {
      label: "Embed (drop-in, zero JS)",
      code: `<div id="portfolio"></div>\n<script src="${origin}/portfolio.js"\n        data-handle="${handle}" data-target="#portfolio"></script>`,
    },
    {
      label: "SDK (render or read)",
      code: `<script src="${origin}/portfolio.js"></script>\n<script>\n  // render into an element:\n  FadiPortfolio.mount("${handle}", "#portfolio");\n  // …or just get the data:\n  FadiPortfolio.get("${handle}").then(console.log);\n</script>`,
    },
    {
      label: "React",
      code: `import { useEffect, useState } from "react";\n\nexport function Portfolio() {\n  const [data, setData] = useState(null);\n  useEffect(() => {\n    fetch("${api}").then((r) => r.json()).then(setData);\n  }, []);\n  if (!data) return null;\n  return <pre>{JSON.stringify(data, null, 2)}</pre>;\n}`,
    },
  ];

  function copy(code: string, label: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    });
  }

  const [busy, setBusy] = useState(false);

  function save(html: string) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Live embed — tiny file, always fresh; needs Fadi online + published.
  function downloadEmbed() {
    save(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${handle} — Portfolio</title>
</head>
<body style="margin:0;background:#0a0a0b">
<div id="portfolio"></div>
<script src="${origin}/portfolio.js" data-handle="${handle}" data-target="#portfolio"></script>
</body>
</html>
`);
  }

  // Static snapshot — self-contained (SDK + data baked in). Works on GitHub Pages
  // and any static host with NO server and even if Fadi is offline. Re-export to
  // refresh. This is the "host it anywhere on your own domain" option.
  async function downloadSnapshot() {
    setBusy(true);
    try {
      const [sdk, res] = await Promise.all([
        fetch(`${origin}/portfolio.js`).then((r) => r.text()),
        fetch(api),
      ]);
      if (!res.ok) throw new Error("Publish your site first, then export.");
      const data = await res.json();
      // Inlining into a <script> is unsafe raw: any "</script>" would close the tag early
      // and break the page. Escape `<` in the DATA, and `</script` in the SDK — the SDK's
      // own doc comment contains example </script> tags, so inlining it raw broke the page
      // (FadiPortfolio never defined, nothing rendered). Verified by rendering offline.
      const safeData = JSON.stringify(data).replace(/</g, "\\u003c");
      const safeSdk = sdk.replace(/<\/(script)/gi, "<\\/$1");
      save(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${(data.site?.profile?.name || data.site?.title || handle)} — Portfolio</title>
</head>
<body style="margin:0;background:#0a0a0b">
<div id="portfolio"></div>
<script>${safeSdk}</script>
<script>FadiPortfolio.mountData(${safeData}, "#portfolio");</script>
</body>
</html>
`);
    } catch (e) {
      setCopied(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="API & SDK — use this portfolio on any website" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your portfolio is a headless content source. Any website — React, Astro, WordPress, plain
          HTML — can read it over this public, CORS-open JSON API, or embed it with one line.
        </p>
        {!published && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Heads up: the API only returns content while your site is <strong>Published</strong>.
            It’s currently a draft.
          </div>
        )}
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Host on your own domain (GitHub Pages, Netlify, …)</p>
            <p className="text-xs text-muted-foreground">
              Download an <code>index.html</code>, drop it on any static host, and point your
              purchased domain at it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={downloadSnapshot} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Static snapshot
            </Button>
            <Button size="sm" variant="outline" onClick={downloadEmbed}>
              <Download className="size-4" /> Live embed
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong>Static snapshot</strong> bakes your data in — fully self-contained, works offline
            and on GitHub Pages with no server (re-export to refresh). <strong>Live embed</strong> is
            a tiny file that always shows your latest, but needs Fadi online.
          </p>
        </div>
        {snippets.map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{s.label}</Label>
              <button
                type="button"
                onClick={() => copy(s.code, s.label)}
                className="text-xs text-amber-400 hover:underline"
              >
                {copied === s.label ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground/90">
              <code>{s.code}</code>
            </pre>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Fields: <code>site</code> (handle, title, headline, template, theme, profile, resumeLinks)
          and <code>items[]</code> (section, title, subtitle, location, dateRange, description,
          bullets, roles, tag, url, imageUrl, gallery).
        </p>
      </div>
    </Modal>
  );
}

/* --------------------------------- item card --------------------------------- */
function ItemCard({
  item,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: PortfolioItemView;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`flex items-start gap-3 rounded-md border border-border bg-muted/20 p-4 transition-colors hover:border-amber-500/50 ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <span
        className="mt-1 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-5" />
      </span>
      {item.imageUrl &&
        (isVideoUrl(item.imageUrl) ? (
          <div className="flex size-16 items-center justify-center rounded bg-muted">
            <Film className="size-6 text-muted-foreground" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="size-16 rounded object-cover" />
        ))}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-medium">{item.title}</p>
          {!item.isPublished && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Draft
            </span>
          )}
          {item.tag && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
              {item.tag}
            </span>
          )}
        </div>
        {(item.subtitle || item.location || item.dateRange) && (
          <p className="text-xs text-muted-foreground">
            {[item.subtitle, item.location, item.dateRange].filter(Boolean).join(" · ")}
          </p>
        )}
        {item.roles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.roles.map((r) => (
              <span
                key={r}
                className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {r}
              </span>
            ))}
          </div>
        )}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{item.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onTogglePublish}
          title={item.isPublished ? "Unpublish" : "Publish"}
        >
          {item.isPublished ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} title="Edit">
          <Pencil className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- modal shell --------------------------------- */
function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------- item editor --------------------------------- */
function ItemEditor({
  initial,
  pending,
  onSave,
  onClose,
}: {
  initial: ItemForm;
  pending: boolean;
  onSave: (form: ItemForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemForm>(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [roleInput, setRoleInput] = useState("");
  const set = (patch: Partial<ItemForm>) => setForm((f) => ({ ...f, ...patch }));

  function addRole(raw: string) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !form.roles.includes(t)) setForm((f) => ({ ...f, roles: [...f.roles, t] }));
    setRoleInput("");
  }

  async function enhance() {
    if (!form.title.trim()) {
      setUploadError("Add a title first.");
      return;
    }
    setEnhancing(true);
    setUploadError(null);
    const r = await enhanceDescription({
      section: form.section,
      title: form.title,
      subtitle: form.subtitle,
      tag: form.tag,
      bullets: form.bulletsText.split("\n").map((b) => b.trim()).filter(Boolean),
      description: form.description,
    });
    setEnhancing(false);
    if (!r.ok) setUploadError(r.message);
    else set({ description: r.description });
  }
  const canUpload = mediaUploadConfigured();
  const galleryUrls = form.galleryText.split("\n").map((u) => u.trim()).filter(Boolean);

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      set({ imageUrl: await uploadPortfolioMedia(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function handleGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const urls = await Promise.all(files.map((f) => uploadPortfolioMedia(f)));
      set({ galleryText: [...galleryUrls, ...urls].join("\n") });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      title={`${form.id ? "Edit" : "Add"} ${SECTION_META[form.section]?.label.replace(/s$/, "").toLowerCase() ?? "item"}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {form.id ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Section</Label>
            <select
              value={form.section}
              onChange={(e) => set({ section: e.target.value })}
              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
            >
              {SECTION_KEYS.map((s) => (
                <option key={s} value={s}>
                  {SECTION_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Organization / subtitle</Label>
            <Input value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Date range</Label>
            <Input value={form.dateRange} onChange={(e) => set({ dateRange: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <Input value={form.tag} onChange={(e) => set({ tag: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Source link (URL)</Label>
          <Input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Description</Label>
            <button
              type="button"
              onClick={enhance}
              disabled={enhancing}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline disabled:opacity-50"
              title="Rewrite in your portfolio voice — grounded only in this item's facts"
            >
              {enhancing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              Enhance with Fadi
            </button>
          </div>
          <Textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Bullets (one per line)</Label>
          <Textarea rows={3} value={form.bulletsText} onChange={(e) => set({ bulletsText: e.target.value })} />
        </div>

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          {form.imageUrl && (
            <div className="relative inline-block">
              {isVideoUrl(form.imageUrl) ? (
                <div className="flex size-24 items-center justify-center rounded border border-border bg-muted">
                  <Film className="size-6 text-muted-foreground" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="" className="h-24 w-auto rounded border border-border" />
              )}
              <button
                type="button"
                onClick={() => set({ imageUrl: "" })}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {canUpload && (
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                Upload cover
                <input type="file" accept="image/*" className="hidden" onChange={handleCover} disabled={uploading} />
              </label>
            )}
            <Input
              value={form.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              placeholder={canUpload ? "…or paste a URL" : "Paste an image URL"}
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Gallery — images &amp; video</Label>
          {galleryUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {galleryUrls.map((url) => (
                <div key={url} className="relative">
                  {isVideoUrl(url) ? (
                    <div className="flex size-16 items-center justify-center rounded border border-border bg-muted">
                      <Film className="size-5 text-muted-foreground" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-16 rounded border border-border object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => set({ galleryText: galleryUrls.filter((u) => u !== url).join("\n") })}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {canUpload && (
            <label className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Add images / videos
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleGallery} disabled={uploading} />
            </label>
          )}
          <Textarea
            rows={2}
            value={form.galleryText}
            onChange={(e) => set({ galleryText: e.target.value })}
            placeholder="One media URL per line (uploads append here)"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Audiences — who is this for?</Label>
          <p className="text-xs text-muted-foreground">
            Free-form tags that power the visitor filter on your public site (your specialties, or
            the roles you target — e.g. “Paediatric ICU”, “Structural”, “Cloud”). Leave empty to show
            to everyone.
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
            {form.roles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400"
              >
                {r}
                <button type="button" onClick={() => set({ roles: form.roles.filter((v) => v !== r) })}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addRole(roleInput);
                }
              }}
              onBlur={() => roleInput && addRole(roleInput)}
              placeholder="add an audience + Enter"
              className="h-6 min-w-[9rem] flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {ROLES.filter((r) => !form.roles.includes(r.value)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ROLES.filter((r) => !form.roles.includes(r.value)).map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => addRole(r.value)}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-amber-500/50"
                >
                  + {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- settings modal --------------------------------- */
function SettingsModal({
  site,
  handle,
  pending,
  onClose,
  onSave,
}: {
  site: PortfolioSiteView;
  handle: string;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    handle: string;
    title: string;
    headline?: string;
    template?: string;
    resumeLinks?: Record<string, string>;
    profile?: Record<string, unknown>;
  }) => void;
}) {
  const p = (site.profile ?? {}) as {
    name?: string;
    location?: string;
    links?: string[];
    bio?: string;
    email?: string;
  };
  const [title, setTitle] = useState(site.title);
  const [handleInput, setHandleInput] = useState(handle);
  const [headline, setHeadline] = useState(site.headline ?? "");
  const [template, setTemplate] = useState(site.template || "noir-gold");
  const [resumeLinks, setResumeLinks] = useState<Record<string, string>>(site.resumeLinks ?? {});
  const [name, setName] = useState(p.name ?? "");
  const [location, setLocation] = useState(p.location ?? "");
  const [bio, setBio] = useState(p.bio ?? "");
  const [email, setEmail] = useState(p.email ?? "");
  const [linksText, setLinksText] = useState((p.links ?? []).join("\n"));
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function uploadResume(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadErr("Résumé must be under 10MB");
      return;
    }
    setUploadingKey(key);
    setUploadErr(null);
    try {
      const url = await uploadPortfolioMedia(file);
      setResumeLinks((s) => ({ ...s, [key]: url }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  }

  function save() {
    onSave({
      handle: handleInput,
      title,
      headline,
      template,
      resumeLinks,
      profile: {
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        email: email.trim(),
        links: linksText.split("\n").map((l) => l.trim()).filter(Boolean),
      },
    });
  }

  return (
    <Modal
      title="Portfolio settings"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Site title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Handle (public URL)</Label>
            <Input value={handleInput} onChange={(e) => setHandleInput(e.target.value)} />
            <p className="text-xs text-muted-foreground">yoursite.com/p/{handleInput || "…"}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Headline</Label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. IT Support · Cloud · Cybersecurity" />
        </div>
        <div className="space-y-1.5">
          <Label>Template</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "noir-gold", name: "Noir & Gold", swatch: "from-[#c9a84c]/40 to-zinc-900" },
              { id: "aurora", name: "Aurora", swatch: "from-teal-400/40 to-violet-500/30" },
              { id: "minimal", name: "Minimal", swatch: "from-zinc-700 to-zinc-900" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${
                  template === t.id ? "border-amber-500" : "border-border hover:border-amber-500/50"
                }`}
              >
                <div className={`h-12 bg-gradient-to-br ${t.swatch}`} />
                <div className="px-2 py-1.5 text-xs">{t.name}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Same content, different look. Change it anytime — your data stays put.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="text-[11px] text-muted-foreground">
            Powers the “Get in touch” buttons. Without it (or a link below) visitors have no way to
            reach you.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Intro / bio</Label>
          <Textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A friendly line or two that greets visitors — who you are, what you love building. This is your hero intro."
          />
          <p className="text-[11px] text-muted-foreground">
            Shown as the welcome intro on your site. Keep it warm and human.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Links (one per line)</Label>
          <Textarea rows={2} value={linksText} onChange={(e) => setLinksText(e.target.value)} placeholder={"https://github.com/you\nhttps://linkedin.com/in/you"} />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label>Résumés per position</Label>
          <p className="text-xs text-muted-foreground">
            The site shows the résumé matching the visitor’s focus; the default is the fallback.
            Upload a PDF or paste a link — the “Download CV” button appears once one is set.
          </p>
          {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
          {RESUME_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
              <Input
                value={resumeLinks[key] ?? ""}
                onChange={(e) => setResumeLinks((s) => ({ ...s, [key]: e.target.value }))}
                placeholder="https://… or upload →"
              />
              <label
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs hover:bg-muted"
                title="Upload a PDF"
              >
                {uploadingKey === key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => uploadResume(key, e)}
                  disabled={uploadingKey !== null}
                />
              </label>
              {resumeLinks[key] && (
                <a href={resumeLinks[key]} target="_blank" rel="noreferrer" className="text-amber-400" title="Preview">
                  <FileText className="size-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
