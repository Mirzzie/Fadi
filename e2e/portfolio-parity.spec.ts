import { expect, test } from "@playwright/test";

// Opt in against synthetic, locally published fixtures only. These checks never publish,
// download a CV, send feedback or enable visitor analytics on a deployed portfolio.
const hosts = [
  { name: "live", url: process.env.FADI_UI_PUBLIC_PORTFOLIO },
  { name: "static", url: process.env.FADI_UI_STATIC_PORTFOLIO },
];

for (const host of hosts) {
  test.describe(`${host.name} portfolio parity`, () => {
    test.skip(!host.url, "Supply a local synthetic portfolio URL.");

    test("appearance, CV contrast, motion and case navigation stay consistent", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(host.url!);
      const appearance = page.getByRole("complementary", { name: "Portfolio appearance" });
      await appearance.locator("summary").click();
      for (const palette of ["Ember", "Iris", "Cobalt"]) {
        await appearance.getByRole("radio", { name: new RegExp(`^${palette}`) }).check();
        for (const mode of ["Light", "Dark"]) {
          await appearance.getByRole("radio", { name: mode, exact: true }).check();
          await expect(page.locator("html")).toHaveAttribute("data-palette", palette.toLowerCase());
          await expect(page.locator("html")).toHaveAttribute("data-appearance", mode.toLowerCase());
          const contrast = () =>
            page.locator("[data-pf-resume]").evaluate((link) => {
              const rgb = (s: string) =>
                s
                  .match(/[\d.]+/g)!
                  .slice(0, 3)
                  .map(Number);
              const luminance = (values: number[]) =>
                values
                  .map((v) => {
                    v /= 255;
                    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                  })
                  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
              const ink = luminance(rgb(getComputedStyle(link).color));
              const bg = luminance(rgb(getComputedStyle(link.closest("main")!).backgroundColor));
              return (Math.max(ink, bg) + 0.05) / (Math.min(ink, bg) + 0.05);
            });
          await expect
            .poll(contrast, { message: `${host.name} ${palette}/${mode} CV contrast` })
            .toBeGreaterThanOrEqual(4.5);
          for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth)
            ).toBeLessThanOrEqual(width);
            const gutterDifference = await page.evaluate(() => {
              const controls = document.querySelector(".public-appearance")!;
              const content = document.querySelector("main > div.relative")!;
              const left = (element: Element) =>
                element.getBoundingClientRect().left +
                parseFloat(getComputedStyle(element).paddingLeft);
              return Math.abs(left(controls) - left(content));
            });
            expect(gutterDifference, "appearance follows the content gutter").toBeLessThan(1);
          }
        }
      }
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-palette", "cobalt");
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.locator("main").evaluate((e) => getComputedStyle(e).fontFamily)).toContain(
        "Mona"
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      const pointer = page.locator("[data-fadi-pointer]");
      await expect(pointer).toHaveAttribute("data-ready", "");
      await page.getByRole("heading", { level: 1 }).hover();
      // Scrolling the heading into view deliberately clears decoration. A new
      // physical pointer movement should reactivate it once scrolling settles.
      let movement = 0;
      await expect
        .poll(async () => {
          await page.mouse.move(160 + movement++, 100);
          return pointer.getAttribute("data-active");
        })
        .toBe("");
      expect(await pointer.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(pointer).not.toBeVisible();
      await page
        .locator("main a")
        .filter({ hasText: /case study/i })
        .first()
        .click();
      await expect(page.locator('[data-pf-template="case"]')).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-palette", "cobalt");
      await page.getByRole("link", { name: "Back to portfolio" }).click();
      await expect(page.locator('[data-pf-template="work"]')).toBeVisible();
      expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe(
        new URL(host.url!).pathname.replace(/\/$/, "")
      );
      expect(errors).toEqual([]);
    });
  });
}
