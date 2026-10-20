/**
 * Minimise secrets before machine output becomes durable Practice proof.
 *
 * This is defence in depth, not a claim that arbitrary output can be made public safely. The
 * completion review remains private and the person still decides whether to save career evidence.
 */
export function redactPracticeProof(value: string): string {
  return value
    .replace(
      /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi,
      "[redacted-private-key]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted-token]")
    .replace(/\b(?:sk|ghp|github_pat)-?[A-Za-z0-9_]{12,}\b/g, "[redacted-key]")
    .replace(
      /\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)(\s*[:=]\s*)["']?[^\s"',;]+["']?/gi,
      (_match, name: string, separator: string) => `${name}${separator}[redacted]`
    )
    .replace(/:\/\/([^:\s/@]+):([^@\s/]+)@/g, (_match, user: string) => `://${user}:[redacted]@`);
}
