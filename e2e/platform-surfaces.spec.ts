import { expect, test } from "@playwright/test";

test.skip(!process.env.FADI_UI_STORAGE_STATE, "Use an isolated synthetic account/database.");
test.use({ storageState: process.env.FADI_UI_STORAGE_STATE || { cookies: [], origins: [] } });

test("profile labels focus their fields and AI slots have separate identities", async ({
  page,
}) => {
  await page.goto("/dashboard/profile");
  for (const label of [
    "Full name",
    "Target role",
    "Location preference",
    "Career goal",
    "LinkedIn profile URL",
  ]) {
    await page
      .locator("label")
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
    await expect(page.getByLabel(label, { exact: true })).toBeFocused();
  }
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Add fallback", exact: true }).click();
  const models = page.getByLabel("Model", { exact: true });
  await expect(models).toHaveCount(2);
  const ids = await models.evaluateAll((es) => es.map((e) => e.id));
  expect(new Set(ids).size).toBe(2);
  for (const model of await models.all()) {
    const list = await model.getAttribute("list");
    await expect(page.locator(`datalist[id="${list}"]`)).toHaveCount(1);
  }
});

test("a failed connection retains entries and reports the failure inline", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Connect a server", exact: true }).click();
  await page.getByLabel("Server name", { exact: true }).fill("Unsubmitted local test");
  await page.getByLabel("MCP endpoint", { exact: true }).fill("https://example.invalid/mcp");
  await page.getByLabel("Access token (optional)", { exact: true }).fill("synthetic-not-a-secret");
  // Fail transport before the server action runs: no connection or remote request is made.
  await page.route("**/dashboard/settings", (route) =>
    route.request().method() === "POST" &&
    route.request().postData()?.includes("example.invalid/mcp")
      ? route.abort("failed")
      : route.continue()
  );
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your entries are still here" })
  ).toBeVisible();
  await expect(page.getByLabel("Server name", { exact: true })).toHaveValue(
    "Unsubmitted local test"
  );
  await expect(page.getByLabel("Access token (optional)", { exact: true })).toHaveValue(
    "synthetic-not-a-secret"
  );
});

test("machine registration has labelled usable fields and cancels without registration", async ({
  page,
}) => {
  await page.goto("/dashboard/learning/machines");
  await page.getByRole("button", { name: "Add machine", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a machine", exact: true });
  await dialog.locator("summary").filter({ hasText: "Other ways to add a machine" }).click();
  await dialog.getByRole("button", { name: "Enter machine details", exact: true }).click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      "Machine name",
      "Machine type",
      "Architecture",
      "Virtualisation",
      "Memory (GB)",
    ]) {
      const field = dialog.getByLabel(name, { exact: true });
      await expect(field).toBeVisible();
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(39.99);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add machine", exact: true })).toBeFocused();
});

test("portfolio import cancellation never chooses replacement", async ({ page }) => {
  let nativeDialog = false;
  page.on("dialog", (dialog) => {
    nativeDialog = true;
    void dialog.dismiss();
  });
  await page.goto("/dashboard/portfolio");
  await page.locator("summary").filter({ hasText: "Portfolio tools" }).click();
  const file = page.locator('input[type="file"][accept="application/json,.json"]');
  const upload = () =>
    file.setInputFiles({
      name: "sample.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"items":[]}'),
    });
  await upload();
  let dialog = page.getByRole("dialog", { name: "Import portfolio", exact: true });
  await expect(dialog.getByRole("button", { name: "Add to current items" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await upload();
  await dialog.getByRole("button", { name: "Replace current items…", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Replace current portfolio items?", exact: true });
  await expect(dialog.getByRole("button", { name: "Replace items", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(nativeDialog).toBe(false);
});

test("template menus support keyboard selection and cancelling keeps the existing text", async ({
  page,
}) => {
  test.skip(!process.env.FADI_UI_LETTER_ID, "Supply an uncompleted synthetic letter fixture.");
  await page.goto(`/dashboard/documents/${process.env.FADI_UI_LETTER_ID}`);
  const original = await page.getByLabel("Body", { exact: true }).inputValue();
  const templates = page.getByRole("button", { name: "Templates", exact: true });
  await templates.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Replace document text?", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue(original);
  await expect(templates).toBeFocused();
});

test("command copying explains a refused clipboard without running the command", async ({
  page,
}) => {
  test.skip(!process.env.FADI_GUIDE_PREVIEW, "Use the development-only shared component review.");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/design/system");
  await page.getByRole("button", { name: "Copy command", exact: true }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Clipboard access was refused" })
  ).toBeVisible();
  await expect(page.getByText('printf "local example"', { exact: true }).first()).toBeVisible();
});

test("touch profile fields keep a 44px target", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    storageState: process.env.FADI_UI_STORAGE_STATE,
  });
  try {
    const page = await context.newPage();
    await page.goto("/dashboard/profile");
    for (const label of ["Full name", "Target role", "Experience level"]) {
      const field = page.getByLabel(label, { exact: true });
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test("keyboard focus scrolls fields above the floating dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/profile");
  await page.getByLabel("Full name", { exact: true }).focus();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const covered = await page.evaluate(() => {
      const active = document.activeElement!;
      const dock = document.querySelector("[data-fadi-dock]")!;
      const field = active.getBoundingClientRect(),
        nav = dock.getBoundingClientRect();
      return (
        !dock.contains(active) &&
        field.left < nav.right &&
        field.right > nav.left &&
        field.top < nav.bottom &&
        field.bottom > nav.top
      );
    });
    expect(covered, "focused control must not be covered by navigation").toBe(false);
  }
});
