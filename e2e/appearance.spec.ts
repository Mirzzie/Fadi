import { expect, test } from "@playwright/test";

for (const palette of ["ember", "iris", "cobalt"]) for (const mode of ["light", "dark"]) {
  test(`${palette}/${mode}: shared theme, readable controls and narrow reflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ palette, mode }) => {
      localStorage.setItem("fadi:palette", palette); localStorage.setItem("theme", mode);
    }, { palette, mode });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette);
    await expect(page.locator("html")).toHaveAttribute("data-appearance", mode);
    await page.locator("footer details summary").click();
    await expect(page.getByRole("radio", { name: new RegExp(`^${palette}`, "i") })).toBeChecked();
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    const ratios = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      function rgb(value: string) { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const ctx = canvas.getContext("2d")!; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3); }
      function luminance(v: number[]) { return v.map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0); }
      function ratio(a: number[], b: number[]) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
      const color = (token: string) => rgb(root.getPropertyValue(token).trim());
      const result: Record<string, number> = {};
      for (const bg of ["--background", "--card", "--muted"]) {
        result[`body ${bg}`] = ratio(color("--foreground"), color(bg));
        result[`muted ${bg}`] = ratio(color("--muted-foreground"), color(bg));
        for (const status of ["--success", "--warning", "--destructive", "--info"]) {
          const ink = color(status); const tinted = color(bg).map((x, i) => x * .9 + ink[i] * .1);
          result[`${status} ${bg}`] = ratio(ink, tinted);
        }
      }
      result.primary = ratio(color("--primary"), color("--primary-foreground"));
      result.brand = ratio(color("--brand-bright"), color("--brand-bright-foreground"));
      result.input = ratio(color("--input"), color("--background"));
      return result;
    });
    for (const [name, ratio] of Object.entries(ratios)) expect(ratio, `${palette}/${mode} ${name}`).toBeGreaterThanOrEqual(name === "input" ? 3 : 4.5);
    expect(errors).toEqual([]);
  });
}

test("appearance changes persist, follow system live, and sync between tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.locator("footer details summary").click();
  await page.getByRole("radio", { name: "Cobalt · clear blue" }).check();
  await page.getByRole("radio", { name: "Follow system" }).check();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cobalt");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  const other = await context.newPage();
  await other.goto("/");
  await other.locator("footer details summary").click();
  await other.getByRole("radio", { name: "Iris · soft violet" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "iris");
  await other.close();
});

test("blocked storage retains a usable session and explains that it is not saved", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } }); });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator("footer details summary").click();
  await page.getByRole("radio", { name: "Iris · soft violet" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "iris");
  await expect(page.getByRole("status")).toContainText("Applied for this session");
});

test("reduced motion stops the decorative entry transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.locator(".fadi-appear").evaluate(x => getComputedStyle(x).animationName)).toBe("none");
});
