// Pure media helpers shared by the render layer (both apps). The actual media UPLOAD
// (Cloudinary) is Fadi-admin-only and stays in apps/web — only this pure classifier is shared.

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url);
}
