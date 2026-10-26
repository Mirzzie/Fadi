"use client";

import { useId, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadPortfolioMedia } from "@/lib/portfolio/upload";
import type { PortfolioSiteView } from "@careeros/portfolio";

import { DEFAULT_LABELS, LABEL_KEYS, labelsFor } from "@careeros/portfolio";

import { Modal } from "./modal";
import { RESUME_KEYS } from "./shared";

/** Human names for each editable heading, so the form isn't a list of code keys. */
const LABEL_TITLES: Record<string, string> = {
  featured: "Featured work heading",
  skills: "Skills section heading",
  skillsHint: "Skills section hint",
  history: "Work history heading",
  historyHint: "Work history hint",
  education: "Education heading",
  certifications: "Certifications heading",
  beyond: "Hobbies heading",
  beyondHint: "Hobbies hint",
  note: "Feedback heading",
  noteHint: "Feedback hint",
  contact: "Contact heading",
  caseCta: "Case link — button text",
  detailCta: "Detail link — button text",
  bookingCta: "Booking button text",
  contactCta: "Contact button text",
  gap: "Label for work with no proof yet",
};

/** Site-level settings: title/handle, profile, contact, page wording, and per-role résumés. */
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
    bookingUrl?: string;
    template?: string;
    labels?: Record<string, string>;
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
  const formId = useId();
  const [handleInput, setHandleInput] = useState(handle);
  const [headline, setHeadline] = useState(site.headline ?? "");
  const [bookingUrl, setBookingUrl] = useState(
    (site.profile as { bookingUrl?: string } | undefined)?.bookingUrl ?? ""
  );
  // Every heading on the public page, editable. Seeded with what the page currently
  // shows so the fields are never mysteriously blank.
  const [labels, setLabels] = useState<Record<string, string>>(() => ({
    ...labelsFor(site.theme as Record<string, unknown> | undefined),
  }));
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
      labels,
      resumeLinks,
      profile: {
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        email: email.trim(),
        bookingUrl: bookingUrl.trim(),
        links: linksText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
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
            <Label htmlFor={`${formId}-title`}>Site title</Label>
            <Input
              id={`${formId}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-handle`}>Handle (public URL)</Label>
            <Input
              id={`${formId}-handle`}
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
            />
            <p className="break-all text-xs text-muted-foreground">/p/{handleInput || "…"}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-headline`}>Headline</Label>
          <Input
            id={`${formId}-headline`}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. IT Operations &amp; Security Engineer"
          />
          <p className="text-[11px] text-muted-foreground">
            Describe your focus in a short line that fits the work you want to share.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-name`}>Display name</Label>
            <Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-location`}>Location</Label>
            <Input
              id={`${formId}-location`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-booking`}>Booking link (Calendly, Cal.com…)</Label>
          <Input
            id={`${formId}-booking`}
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
            placeholder="https://calendly.com/you/30min"
          />
          <p className="text-[11px] text-muted-foreground">
            Adds a “Book a call” button to your site. A reader who wants to talk can take a slot
            instead of composing an email and waiting — and the click is recorded as real interest.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-email`}>Contact email</Label>
          <Input
            id={`${formId}-email`}
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
          <Label htmlFor={`${formId}-bio`}>Intro / bio</Label>
          <Textarea
            id={`${formId}-bio`}
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
          <Label htmlFor={`${formId}-links`}>Links (one per line)</Label>
          <Textarea
            id={`${formId}-links`}
            rows={2}
            value={linksText}
            onChange={(e) => setLinksText(e.target.value)}
            placeholder={"https://github.com/you\nhttps://linkedin.com/in/you"}
          />
        </div>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Page wording
            <span className="ml-2 font-normal text-muted-foreground">
              — rename any heading on your public page
            </span>
          </summary>
          <div className="mt-3 grid gap-2.5">
            {LABEL_KEYS.map((k) => (
              <label key={k} className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {LABEL_TITLES[k] ?? k}
                </span>
                <Input
                  value={labels[k] ?? ""}
                  placeholder={DEFAULT_LABELS[k]}
                  onChange={(e) => setLabels((prev) => ({ ...prev, [k]: e.target.value }))}
                />
              </label>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Clear a field to return it to the default. These are the words a visitor reads, so use
              whatever your own field actually calls things.
            </p>
          </div>
        </details>

        <div className="space-y-2 border-t border-border pt-4">
          <Label>Résumés per position</Label>
          <p className="text-xs text-muted-foreground">
            The site shows the résumé matching the visitor’s focus; the default is the fallback.
            Upload a PDF or paste a link — the “Download CV” button appears once one is set.
          </p>
          {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
          {RESUME_KEYS.map(({ key, label }) => (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto_auto]"
            >
              <label
                htmlFor={`${formId}-resume-${key}`}
                className="col-span-full text-xs text-muted-foreground sm:col-span-1"
              >
                {label}
              </label>
              <Input
                id={`${formId}-resume-${key}`}
                className="min-w-0"
                value={resumeLinks[key] ?? ""}
                onChange={(e) => setResumeLinks((s) => ({ ...s, [key]: e.target.value }))}
                placeholder="https://… or upload →"
              />
              <label
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs hover:bg-muted focus-within:outline-2 focus-within:outline-ring"
                title="Upload a PDF"
              >
                {uploadingKey === key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                PDF
                <input
                  aria-label={`Upload ${label} PDF`}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => uploadResume(key, e)}
                  disabled={uploadingKey !== null}
                />
              </label>
              {resumeLinks[key] && (
                <a
                  href={resumeLinks[key]}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-10 place-items-center rounded-md text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Preview ${label} PDF`}
                >
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
