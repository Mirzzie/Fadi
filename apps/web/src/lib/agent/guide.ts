/** Local presentation only: target IDs are app-owned, never arbitrary model selectors. */
export type GuideTargetId =
  | "today.next"
  | "jobs.search"
  | "documents.create"
  | "record.add"
  | "portfolio.preview"
  | "interview.start"
  | "demo.direction"
  | "demo.practice";
export type GuideTarget = {
  id: GuideTargetId;
  element: HTMLElement;
  title: string;
  description: string;
  pathname: string;
};
export type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export function targetIsUsable(element: HTMLElement): boolean {
  if (
    !element.isConnected ||
    element.matches(':disabled,[aria-disabled="true"]') ||
    element.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')
  )
    return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.opacity === "0"
    )
      return false;
  }
  return element.getClientRects().length > 0;
}

export function targetInView(box: Box, width: number, height: number): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.left >= 0 &&
    box.top >= 0 &&
    box.right <= width &&
    box.bottom <= height
  );
}

/** Prefer beside/above/below; never park the orb over the target. Null means no safe space. */
export function guidePlacement(
  target: Box,
  width: number,
  height: number,
  orbWidth: number,
  orbHeight: number
) {
  const gap = 14,
    edge = 12;
  const clamp = (n: number, max: number) => Math.max(edge, Math.min(n, max));
  let orb: { x: number; y: number } | null = null;
  if (target.right + gap + orbWidth <= width - edge)
    orb = { x: target.right + gap, y: clamp(target.top, height - orbHeight - edge) };
  else if (target.left - gap - orbWidth >= edge)
    orb = { x: target.left - gap - orbWidth, y: clamp(target.top, height - orbHeight - edge) };
  else if (target.top - gap - orbHeight >= edge)
    orb = {
      x: clamp(target.right - orbWidth, width - orbWidth - edge),
      y: target.top - gap - orbHeight,
    };
  else if (target.bottom + gap + orbHeight <= height - edge)
    orb = { x: clamp(target.right - orbWidth, width - orbWidth - edge), y: target.bottom + gap };
  if (!orb) return null;
  const panelWidth = Math.min(304, width - edge * 2),
    panelHeight = 164;
  const below = Math.max(target.bottom, orb.y + orbHeight) + gap;
  const panelY =
    below + panelHeight <= height - edge ? below : Math.min(target.top, orb.y) - gap - panelHeight;
  const panel =
    panelY >= edge
      ? { x: clamp(target.left, width - panelWidth - edge), y: panelY, width: panelWidth }
      : null;
  return { orb, panel };
}
