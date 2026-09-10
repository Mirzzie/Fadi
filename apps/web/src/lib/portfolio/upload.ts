// Client-side media upload to Cloudinary via an unsigned preset — same free
// approach the standalone portfolio used. Public cloud name + preset only; no
// secret is exposed. Handles images, video and documents.

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function mediaUploadConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

// `isVideoUrl` (a pure classifier used by the shared render layer) now lives in
// @careeros/portfolio; re-exported here so existing admin importers keep working.
export { isVideoUrl } from "@careeros/portfolio";

/**
 * WHICH CLOUDINARY ENDPOINT A FILE MUST GO TO.
 *
 * "auto" classifies a PDF as resource_type=image, because Cloudinary can rasterise and
 * transform PDFs. The delivery URL then reads /image/upload/....pdf — and Cloudinary
 * blocks PDF delivery under image by default on every account ("Allow delivery of PDF and
 * ZIP files", off unless you turn it on). The upload returns 200 with a secure_url that
 * answers 401 "deny or ACL failure" forever after.
 *
 * That is how a CV uploaded successfully in Fadi became a broken link on the live site.
 * Documents therefore go to /raw/upload, which serves the original bytes and is not
 * subject to that restriction. Images and video keep "auto" — that path was never broken.
 */
export function uploadKindFor(file: { type?: string; name?: string }): "auto" | "raw" {
  const type = (file.type ?? "").toLowerCase();
  if (type.startsWith("image/") || type.startsWith("video/")) return "auto";
  // Some browsers report an empty type for a drag-dropped file; fall back to the name.
  if (!type && /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|m4v|ogv)$/i.test(file.name ?? "")) {
    return "auto";
  }
  return "raw";
}

export async function uploadPortfolioMedia(file: File): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error(
      "Media upload isn't configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }
  const kind = uploadKindFor(file);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${kind}/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // An unsigned preset can be restricted to one resource type; say so rather than
    // echoing Cloudinary's raw JSON at someone trying to attach their CV.
    if (res.status === 400 && kind === "raw" && /resource type|not allowed/i.test(detail)) {
      throw new Error(
        "Cloudinary rejected this file type. In your upload preset, set “Resource type” to Auto so documents can be uploaded too.",
      );
    }
    throw new Error(`Upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error("Upload succeeded but no URL was returned.");

  await assertDeliverable(json.secure_url);
  return json.secure_url;
}

/**
 * A stored URL that 401s is worse than a failed upload: the failure is invisible until a
 * visitor clicks it. Cloudinary serves delivery URLs with Access-Control-Allow-Origin: *,
 * so the browser can read the real status — check before handing the URL back to be saved.
 */
async function assertDeliverable(url: string): Promise<void> {
  let status: number;
  try {
    status = (await fetch(url, { method: "GET", cache: "no-store" })).status;
  } catch {
    return; // Offline or blocked by an extension — don't fail a good upload on a guess.
  }
  if (status < 400) return;
  if (status === 401 && /\/image\/upload\/.*\.pdf$/i.test(url)) {
    throw new Error(
      "Cloudinary uploaded the file but won't serve it: PDF delivery is disabled on your account. " +
        "Turn on Settings → Security → “Allow delivery of PDF and ZIP files”, then upload again.",
    );
  }
  throw new Error(
    `Cloudinary uploaded the file but won't serve it (HTTP ${status}), so the link would be dead. Check your account's delivery restrictions.`,
  );
}
