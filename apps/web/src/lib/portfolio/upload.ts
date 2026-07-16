// Client-side media upload to Cloudinary via an unsigned preset — same free
// approach the standalone portfolio used. Public cloud name + preset only; no
// secret is exposed. Handles images and video ("auto" endpoint).

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function mediaUploadConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url);
}

export async function uploadPortfolioMedia(file: File): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error(
      "Media upload isn't configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error("Upload succeeded but no URL was returned.");
  return json.secure_url;
}
