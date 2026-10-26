import { describe, expect, it } from "vitest";
import { guidePlacement, targetInView, type Box } from "./guide";

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe("local guide placement", () => {
  it.each([320, 390, 768, 1440])(
    "keeps the orb and explanation off the target at %ipx",
    (width) => {
      const target = box(24, 320, Math.min(190, width - 48), 40);
      const placement = guidePlacement(target, width, 900, 64, 64)!;
      const orb = box(placement.orb.x, placement.orb.y, 64, 64);
      const panel = box(placement.panel!.x, placement.panel!.y, placement.panel!.width, 164);
      expect(overlaps(target, orb)).toBe(false);
      expect(overlaps(target, panel)).toBe(false);
      expect(overlaps(orb, panel)).toBe(false);
      expect(orb.left).toBeGreaterThanOrEqual(12);
      expect(orb.right).toBeLessThanOrEqual(width - 12);
      expect(panel.right).toBeLessThanOrEqual(width - 12);
      expect(panel.bottom).toBeLessThanOrEqual(888);
    }
  );
  it("refuses a target filling the viewport rather than cover it", () => {
    expect(guidePlacement(box(0, 0, 320, 600), 320, 600, 64, 64)).toBeNull();
  });
  it("returns no callout when there is not enough vertical room", () => {
    expect(guidePlacement(box(24, 40, 120, 100), 320, 220, 64, 64)?.panel).toBeNull();
  });
  it.each([
    box(-1, 0, 20, 20),
    box(0, -1, 20, 20),
    box(300, 0, 21, 20),
    box(0, 580, 20, 21),
    box(0, 0, 0, 20),
  ])("refuses an off-screen or empty box", (target) => {
    expect(targetInView(target, 320, 600)).toBe(false);
  });
  it("accepts an entirely visible box", () =>
    expect(targetInView(box(0, 0, 320, 600), 320, 600)).toBe(true));
});
