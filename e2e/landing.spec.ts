import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`public landing — ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const width of [320, 390, 768, 1440, 1920]) {
      test(`reflows and discloses FAQ by keyboard at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Turn your nextcareer move into a plan."
        );
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByText("Illustrative example · not account data")).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Create your account" }).first()
        ).toHaveAttribute("href", "/auth/sign-up");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width
        );
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#main$/);
        const question = page.locator("summary").first();
        await question.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("details").first()).toHaveAttribute("open", "");
        await page.keyboard.press("Enter");
        await expect(page.locator("details").first()).not.toHaveAttribute("open", "");
        const colors = await page.locator("main").evaluate((main) => {
          const surface = getComputedStyle(main.parentElement!);
          return { background: surface.backgroundColor, ink: surface.color };
        });
        expect(colors.background).toBe(
          colorScheme === "dark" ? "rgb(9, 9, 9)" : "rgb(251, 250, 248)"
        );
        expect(colors.ink).toBe(colorScheme === "dark" ? "rgb(247, 246, 243)" : "rgb(23, 23, 23)");
      });
    }
  });
}
