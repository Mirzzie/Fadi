import { expect, test } from "@playwright/test";

test.skip(!process.env.FADI_GUIDE_PREVIEW, "Use the development-only shared component review.");

test("reference motion follows the palette, lights surfaces and leaves controls usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const palette of ["ember", "iris", "cobalt"])
    for (const mode of ["light", "dark"]) {
      await page.addInitScript(
        ({ palette, mode }) => {
          localStorage.setItem("fadi:palette", palette);
          localStorage.setItem("theme", mode);
        },
        { palette, mode }
      );
      await page.goto("/design/system");
      const intro = page.locator('[data-slot="page-intro"]');
      const dot = page.locator("[data-fadi-pointer]");
      await expect(dot).toHaveAttribute("data-ready", "");
      await intro.hover();
      expect(await intro.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(
        "radial-gradient"
      );
      await expect(dot).toHaveAttribute("data-active", "");
      expect(await dot.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
      expect(await dot.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
        await page.evaluate(() => {
          const sample = document.createElement("span");
          sample.style.color = "var(--brand-bright)";
          document.body.append(sample);
          const result = getComputedStyle(sample).color;
          sample.remove();
          return result;
        })
      );
      expect(await intro.evaluate((e) => getComputedStyle(e).cursor)).not.toBe("none");
      await page.getByLabel("Working title").hover();
      await expect(dot).not.toHaveAttribute("data-active", "");
      await page.getByLabel("Working title").fill("Reference motion review");
      await page.getByRole("button", { name: "Save example", exact: true }).click();
      await expect(
        page.getByText("Example saved locally. Your career record is unchanged.")
      ).toBeVisible();
    }
  expect(errors).toEqual([]);
});

test("reduced motion removes the moving cursor and decorative reveals", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design/system");
  await page.locator('[data-slot="page-intro"]').hover();
  await expect(page.locator("[data-fadi-pointer]")).toBeHidden();
  expect(
    await page
      .locator('[data-slot="page-intro"]')
      .evaluate((e) => getComputedStyle(e).animationName)
  ).toBe("none");
  await page.getByRole("button", { name: "Review dialog", exact: true }).click();
  expect(
    await page.getByRole("dialog").evaluate((e) => getComputedStyle(e).transitionDuration)
  ).toBe("0s");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("touch keeps native interaction without a cursor trail", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/design/system");
  await page.getByLabel("Working title").fill("Touch review");
  await page.getByRole("button", { name: "Save example", exact: true }).tap();
  await expect(
    page.getByText("Example saved locally. Your career record is unchanged.")
  ).toBeVisible();
  await expect(page.locator("[data-fadi-pointer]")).toBeHidden();
  await context.close();
});
