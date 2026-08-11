"use client";

import { useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadPortfolioMedia } from "@/lib/portfolio/upload";
import type { PortfolioSiteView } from "@careeros/portfolio";

import { Modal } from "./modal";
import { RESUME_KEYS } from "./shared";

/** Site-level settings: title/handle, template, profile, contact, and per-role résumés. */
export function SettingsModal({
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
