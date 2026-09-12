import { describe, expect, it } from "vitest";

/**
 * Asked of the REAL images, because the whole point is that a package list written from
 * memory drifts from what a repository actually ships. Opt-in: needs Docker and network.
 */
const ENABLED = process.env.FADI_E2E_DOCKER === "1";
(ENABLED ? describe : describe.skip)("packages exist in the lab's real repositories", () => {
  it("THE REAL ONE: Alpine has nginx, openssl, fail2ban — and not the Elastic stack", async () => {
    const { packagesMissingFrom } = await import("./broker");
    const res = await packagesMissingFrom("linux-web", [
      "nginx", "openssl", "fail2ban", "filebeat", "elasticsearch", "kibana",
    ]);
    expect(res.checked).toBe(true);
    expect(res.missing.sort()).toEqual(["elasticsearch", "filebeat", "kibana"]);
  }, 180_000);

  it("Ubuntu has nginx and does not have filebeat by default", async () => {
    const { packagesMissingFrom } = await import("./broker");
    const res = await packagesMissingFrom("linux-ubuntu", ["nginx", "filebeat"]);
    expect(res.checked).toBe(true);
    expect(res.missing).toEqual(["filebeat"]);
  }, 180_000);

  it("refuses a malformed name without asking docker", async () => {
    const { packagesMissingFrom } = await import("./broker");
    const res = await packagesMissingFrom("linux-web", ["nginx; rm -rf /", "$(id)"]);
    expect(res.missing).toEqual(["nginx; rm -rf /", "$(id)"]);
  }, 60_000);
});
