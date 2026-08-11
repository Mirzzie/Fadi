"use client";

import { useState } from "react";
import { Film, ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enhanceDescription } from "@/app/dashboard/portfolio/actions";
import { isVideoUrl, mediaUploadConfigured, uploadPortfolioMedia } from "@/lib/portfolio/upload";

import { Modal } from "./modal";
import { ROLES, SECTION_KEYS, SECTION_META, type ItemForm } from "./shared";

/** Add / edit a single portfolio item (cover + gallery uploads, AI-enhance, audience tags). */
export function ItemEditor({
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
