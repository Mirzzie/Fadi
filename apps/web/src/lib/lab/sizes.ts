/**
 * Memory in words a person reads correctly.
 *
 * An approval card said "this needs 0GB" for a 128MB nginx container — Math.round(128 / 1024)
 * is zero. A number that rounds a real requirement to nothing reads as "free", which is the
 * wrong direction to be wrong in on a card someone approves.
 */
export function formatMemory(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "0MB";
  if (mb < 1024) return `${Math.round(mb)}MB`;
  const gb = mb / 1024;
  // One decimal below 10GB, where the difference between 1.5 and 2 matters on a laptop.
  return gb < 10 ? `${Math.round(gb * 10) / 10}GB` : `${Math.round(gb)}GB`;
}
