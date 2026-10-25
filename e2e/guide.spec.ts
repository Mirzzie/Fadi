import { expect, test } from "@playwright/test";

test.skip(
  !process.env.FADI_GUIDE_PREVIEW,
  "Development-only guide preview; opt in against next dev."
);

for (const width of [390, 1440]) {
  test(`local guidance: moves one orb, never executes, cancels and rejects stale targets at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    const mutations: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.method() !== "GET") mutations.push(r.url());
    });
    await page.goto("/design/guide");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("need it");
    const show = page.getByRole("button", { name: "Show me this control", exact: true });
    await show.click();
    const guide = page.getByRole("complementary", { name: "Fadi guidance" });
    await expect(guide).toBeVisible();
    await expect(page.locator("[data-fadi-launcher]")).toHaveCount(1);
    await expect(page.getByText("Not selected. Guidance will not change this.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Stop guidance/ })).toBeFocused();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const target = document.querySelector("[data-guide-highlight]")!.getBoundingClientRect();
          const orb = document.querySelector("[data-fadi-launcher]")!.getBoundingClientRect();
          return (
            orb.right <= target.left ||
            orb.left >= target.right ||
            orb.bottom <= target.top ||
            orb.top >= target.bottom
          );
        })
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    await expect(show).toBeFocused();
    await page.getByText("Try the safety cases").click();
    await page.getByLabel("Disable direction control").check();
    await show.click();
    await expect(guide).toHaveCount(0);
    await expect(page.getByText("That control is no longer available on this page.")).toBeVisible();
    await page.getByLabel("Disable direction control").uncheck();
    await show.click();
    await expect(guide).toBeVisible();
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((e) =>
        e.textContent?.includes("Choose a direction")
      );
      if (b?.parentElement) b.parentElement.style.opacity = "0";
    });
    await expect(guide).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
  });
}

test("reduced-motion guidance stays usable and leaves the native cursor", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design/guide");
  await page.getByRole("button", { name: "Show me this control", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Fadi guidance" })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe("none");
  await page.getByRole("button", { name: /Stop guidance/ }).click();
  await expect(page.locator("[data-guide-highlight]")).toHaveCount(0);
});
